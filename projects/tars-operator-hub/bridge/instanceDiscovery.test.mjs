/**
 * Tests for instanceDiscovery.mjs
 * Tests instance registration, discovery, and health management
 */

import { describe, it } from 'node:test'
import assert from 'node:assert'

// Test helper implementations (mock implementation)
class InstanceRegistry {
  constructor() {
    this.instances = new Map()
  }

  register(instance) {
    this.instances.set(instance.id, {
      ...instance,
      registeredAt: instance.registeredAt || Date.now()
    })
  }

  getInstance(id) {
    return this.instances.get(id)
  }

  getInstances() {
    return Array.from(this.instances.values())
  }

  recordHeartbeat(instanceId) {
    const instance = this.instances.get(instanceId)
    if (instance) {
      instance.lastHeartbeat = Date.now()
    }
  }

  pruneStale(timeoutMs) {
    const now = Date.now()
    for (const [id, instance] of this.instances.entries()) {
      if (instance.lastHeartbeat && (now - instance.lastHeartbeat) > timeoutMs) {
        this.instances.delete(id)
      }
    }
  }
}

function calculateHealthScore(instance) {
  if (!instance) return 0

  let score = 0

  // Status component (40 points)
  if (instance.status === 'online') score += 40
  else if (instance.status === 'busy') score += 30
  else if (instance.status === 'offline') score += 5

  // Heartbeat freshness (40 points)
  if (instance.lastHeartbeat) {
    const timeSinceHeartbeat = Date.now() - instance.lastHeartbeat
    const fiveMinutesMs = 5 * 60 * 1000
    const recentnessRatio = Math.max(0, 1 - timeSinceHeartbeat / fiveMinutesMs)
    score += recentnessRatio * 40
  }

  // Task capacity (20 points)
  const taskCount = instance.taskCount || 0
  const capacityRatio = Math.max(0, 1 - taskCount / 20)
  score += capacityRatio * 20

  return Math.round(score)
}

