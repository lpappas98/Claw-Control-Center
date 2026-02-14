import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * Agent Data Model
 * {
 *   id: string,               // unique agent id (e.g., "dev-agent", "pixel")
 *   name: string,             // display name
 *   emoji: string,            // agent avatar emoji
 *   roles: string[],          // capabilities (e.g., ["backend-dev", "api"])
 *   model: string,            // AI model (e.g., "anthropic/claude-haiku-4-5")
 *   workspace: string,        // workspace path
 *   status: string,           // "online" | "offline" | "busy"
 *   instanceId: string,       // OpenClaw instance ID
 *   tailscaleIP: string,      // Instance IP for routing
 *   currentTask: string?,     // current task ID if any
 *   activeTasks: string[],    // all active task IDs
 *   lastHeartbeat: number,    // timestamp of last heartbeat
 *   metadata: object,         // extensible metadata
 *   createdAt: number,
 *   updatedAt: number
 * }
 */

export class AgentsStore {
  constructor(filePath = '.clawhub/agents.json') {
    this.filePath = filePath
    this.agents = []
    this.loaded = false
  }

  async load() {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8')
      const data = JSON.parse(raw)
      this.agents = Array.isArray(data) ? data : data?.agents || []
      this.loaded = true
    } catch {
      this.agents = []
      this.loaded = true
    }
    return this.agents
  }

  async save() {
    const dir = path.dirname(this.filePath)
    await fs.mkdir(dir, { recursive: true })

    const tmp = `${this.filePath}.tmp`
    const payload = JSON.stringify(this.agents, null, 2)
    await fs.writeFile(tmp, payload, 'utf8')
    await fs.rename(tmp, this.filePath)
  }

  async ensureLoaded() {
    if (!this.loaded) await this.load()
  }

  /**
   * Get all agents
   */
  async getAll() {
    await this.ensureLoaded()
    return this.agents
  }

  /**
   * Get agent by ID
   */
  async get(id) {
    await this.ensureLoaded()
    return this.agents.find(a => a.id === id)
  }

  /**
   * Register or update an agent
   */
  async upsert(agent) {
    await this.ensureLoaded()
    
    const existing = this.agents.find(a => a.id === agent.id)
    const now = Date.now()

    if (existing) {
      // Update existing
      Object.assign(existing, agent, { updatedAt: now })
    } else {
      // Create new
      this.agents.push({
        ...agent,
        createdAt: now,
        updatedAt: now,
        status: agent.status || 'offline',
        activeTasks: agent.activeTasks || [],
        metadata: agent.metadata || {}
      })
    }

    await this.save()
    return this.agents.find(a => a.id === agent.id)
  }

  /**
   * Update agent status
   */
  async updateStatus(id, status, currentTask = null) {
    await this.ensureLoaded()
    const agent = this.agents.find(a => a.id === id)
    if (!agent) return null

    agent.status = status
    agent.lastHeartbeat = Date.now()
    agent.updatedAt = Date.now()
    if (currentTask !== null) {
      agent.currentTask = currentTask
    }

    await this.save()
    return agent
  }

  /**
   * Update agent's active tasks
   */
  async updateActiveTasks(id, taskIds) {
    await this.ensureLoaded()
    const agent = this.agents.find(a => a.id === id)
    if (!agent) return null

    agent.activeTasks = taskIds
    agent.updatedAt = Date.now()

    await this.save()
    return agent
  }

  /**
   * Get agents by role
   */
  async getByRole(role) {
    await this.ensureLoaded()
    return this.agents.filter(a => a.roles?.includes(role))
  }

  /**
   * Get available agents (online, not busy)
   */
  async getAvailable() {
    await this.ensureLoaded()
    return this.agents.filter(a => a.status === 'online')
  }

  /**
   * Get agent workload (number of active tasks)
   */
  getWorkload(agent) {
    return agent.activeTasks?.length || 0
  }

  /**
   * Find best agent for a task based on role and workload
   */
  async findBestAgent(requiredRole) {
    const candidates = await this.getByRole(requiredRole)
    const available = candidates.filter(a => a.status === 'online')

    if (available.length === 0) return null

    // Sort by workload (ascending)
    available.sort((a, b) => this.getWorkload(a) - this.getWorkload(b))

    return available[0]
  }

  /**
   * Remove stale agents (no heartbeat in 5 minutes)
   */
  async pruneStale(maxAgeMs = 5 * 60 * 1000) {
    await this.ensureLoaded()
    const now = Date.now()
    const before = this.agents.length

    this.agents = this.agents.filter(a => {
      if (!a.lastHeartbeat) return true // Keep if never heartbeated
      return (now - a.lastHeartbeat) < maxAgeMs
    })

    if (this.agents.length !== before) {
      await this.save()
    }

    return before - this.agents.length // number removed
  }

  /**
   * Delete agent
   */
  async delete(id) {
    await this.ensureLoaded()
    const before = this.agents.length
    this.agents = this.agents.filter(a => a.id !== id)
    
    if (this.agents.length !== before) {
      await this.save()
      return true
    }
    return false
  }
}

// Singleton instance
let store = null
export function getAgentsStore(filePath) {
  if (!store) {
    store = new AgentsStore(filePath)
  }
  return store
}
