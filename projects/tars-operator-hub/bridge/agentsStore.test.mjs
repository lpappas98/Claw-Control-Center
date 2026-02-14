import { describe, it, before, after } from 'node:test'
import * as assert from 'node:assert/strict'
import { AgentsStore } from './agentsStore.mjs'
import * as fs from 'node:fs/promises'

describe('AgentsStore', () => {
  const testFile = '.test-agents.json'

  after(async () => {
    try {
      await fs.unlink(testFile)
    } catch (e) {
      // ignore
    }
  })

  describe('agent registration', async () => {
    it('should register a new agent', async () => {
      const store = new AgentsStore(testFile)
      const agent = {
        id: 'dev-agent-1',
        name: 'Dev Agent',
        emoji: '👨‍💻',
        roles: ['backend-dev', 'api'],
        model: 'anthropic/claude-haiku',
        workspace: '/home/dev',
        status: 'online',
        instanceId: 'inst-001',
        tailscaleIP: '100.100.100.1',
      }

      const registered = await store.upsert(agent)

      assert.equal(registered.id, 'dev-agent-1')
      assert.equal(registered.name, 'Dev Agent')
      assert.ok(registered.createdAt)
      assert.ok(registered.updatedAt)
      assert.deepEqual(registered.activeTasks, [])
      assert.deepEqual(registered.metadata, {})
    })

    it('should update an existing agent', async () => {
      const store = new AgentsStore(testFile)
      const agent = {
        id: 'agent-1',
        name: 'First Name',
        emoji: '🤖',
        roles: ['backend-dev'],
        model: 'model-1',
        workspace: '/path/1',
        status: 'online',
        instanceId: 'inst-1',
        tailscaleIP: '100.0.0.1',
      }

      const first = await store.upsert(agent)
      const createdAtFirst = first.createdAt

      await new Promise(r => setTimeout(r, 10))
      const updated = await store.upsert({
        ...agent,
        name: 'Updated Name',
      })

      assert.equal(updated.name, 'Updated Name')
      assert.equal(updated.createdAt, createdAtFirst)
      assert.ok(updated.updatedAt > createdAtFirst)
    })
  })

  describe('status updates', async () => {
    it('should update agent status', async () => {
      const store = new AgentsStore(testFile)
      await store.upsert({
        id: 'agent-status',
        name: 'Status Agent',
        emoji: '🔄',
        roles: [],
        model: 'm',
        workspace: '/w',
        status: 'offline',
        instanceId: 'i',
        tailscaleIP: 'ip',
      })

      const updated = await store.updateStatus('agent-status', 'online')

      assert.equal(updated.status, 'online')
      assert.ok(updated.lastHeartbeat)
      assert.ok(updated.lastHeartbeat > 0)
    })

    it('should set current task when updating status', async () => {
      const store = new AgentsStore(testFile)
      await store.upsert({
        id: 'agent-task',
        name: 'Task Agent',
        emoji: '✅',
        roles: [],
        model: 'm',
        workspace: '/w',
        status: 'online',
        instanceId: 'i',
        tailscaleIP: 'ip',
      })

      const updated = await store.updateStatus('agent-task', 'busy', 'task-123')

      assert.equal(updated.status, 'busy')
      assert.equal(updated.currentTask, 'task-123')
    })
  })

  describe('role filtering', async () => {
    it('should get agents by role', async () => {
      const store = new AgentsStore(testFile)
      await store.upsert({
        id: 'backend-agent',
        name: 'Backend Dev',
        emoji: '🔧',
        roles: ['backend-dev', 'api'],
        model: 'm',
        workspace: '/w',
        status: 'online',
        instanceId: 'i1',
        tailscaleIP: 'ip1',
      })

      await store.upsert({
        id: 'offline-agent',
        name: 'Offline Dev',
        emoji: '⚫',
        roles: ['backend-dev'],
        model: 'm',
        workspace: '/w',
        status: 'offline',
        instanceId: 'i3',
        tailscaleIP: 'ip3',
      })

      const backendAgents = await store.getByRole('backend-dev')

      assert.equal(backendAgents.length, 2)
      assert.ok(backendAgents.some(a => a.id === 'backend-agent'))
      assert.ok(backendAgents.some(a => a.id === 'offline-agent'))
    })
  })

  describe('availability', async () => {
    it('should get available agents (online only)', async () => {
      const store = new AgentsStore(testFile)
      await store.upsert({
        id: 'online-agent',
        name: 'Online',
        emoji: '✅',
        roles: [],
        model: 'm',
        workspace: '/w',
        status: 'online',
        instanceId: 'i1',
        tailscaleIP: 'ip1',
      })

      await store.upsert({
        id: 'offline-agent',
        name: 'Offline',
        emoji: '⚫',
        roles: [],
        model: 'm',
        workspace: '/w',
        status: 'offline',
        instanceId: 'i3',
        tailscaleIP: 'ip3',
      })

      const available = await store.getAvailable()

      assert.equal(available.length, 1)
      assert.equal(available[0].id, 'online-agent')
    })
  })

  describe('workload tracking', async () => {
    it('should calculate workload', async () => {
      const store = new AgentsStore(testFile)
      await store.upsert({
        id: 'loaded-agent',
        name: 'Busy Agent',
        emoji: '🔥',
        roles: ['backend-dev'],
        model: 'm',
        workspace: '/w',
        status: 'online',
        instanceId: 'i',
        tailscaleIP: 'ip',
        activeTasks: ['task-1', 'task-2', 'task-3'],
      })

      const agent = await store.get('loaded-agent')
      const workload = store.getWorkload(agent)

      assert.equal(workload, 3)
    })

    it('should update active tasks', async () => {
      const store = new AgentsStore(testFile)
      await store.upsert({
        id: 'loaded-agent',
        name: 'Busy Agent',
        emoji: '🔥',
        roles: ['backend-dev'],
        model: 'm',
        workspace: '/w',
        status: 'online',
        instanceId: 'i',
        tailscaleIP: 'ip',
        activeTasks: ['task-1', 'task-2', 'task-3'],
      })

      const newTasks = ['task-a', 'task-b']
      const updated = await store.updateActiveTasks('loaded-agent', newTasks)

      assert.deepEqual(updated.activeTasks, newTasks)
    })
  })

  describe('best agent selection', async () => {
    it('should find best agent by workload', async () => {
      const store = new AgentsStore(testFile)
      await store.upsert({
        id: 'light-load',
        name: 'Light Load',
        emoji: '😌',
        roles: ['backend-dev'],
        model: 'm',
        workspace: '/w',
        status: 'online',
        instanceId: 'i1',
        tailscaleIP: 'ip1',
        activeTasks: ['task-1'],
      })

      await store.upsert({
        id: 'heavy-load',
        name: 'Heavy Load',
        emoji: '😫',
        roles: ['backend-dev'],
        model: 'm',
        workspace: '/w',
        status: 'online',
        instanceId: 'i2',
        tailscaleIP: 'ip2',
        activeTasks: ['task-1', 'task-2', 'task-3'],
      })

      const best = await store.findBestAgent('backend-dev')

      assert.equal(best.id, 'light-load')
    })

    it('should ignore offline agents', async () => {
      const store = new AgentsStore(testFile)
      await store.upsert({
        id: 'online-agent',
        name: 'Online',
        emoji: '✅',
        roles: ['backend-dev'],
        model: 'm',
        workspace: '/w',
        status: 'online',
        instanceId: 'i1',
        tailscaleIP: 'ip1',
        activeTasks: [],
      })

      await store.upsert({
        id: 'offline-agent',
        name: 'Offline',
        emoji: '⚫',
        roles: ['backend-dev'],
        model: 'm',
        workspace: '/w',
        status: 'offline',
        instanceId: 'i2',
        tailscaleIP: 'ip2',
        activeTasks: [],
      })

      const best = await store.findBestAgent('backend-dev')

      assert.notEqual(best.id, 'offline-agent')
      assert.equal(best.status, 'online')
    })

    it('should return null when no agents available', async () => {
      const store = new AgentsStore(testFile)

      const best = await store.findBestAgent('qa')

      assert.equal(best, null)
    })
  })

  describe('stale agent pruning', async () => {
    it('should remove stale agents', async () => {
      const store = new AgentsStore(testFile)
      const now = Date.now()
      const staleTime = now - 6 * 60 * 1000 // 6 minutes ago

      await store.upsert({
        id: 'stale-agent',
        name: 'Stale',
        emoji: '💀',
        roles: [],
        model: 'm',
        workspace: '/w',
        status: 'online',
        instanceId: 'i',
        tailscaleIP: 'ip',
        lastHeartbeat: staleTime,
      })

      await store.upsert({
        id: 'fresh-agent',
        name: 'Fresh',
        emoji: '🌟',
        roles: [],
        model: 'm',
        workspace: '/w',
        status: 'online',
        instanceId: 'i',
        tailscaleIP: 'ip',
        lastHeartbeat: now,
      })

      const removed = await store.pruneStale(5 * 60 * 1000) // 5 minute threshold

      assert.equal(removed, 1)
      const remaining = await store.getAll()
      assert.equal(remaining.length, 1)
      assert.equal(remaining[0].id, 'fresh-agent')
    })

    it('should keep agents that never heartbeated', async () => {
      const store = new AgentsStore(testFile)
      await store.upsert({
        id: 'no-heartbeat',
        name: 'New',
        emoji: '🆕',
        roles: [],
        model: 'm',
        workspace: '/w',
        status: 'online',
        instanceId: 'i',
        tailscaleIP: 'ip',
      })

      const removed = await store.pruneStale(5 * 60 * 1000)

      assert.equal(removed, 0)
      const agents = await store.getAll()
      assert.equal(agents.length, 1)
    })
  })

  describe('deletion', async () => {
    it('should delete an agent', async () => {
      const store = new AgentsStore(testFile)
      await store.upsert({
        id: 'delete-me',
        name: 'Deleted Agent',
        emoji: '🗑️',
        roles: [],
        model: 'm',
        workspace: '/w',
        status: 'online',
        instanceId: 'i',
        tailscaleIP: 'ip',
      })

      const deleted = await store.delete('delete-me')

      assert.equal(deleted, true)
      const remaining = await store.getAll()
      assert.equal(remaining.length, 0)
    })

    it('should return false for non-existent agent', async () => {
      const store = new AgentsStore(testFile)
      const deleted = await store.delete('non-existent')

      assert.equal(deleted, false)
    })
  })

  describe('persistence', async () => {
    it('should load agents from existing file', async () => {
      const store = new AgentsStore(testFile)
      await store.upsert({
        id: 'agent-1',
        name: 'Agent 1',
        emoji: '1️⃣',
        roles: [],
        model: 'm',
        workspace: '/w',
        status: 'online',
        instanceId: 'i',
        tailscaleIP: 'ip',
      })

      const store2 = new AgentsStore(testFile)
      const agents = await store2.load()

      assert.equal(agents.length, 1)
      assert.equal(agents[0].id, 'agent-1')
    })

    it('should handle missing file gracefully', async () => {
      const store = new AgentsStore('/nonexistent/path.json')
      const agents = await store.load()

      assert.deepEqual(agents, [])
      assert.equal(store.loaded, true)
    })
  })
})
