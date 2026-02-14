/**
 * Instance Discovery Module
 *
 * Tracks which OpenClaw instances are online and healthy.
 * Agents send heartbeats periodically; instances are marked offline
 * after 5 minutes of no heartbeat activity.
 *
 * Used by:
 * - Notification delivery to route messages to correct instance
 * - Failover detection for task reassignment
 * - Instance health monitoring
 */

/**
 * Instance Data Model
 * {
 *   instanceId: string,       // e.g., "openclaw-macbook"
 *   hostname: string,         // e.g., "macbook.local"
 *   tailscaleIP: string,      // e.g., "100.0.0.1"
 *   agentCount: number,       // agents running on this instance
 *   status: string,           // "online" | "offline" | "degraded"
 *   lastHeartbeat: number,    // timestamp of last agent heartbeat
 *   taskCount: number,        // active tasks on this instance
 *   uptime: number,           // instance uptime in ms
 *   createdAt: number,        // when discovered
 *   updatedAt: number,        // last update
 * }
 */

const HEARTBEAT_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Instance discovery and health tracking
 */
export class InstanceDiscovery {
  constructor() {
    this.instances = new Map() // instanceId -> instance data
    this.agentToInstance = new Map() // agentId -> instanceId
  }

  /**
   * Register or update instance from agent heartbeat
   */
  registerHeartbeat(agentId, agentData) {
    const { instanceId, tailscaleIP } = agentData

    if (!instanceId) {
      console.warn(`Agent ${agentId} has no instanceId`)
      return null
    }

    const now = Date.now()
    let instance = this.instances.get(instanceId)

    if (!instance) {
      // New instance
      instance = {
        instanceId,
        hostname: extractHostname(tailscaleIP),
        tailscaleIP,
        agentCount: 0,
        status: 'online',
        lastHeartbeat: now,
        taskCount: 0,
        uptime: 0,
        createdAt: now,
        updatedAt: now,
        agents: []
      }
      this.instances.set(instanceId, instance)
    }

    // Update heartbeat timestamp
    instance.lastHeartbeat = now
    instance.tailscaleIP = tailscaleIP
    instance.status = 'online'
    instance.updatedAt = now

    // Track agent-to-instance mapping
    const previousInstance = this.agentToInstance.get(agentId)
    if (previousInstance && previousInstance !== instanceId) {
      // Agent moved instances (failover scenario)
      const oldInst = this.instances.get(previousInstance)
      if (oldInst) {
        oldInst.agents = oldInst.agents.filter(a => a !== agentId)
        oldInst.agentCount = oldInst.agents.length
      }
    }

    this.agentToInstance.set(agentId, instanceId)

    // Update agent list
    if (!instance.agents.includes(agentId)) {
      instance.agents.push(agentId)
    }
    instance.agentCount = instance.agents.length

    return instance
  }

  /**
   * Update task count for an instance
   */
  updateTaskCount(instanceId, taskCount) {
    const instance = this.instances.get(instanceId)
    if (instance) {
      instance.taskCount = taskCount
      instance.updatedAt = Date.now()
    }
    return instance
  }

  /**
   * Mark instance as offline (no heartbeat in timeout period)
   */
  pruneStale(now = Date.now()) {
    const pruned = []

    for (const [instanceId, instance] of this.instances) {
      const age = now - instance.lastHeartbeat
      if (age > HEARTBEAT_TIMEOUT_MS) {
        instance.status = 'offline'
        pruned.push({
          instanceId,
          reason: 'heartbeat_timeout',
          lastHeartbeat: new Date(instance.lastHeartbeat).toISOString(),
          ageMs: age
        })
      } else if (instance.status === 'offline' && age <= HEARTBEAT_TIMEOUT_MS) {
        // Recovered
        instance.status = 'online'
      }
    }

    return pruned
  }

  /**
   * Get all instances
   */
  getAll() {
    return Array.from(this.instances.values())
  }

  /**
   * Get online instances only
   */
  getOnline() {
    return this.getAll().filter(i => i.status === 'online')
  }

  /**
   * Get instance by ID
   */
  getInstance(instanceId) {
    return this.instances.get(instanceId)
  }

  /**
   * Get instance for an agent
   */
  getInstanceForAgent(agentId) {
    const instanceId = this.agentToInstance.get(agentId)
    return instanceId ? this.instances.get(instanceId) : null
  }

  /**
   * Get agents on an instance
   */
  getAgentsOnInstance(instanceId) {
    const instance = this.instances.get(instanceId)
    return instance ? instance.agents : []
  }

  /**
   * Get instances by status
   */
  getByStatus(status) {
    return this.getAll().filter(i => i.status === status)
  }

  /**
   * Get healthiest instance (online, lowest load)
   */
  getHealthiestInstance() {
    const online = this.getOnline()
    if (online.length === 0) return null

    // Sort by task count (ascending)
    online.sort((a, b) => a.taskCount - b.taskCount)
    return online[0]
  }

  /**
   * Get statistics
   */
  getStats() {
    const all = this.getAll()
    const online = this.getOnline()
    const offline = this.getByStatus('offline')

    const totalAgents = Array.from(this.agentToInstance.values()).length
    const totalTasks = all.reduce((sum, i) => sum + i.taskCount, 0)

    return {
      totalInstances: all.length,
      onlineInstances: online.length,
      offlineInstances: offline.length,
      totalAgents,
      totalTasks,
      avgTasksPerInstance: totalTasks / (online.length || 1),
      uptime: Date.now() // System uptime in ms
    }
  }

  /**
   * Get instance capacity for task routing
   */
  getCapacities() {
    return this.getOnline().map(instance => ({
      instanceId: instance.instanceId,
      hostname: instance.hostname,
      tailscaleIP: instance.tailscaleIP,
      agentCount: instance.agentCount,
      taskCount: instance.taskCount,
      capacity: instance.agentCount * 3 - instance.taskCount, // 3 tasks per agent max
      healthScore: calculateHealthScore(instance)
    }))
  }

  /**
   * Clear all (for testing)
   */
  clear() {
    this.instances.clear()
    this.agentToInstance.clear()
  }
}

/**
 * Extract hostname from IP address
 */
function extractHostname(tailscaleIP) {
  if (!tailscaleIP) return 'unknown'
  
  // Try reverse DNS or just return IP
  return tailscaleIP
}

/**
 * Calculate health score for an instance
 * Higher is healthier (0-100)
 */
function calculateHealthScore(instance) {
  if (instance.status === 'offline') return 0
  if (instance.status === 'degraded') return 50

  // online: base 100
  // Deduct points for high load
  const maxTasks = instance.agentCount * 4 // Soft limit
  const loadPercent = (instance.taskCount / Math.max(maxTasks, 1)) * 100
  const healthScore = Math.max(50, 100 - loadPercent * 0.5)

  return Math.round(healthScore)
}

/**
 * Singleton instance discovery
 */
let discovery = null

export function getInstanceDiscovery() {
  if (!discovery) {
    discovery = new InstanceDiscovery()
  }
  return discovery
}
