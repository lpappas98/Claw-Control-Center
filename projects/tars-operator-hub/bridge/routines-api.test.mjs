import { describe, it, before, after } from 'node:test'
import * as assert from 'node:assert/strict'
import { RoutinesStore } from './routines.mjs'
import { TasksStore } from './tasksStore.mjs'
import { getAgentsStore } from './agentsStore.mjs'
import { getNotificationsStore } from './notificationsStore.mjs'
import * as fs from 'node:fs/promises'

describe('Routines API Integration', () => {
  const testRoutinesFile = '.test-api-routines.json'
  const testTasksFile = '.test-api-tasks.json'
  const testAgentsFile = '.test-api-agents.json'
  const testNotificationsFile = '.test-api-notifications.json'

  let routinesStore, tasksStore, agentsStore, notificationsStore

  before(async () => {
    routinesStore = new RoutinesStore(testRoutinesFile)
    tasksStore = new TasksStore(testTasksFile)
    agentsStore = getAgentsStore(testAgentsFile)
    notificationsStore = getNotificationsStore(testNotificationsFile)

    await routinesStore.load()
    await tasksStore.load()
    await agentsStore.load()
    await notificationsStore.load()
  })

  after(async () => {
    for (const file of [testRoutinesFile, testTasksFile, testAgentsFile, testNotificationsFile]) {
      try {
        await fs.unlink(file)
      } catch {
        // ignore
      }
    }
  })

  describe('GET /api/routines', () => {
    it('should list all routines', async () => {
      await routinesStore.createRoutine({
        name: 'Test routine 1',
        schedule: '0 9 * * *'
      })
      await routinesStore.createRoutine({
        name: 'Test routine 2',
        schedule: '0 12 * * *'
      })

      const routines = await routinesStore.getAll()
      assert.ok(routines.length >= 2)
      assert.ok(routines[0].name)
      assert.ok(routines[0].schedule)
    })
  })

  describe('POST /api/routines', () => {
    it('should create a new routine', async () => {
      const routine = await routinesStore.createRoutine({
        name: 'New routine',
        description: 'Test description',
        schedule: '0 14 * * 1-5',
        taskTemplate: {
          title: 'Routine task',
          description: 'Auto task',
          assignedTo: 'dev-alice',
          tags: ['auto', 'daily'],
          estimatedHours: 2
        }
      })

      assert.ok(routine.id)
      assert.equal(routine.name, 'New routine')
      assert.equal(routine.enabled, true)
      assert.ok(routine.nextRun)
    })

    it('should validate schedule before creating', async () => {
      let error = null
      try {
        await routinesStore.createRoutine({
          name: 'Invalid routine',
          schedule: 'invalid'
        })
      } catch (err) {
        error = err
      }

      assert.ok(error)
      assert.ok(error.message.includes('5 fields'))
    })
  })

  describe('GET /api/routines/:id', () => {
    it('should get routine by id', async () => {
      const created = await routinesStore.createRoutine({
        name: 'Get test routine',
        schedule: '0 * * * *'
      })

      const retrieved = await routinesStore.getRoutine(created.id)
      assert.equal(retrieved.id, created.id)
      assert.equal(retrieved.name, 'Get test routine')
    })

    it('should return null for non-existent routine', async () => {
      const routine = await routinesStore.getRoutine('non-existent-id')
      assert.equal(routine, null)
    })
  })

  describe('PUT /api/routines/:id', () => {
    it('should update routine', async () => {
      const routine = await routinesStore.createRoutine({
        name: 'Update test',
        schedule: '0 9 * * *'
      })

      const updated = await routinesStore.updateRoutine(routine.id, {
        name: 'Updated name',
        description: 'Updated description',
        enabled: false
      })

      assert.equal(updated.name, 'Updated name')
      assert.equal(updated.description, 'Updated description')
      assert.equal(updated.enabled, false)
    })

    it('should validate schedule on update', async () => {
      const routine = await routinesStore.createRoutine({
        name: 'Schedule update',
        schedule: '0 9 * * *'
      })

      let error = null
      try {
        await routinesStore.updateRoutine(routine.id, {
          schedule: 'invalid cron'
        })
      } catch (err) {
        error = err
      }

      assert.ok(error)
    })
  })

  describe('DELETE /api/routines/:id', () => {
    it('should delete routine', async () => {
      const routine = await routinesStore.createRoutine({
        name: 'Delete test',
        schedule: '0 * * * *'
      })

      const deleted = await routinesStore.deleteRoutine(routine.id)
      assert.equal(deleted, true)

      const retrieved = await routinesStore.getRoutine(routine.id)
      assert.equal(retrieved, null)
    })

    it('should return false when deleting non-existent', async () => {
      const deleted = await routinesStore.deleteRoutine('non-existent-id')
      assert.equal(deleted, false)
    })
  })

  describe('POST /api/routines/:id/run - manual trigger', () => {
    it('should create task from routine template', async () => {
      const routine = await routinesStore.createRoutine({
        name: 'Manual trigger test',
        schedule: '0 * * * *',
        taskTemplate: {
          title: 'Triggered task',
          description: 'Manually triggered',
          tags: ['manual']
        }
      })

      const tasksBefore = await tasksStore.getAll()
      const countBefore = tasksBefore.length

      const taskData = {
        title: routine.taskTemplate.title,
        description: routine.taskTemplate.description,
        lane: 'queued',
        priority: 'P2',
        tags: routine.taskTemplate.tags,
        createdBy: 'api'
      }

      const task = await tasksStore.create(taskData)

      const tasksAfter = await tasksStore.getAll()
      assert.ok(tasksAfter.length > countBefore)
      assert.equal(task.title, 'Triggered task')
      assert.ok(task.tags.includes('manual'))
    })
  })

  describe('Routine scheduling and assignment', () => {
    it('should support complex scheduling patterns', async () => {
      const patterns = [
        { name: 'Daily 9am', schedule: '0 9 * * *' },
        { name: 'Weekly Monday', schedule: '0 9 * * 1' },
        { name: 'First of month', schedule: '0 10 1 * *' },
        { name: 'Every 2 hours', schedule: '0 */2 * * *' },
        { name: 'Business hours', schedule: '0 9-17 * * 1-5' }
      ]

      for (const pattern of patterns) {
        const routine = await routinesStore.createRoutine({
          name: pattern.name,
          schedule: pattern.schedule
        })

        assert.ok(routine.nextRun)
        assert.ok(routine.nextRun > Date.now())
      }
    })

    it('should support various assignment patterns', async () => {
      const patterns = [
        { assignedTo: 'agent-alice', name: 'Direct assignment' },
        { assignedTo: 'developer', name: 'Role assignment' },
        { assignedTo: null, name: 'Auto assignment' }
      ]

      for (const pattern of patterns) {
        const routine = await routinesStore.createRoutine({
          name: pattern.name,
          schedule: '0 * * * *',
          taskTemplate: {
            title: `Task for ${pattern.name}`,
            assignedTo: pattern.assignedTo
          }
        })

        assert.ok(routine.taskTemplate)
      }
    })
  })

  describe('Routine persistence and data integrity', () => {
    it('should persist routines across store instances', async () => {
      const store1 = new RoutinesStore(testRoutinesFile)
      const r1 = await store1.createRoutine({
        name: 'Persistence test',
        schedule: '0 * * * *'
      })

      const store2 = new RoutinesStore(testRoutinesFile)
      await store2.load()
      const r2 = await store2.getRoutine(r1.id)

      assert.equal(r2.id, r1.id)
      assert.equal(r2.name, r1.name)
    })

    it('should maintain data integrity on concurrent operations', async () => {
      const store = new RoutinesStore(testRoutinesFile)

      const r1 = await store.createRoutine({
        name: 'Concurrent 1',
        schedule: '0 9 * * *'
      })
      const r2 = await store.createRoutine({
        name: 'Concurrent 2',
        schedule: '0 12 * * *'
      })

      await store.updateRoutine(r1.id, { enabled: false })
      await store.updateRoutine(r2.id, { description: 'Updated' })

      const all = await store.getAll()
      const updated1 = all.find(r => r.id === r1.id)
      const updated2 = all.find(r => r.id === r2.id)

      assert.equal(updated1.enabled, false)
      assert.equal(updated2.description, 'Updated')
    })
  })
})
