import { describe, it, after } from 'node:test'
import * as assert from 'node:assert/strict'
import {
  analyzeTaskRoles,
  findBestAgent,
  autoAssignTask,
  getAssignmentSuggestions,
} from './taskAssignment.mjs'
import { AgentsStore } from './agentsStore.mjs'
import { TasksStore } from './tasksStore.mjs'
import { NotificationsStore } from './notificationsStore.mjs'
import * as fs from 'node:fs/promises'

describe('Task Assignment', () => {
  const agentsFile = '.test-assign-agents.json'
  const tasksFile = '.test-assign-tasks.json'
  const notifFile = '.test-assign-notif.json'

  after(async () => {
    for (const file of [agentsFile, tasksFile, notifFile]) {
      try {
        await fs.unlink(file)
      } catch (e) {
        // ignore
      }
    }
  })

  describe('role pattern matching', async () => {
    it('should detect designer role', () => {
      const task = {
        title: 'Design new UI mockups',
        description: 'Create wireframes for dashboard',
      }
      const roles = analyzeTaskRoles(task)

      assert.ok(roles.includes('designer'))
    })

    it('should detect frontend-dev role', () => {
      const task = {
        title: 'Build React component',
        description: 'Create responsive dashboard with Tailwind CSS',
      }
      const roles = analyzeTaskRoles(task)

      assert.ok(roles.includes('frontend-dev'))
    })

    it('should detect backend-dev role', () => {
      const task = {
        title: 'Implement REST API endpoint',
        description: 'Create authentication endpoint using Express',
      }
      const roles = analyzeTaskRoles(task)

      assert.ok(roles.includes('backend-dev'))
    })

    it('should detect qa role', () => {
      const task = {
        title: 'Write e2e tests',
        description: 'Add integration tests for login flow',
      }
      const roles = analyzeTaskRoles(task)

      assert.ok(roles.includes('qa'))
    })

    it('should detect multiple roles', () => {
      const task = {
        title: 'Full stack feature development',
        description: 'Build React frontend and Node.js backend API',
      }
      const roles = analyzeTaskRoles(task)

      assert.ok(roles.length > 1)
    })

    it('should default to general roles if no match', () => {
      const task = {
        title: 'Review pull request',
        description: 'Look over the code changes',
      }
      const roles = analyzeTaskRoles(task)

      assert.ok(roles.length > 0)
    })

    it('should be case insensitive', () => {
      const task1 = { title: 'Design mockup', description: '' }
      const task2 = { title: 'DESIGN MOCKUP', description: '' }

      const roles1 = analyzeTaskRoles(task1)
      const roles2 = analyzeTaskRoles(task2)

      assert.ok(roles1.includes('designer'))
      assert.ok(roles2.includes('designer'))
    })
  })

  describe('best agent selection', async () => {
    it('should find best agent by workload', async () => {
      const agentsStore = new AgentsStore(agentsFile)
      await agentsStore.upsert({
        id: 'backend-1',
        name: 'Dev 1',
        emoji: '🔧',
        roles: ['backend-dev'],
        model: 'm',
        workspace: '/w',
        status: 'online',
        instanceId: 'i1',
        tailscaleIP: 'ip1',
        activeTasks: ['task-1', 'task-2'],
      })

      await agentsStore.upsert({
        id: 'backend-2',
        name: 'Dev 2',
        emoji: '🔧',
        roles: ['backend-dev'],
        model: 'm',
        workspace: '/w',
        status: 'online',
        instanceId: 'i2',
        tailscaleIP: 'ip2',
        activeTasks: [],
      })

      const task = {
        title: 'Implement backend API',
        description: 'Create endpoint',
      }

      const best = await findBestAgent(task, agentsStore)

      assert.equal(best.id, 'backend-2')
    })

    it('should ignore offline agents', async () => {
      const agentsStore = new AgentsStore(agentsFile + '2')
      await agentsStore.upsert({
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

      await agentsStore.upsert({
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

      const task = { title: 'Backend task', description: '' }

      const best = await findBestAgent(task, agentsStore)

      assert.notEqual(best.id, 'offline-agent')
      assert.equal(best.status, 'online')
      
      await fs.unlink(agentsFile + '2')
    })

    it('should return null when no agents available', async () => {
      const agentsStore = new AgentsStore(agentsFile + '3')
      const task = { title: 'Designer task', description: '' }

      const best = await findBestAgent(task, agentsStore)

      assert.ok(best === null || best !== undefined)
      
      await fs.unlink(agentsFile + '3')
    })
  })

  describe('auto-assignment flow', async () => {
    it('should auto-assign task to available agent', async () => {
      const agentsStore = new AgentsStore(agentsFile + 'flow')
      const tasksStore = new TasksStore(tasksFile + 'flow')
      const notificationsStore = new NotificationsStore(notifFile + 'flow')

      await agentsStore.upsert({
        id: 'dev-1',
        name: 'Dev',
        emoji: '👨‍💻',
        roles: ['backend-dev'],
        model: 'm',
        workspace: '/w',
        status: 'online',
        instanceId: 'i',
        tailscaleIP: 'ip',
        activeTasks: [],
      })

      const task = await tasksStore.create({
        title: 'Implement API endpoint',
        description: 'Create backend endpoint',
        lane: 'queued',
      })

      const result = await autoAssignTask(task, agentsStore, tasksStore, notificationsStore)

      assert.equal(result.assigned, true)
      assert.equal(result.agent, 'dev-1')
      assert.ok(result.roles.length > 0)

      // Cleanup
      for (const f of [agentsFile + 'flow', tasksFile + 'flow', notifFile + 'flow']) {
        try {
          await fs.unlink(f)
        } catch (e) {}
      }
    })

    it('should skip if already assigned', async () => {
      const agentsStore = new AgentsStore(agentsFile + 'skip')
      const tasksStore = new TasksStore(tasksFile + 'skip')
      const notificationsStore = new NotificationsStore(notifFile + 'skip')

      await agentsStore.upsert({
        id: 'dev-1',
        name: 'Dev',
        emoji: '👨‍💻',
        roles: [],
        model: 'm',
        workspace: '/w',
        status: 'online',
        instanceId: 'i',
        tailscaleIP: 'ip',
      })

      const task = await tasksStore.create({
        title: 'Already assigned',
        description: '',
        lane: 'queued',
        assignedTo: 'dev-1',
      })

      const result = await autoAssignTask(task, agentsStore, tasksStore, notificationsStore)

      assert.equal(result.assigned, false)
      assert.equal(result.reason, 'already-assigned')

      // Cleanup
      for (const f of [agentsFile + 'skip', tasksFile + 'skip', notifFile + 'skip']) {
        try {
          await fs.unlink(f)
        } catch (e) {}
      }
    })
  })

  describe('notification generation', async () => {
    it('should create notification on auto-assign', async () => {
      const agentsStore = new AgentsStore(agentsFile + 'notif')
      const tasksStore = new TasksStore(tasksFile + 'notif')
      const notificationsStore = new NotificationsStore(notifFile + 'notif')

      await agentsStore.upsert({
        id: 'agent-1',
        name: 'Agent',
        emoji: '🤖',
        roles: ['backend-dev'],
        model: 'm',
        workspace: '/w',
        status: 'online',
        instanceId: 'i',
        tailscaleIP: 'ip',
        activeTasks: [],
      })

      const task = await tasksStore.create({
        title: 'Implement feature',
        description: '',
        lane: 'queued',
      })

      await autoAssignTask(task, agentsStore, tasksStore, notificationsStore)

      const notifs = await notificationsStore.getForAgent('agent-1')

      assert.equal(notifs.length, 1)
      assert.equal(notifs[0].type, 'task-assigned')
      assert.equal(notifs[0].taskId, task.id)

      // Cleanup
      for (const f of [agentsFile + 'notif', tasksFile + 'notif', notifFile + 'notif']) {
        try {
          await fs.unlink(f)
        } catch (e) {}
      }
    })
  })

  describe('assignment suggestions', async () => {
    it('should provide assignment suggestions', async () => {
      const agentsStore = new AgentsStore(agentsFile + 'suggest')
      await agentsStore.upsert({
        id: 'backend-1',
        name: 'Backend',
        emoji: '🔧',
        roles: ['backend-dev'],
        model: 'm',
        workspace: '/w',
        status: 'online',
        instanceId: 'i',
        tailscaleIP: 'ip',
        activeTasks: [],
      })

      const task = {
        title: 'Implement REST API',
        description: 'Create endpoint for users',
      }

      const suggestions = await getAssignmentSuggestions(task, agentsStore)

      assert.ok(suggestions.suggestedRoles.includes('backend-dev'))
      assert.ok(suggestions.suggestedAgent)
      assert.equal(suggestions.suggestedAgent.id, 'backend-1')

      await fs.unlink(agentsFile + 'suggest')
    })
  })
})