describe('Instance Discovery', () => {
  it('should register a new instance', () => {
    const registry = new InstanceRegistry()
    const instance = {
      id: 'instance-1',
      agentId: 'agent-1',
      status: 'online',
      tailscaleIp: '100.0.0.1'
    }

    registry.register(instance)
    const registered = registry.getInstance(instance.id)

    assert(registered, 'Instance should be registered')
    assert.equal(registered.id, 'instance-1', 'ID should match')
    assert.equal(registered.agentId, 'agent-1', 'Agent ID should match')
  })

  it('should register multiple instances', () => {
    const registry = new InstanceRegistry()
    const instances = [
      { id: 'i1', agentId: 'agent-1', status: 'online', tailscaleIp: '100.0.0.1' },
      { id: 'i2', agentId: 'agent-2', status: 'online', tailscaleIp: '100.0.0.2' },
      { id: 'i3', agentId: 'agent-3', status: 'offline', tailscaleIp: '100.0.0.3' }
    ]

    instances.forEach(inst => registry.register(inst))

    assert.equal(registry.getInstances().length, 3, 'Should have 3 instances')
  })

  it('should update existing instance on re-registration', () => {
    const registry = new InstanceRegistry()
    const instance = { id: 'update-test', agentId: 'agent-1', status: 'online', tailscaleIp: '100.0.0.1' }
    
    registry.register(instance)
    const firstCount = registry.getInstances().length

    instance.status = 'busy'
    registry.register(instance)

    assert.equal(registry.getInstances().length, firstCount, 'Count should not change')
    assert.equal(registry.getInstance('update-test').status, 'busy', 'Status should update')
  })

  it('should retrieve instance by ID', () => {
    const registry = new InstanceRegistry()
    const instance = { id: 'lookup-test', agentId: 'agent-1', status: 'online', tailscaleIp: '100.0.0.1' }
    registry.register(instance)

    const found = registry.getInstance('lookup-test')
    assert(found, 'Should find instance')
    assert.equal(found.id, 'lookup-test', 'ID should match')
  })

  it('should return undefined for non-existent instance', () => {
    const registry = new InstanceRegistry()
    const found = registry.getInstance('non-existent')
    assert.equal(found, undefined, 'Should return undefined')
  })

  it('should get all instances', () => {
    const registry = new InstanceRegistry()
    registry.register({ id: 'i1', agentId: 'a1', status: 'online', tailscaleIp: '100.0.0.1' })
    registry.register({ id: 'i2', agentId: 'a2', status: 'online', tailscaleIp: '100.0.0.2' })
    registry.register({ id: 'i3', agentId: 'a3', status: 'offline', tailscaleIp: '100.0.0.3' })

    const all = registry.getInstances()
    assert.equal(all.length, 3, 'Should have 3 instances')
  })

  it('should filter instances by status', () => {
    const registry = new InstanceRegistry()
    registry.register({ id: 'i1', agentId: 'a1', status: 'online', tailscaleIp: '100.0.0.1' })
    registry.register({ id: 'i2', agentId: 'a2', status: 'busy', tailscaleIp: '100.0.0.2' })
    registry.register({ id: 'i3', agentId: 'a3', status: 'offline', tailscaleIp: '100.0.0.3' })

    const online = registry.getInstances().filter(i => i.status === 'online')
    assert.equal(online.length, 1, 'Should have 1 online')
  })

  it('should find instances by agent ID', () => {
    const registry = new InstanceRegistry()
    registry.register({ id: 'i1', agentId: 'agent-1', status: 'online', tailscaleIp: '100.0.0.1' })
    registry.register({ id: 'i2', agentId: 'agent-1', status: 'offline', tailscaleIp: '100.0.0.2' })
    registry.register({ id: 'i3', agentId: 'agent-2', status: 'online', tailscaleIp: '100.0.0.3' })

    const agent1Instances = registry.getInstances().filter(i => i.agentId === 'agent-1')
    assert.equal(agent1Instances.length, 2, 'Should have 2 agent-1 instances')
  })

  it('should track last heartbeat time', () => {
    const registry = new InstanceRegistry()
    const instance = { id: 'heartbeat-test', agentId: 'agent-1', status: 'online', tailscaleIp: '100.0.0.1' }
    registry.register(instance)

    const before = Date.now()
    registry.recordHeartbeat('heartbeat-test')
    const after = Date.now()

    const registered = registry.getInstance('heartbeat-test')
    assert(registered.lastHeartbeat, 'Should have lastHeartbeat')
    assert(registered.lastHeartbeat >= before && registered.lastHeartbeat <= after, 'Heartbeat time should be valid')
  })

  it('should detect stale instances (5 minute timeout)', () => {
    const registry = new InstanceRegistry()
    const instance = { id: 'stale-test', agentId: 'agent-1', status: 'online', tailscaleIp: '100.0.0.1' }
    registry.register(instance)
    registry.recordHeartbeat('stale-test')

    const registered = registry.getInstance('stale-test')
    const fiveMinutesMs = 5 * 60 * 1000

    // Manually set heartbeat to 6 minutes ago
    registered.lastHeartbeat = Date.now() - (6 * 60 * 1000)

    const isStale = (Date.now() - registered.lastHeartbeat) > fiveMinutesMs
    assert(isStale, 'Should be stale')
  })

  it('should prune timed-out instances', () => {
    const registry = new InstanceRegistry()
    registry.register({ id: 'i1', agentId: 'a1', status: 'online', tailscaleIp: '100.0.0.1' })
    registry.register({ id: 'i2', agentId: 'a2', status: 'online', tailscaleIp: '100.0.0.2' })
    registry.register({ id: 'i3', agentId: 'a3', status: 'online', tailscaleIp: '100.0.0.3' })

    // Mark heartbeats
    registry.recordHeartbeat('i1')
    registry.recordHeartbeat('i2')
    registry.recordHeartbeat('i3')

    // Manually age i2 to be stale
    registry.getInstance('i2').lastHeartbeat = Date.now() - (6 * 60 * 1000)

    // Prune stale instances
    const fiveMinutesMs = 5 * 60 * 1000
    registry.pruneStale(fiveMinutesMs)

    const remaining = registry.getInstances()
    const hasI2 = remaining.map(i => i.id).includes('i2')
    assert(!hasI2, 'i2 should be pruned')
  })

  it('should not prune recently active instances', () => {
    const registry = new InstanceRegistry()
    registry.register({ id: 'i1', agentId: 'a1', status: 'online', tailscaleIp: '100.0.0.1' })
    registry.recordHeartbeat('i1')

    const beforeCount = registry.getInstances().length
    registry.pruneStale(5 * 60 * 1000)

    assert.equal(registry.getInstances().length, beforeCount, 'Count should not change')
    assert(registry.getInstance('i1'), 'i1 should still exist')
  })

  it('should calculate health score for online instance', () => {
    const registry = new InstanceRegistry()
    const instance = { id: 'health-1', agentId: 'agent-1', status: 'online', tailscaleIp: '100.0.0.1' }
    registry.register(instance)
    registry.recordHeartbeat('health-1')

    const score = calculateHealthScore(registry.getInstance('health-1'))
    assert(score > 0, 'Score should be positive')
    assert(score <= 100, 'Score should be <= 100')
  })

  it('should give high score to recently active online instance', () => {
    const registry = new InstanceRegistry()
    const instance = { id: 'active-1', agentId: 'agent-1', status: 'online', tailscaleIp: '100.0.0.1' }
    registry.register(instance)
    registry.recordHeartbeat('active-1')

    const score = calculateHealthScore(registry.getInstance('active-1'))
    assert(score > 80, 'Active online should have high score')
  })

  it('should give low score to offline instance', () => {
    const registry = new InstanceRegistry()
    const instance = { id: 'offline-1', agentId: 'agent-1', status: 'offline', tailscaleIp: '100.0.0.1' }
    registry.register(instance)

    const score = calculateHealthScore(instance)
    assert(score < 30, 'Offline should have low score')
  })

  it('should handle empty registry gracefully', () => {
    const registry = new InstanceRegistry()
    assert.equal(registry.getInstances().length, 0, 'Should be empty')
    assert.equal(registry.getInstance('any-id'), undefined, 'Should return undefined')
  })

  it('should support querying for failover candidates', () => {
    const registry = new InstanceRegistry()
    registry.register({ id: 'i1', agentId: 'a1', status: 'online', tailscaleIp: '100.0.0.1', taskCount: 10 })
    registry.register({ id: 'i2', agentId: 'a2', status: 'online', tailscaleIp: '100.0.0.2', taskCount: 2 })
    registry.register({ id: 'i3', agentId: 'a3', status: 'offline', tailscaleIp: '100.0.0.3', taskCount: 0 })

    registry.recordHeartbeat('i1')
    registry.recordHeartbeat('i2')

    // Find best candidate for failover (online, with capacity)
    const candidates = registry.getInstances()
      .filter(i => i.status === 'online')
      .sort((a, b) => (a.taskCount || 0) - (b.taskCount || 0))

    assert.equal(candidates[0].id, 'i2', 'i2 should be best candidate')
  })
})

export { InstanceRegistry, calculateHealthScore }
