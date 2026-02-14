import { describe, it, after, before } from 'node:test'
import * as assert from 'node:assert/strict'
import { RoutineExecutor } from './routineExecutor.mjs'
import { RoutinesStore } from './routines.mjs'
import { TasksStore } from './tasksStore.mjs'
import { getAgentsStore } from './agentsStore.mjs'
import { getNotificationsStore } from './notificationsStore.mjs'
import * as fs from 'node:fs/promises'

describe('RoutineExecutor', () => {
  const testRoutinesFile = '.test-executor-routines.json'
  const testTasksFile = '.test-executor-tasks.json'
  const testAgentsFile = '.test-executor-agents.json'
  const testNotificationsFile = '.test-executor-notifications.json'

  let routinesStore, tasksStore, agentsStore, notificationsStore, executor

  before(async () => {
    routinesStore = new RoutinesStore(testRoutinesFile)
    tasksStore = new TasksStore(testTasksFile)
    agentsStore = getAgentsStore(testAgentsFile)
    notificationsStore = getNotificationsStore(testNotificationsFile)

    await routinesStore.load()
    await tasksStore.load()
    await agentsStore.load()
    await notificationsStore.load()

    executor = new RoutineExecutor(routinesStore, tasksStore, agentsStore, notificationsStore)
  })

  after(async () => {
    executor.stop()
    for (const file of [testRoutinesFile, testTasksFile, testAgentsFile, testNotificationsFile]) {
      try {
        await fs.unlink(file)
      } catch {
        // ignore
      }
    }
  })

  describe('executor lifecycle', () => {
    it('should start and stop executor', async () => {
      const exec = new RoutineExecutor(routinesStore, tasksStore, agentsStore, notificationsStore)
      assert.equal(exec.running, false)

      exec.start()
      assert.equal(exec.running, true)

      exec.stop()
      assert.equal(exec.running, false)
    })

    it('should not start if already running', () => {
      const exec = new RoutineExecutor(routinesStore, tasksStore, agentsStore, notificationsStore)
      exec.start()
      const interval1 = exec.checkInterval
      
      exec.start()
      const interval2 = exec.checkInterval

      exec.stop()
      assert.equal(interval1, interval2)
    })
  })

  describe('routine execution', () => {
    it('should execute due routine and create task', async () => {
      const routine = await routinesStore.createRoutine({
        name: 'Test execution',
        schedule: '0 * * * *',
        taskTemplate: {
          title: 'Auto task',
          description: 'Auto-created task',
          assignedTo: null,
          tags: ['auto']
        }
      })

      routine.nextRun = Date.now() - 1000
      routinesStore.routines[routinesStore.routines.length - 1].nextRun = routine.nextRun

      await executor.executeRoutine(routine)

      const tasks = await tasksStore.getAll()
      const created = tasks.find(t => t.title === 'Auto task')
      assert.ok(created)
      assert.ok(created.tags.includes('auto'))
    })

    it('should assign task to specific agent', async () => {
      const routine = await routinesStore.createRoutine({
        name: 'Agent assignment',
        schedule: '0 * * * *',
        taskTemplate: {
          title: 'Agent task',
          assignedTo: 'agent-alice',
          tags: ['important']
        }
      })

      await executor.executeRoutine(routine)

      const tasks = await tasksStore.getAll()
      const created = tasks.find(t => t.title === 'Agent task')
      assert.equal(created.assignedTo, 'agent-alice')
    })

    it('should update routine after execution', async () => {
      const routine = await routinesStore.createRoutine({
        name: 'Update test',
        schedule: '0 * * * *'
      })

      const oldLastRun = routine.lastRun

      routine.nextRun = Date.now() - 1000
      routinesStore.routines[routinesStore.routines.length - 1].nextRun = routine.nextRun

      await executor.executeRoutine(routine)

      const updated = await routinesStore.getRoutine(routine.id)
      assert.ok(updated.lastRun)
      assert.ok(updated.lastRun > Date.now() - 5000)
      assert.ok(oldLastRun === null)
      assert.ok(updated.nextRun > updated.lastRun)
    })

    it('should include routine info in task description', async () => {
      const routine = await routinesStore.createRoutine({
        name: 'Task description',
        schedule: '0 * * * *',
        taskTemplate: {
          title: 'Description test'
        }
      })

      routine.nextRun = Date.now() - 1000
      routinesStore.routines[routinesStore.routines.length - 1].nextRun = routine.nextRun

      await executor.executeRoutine(routine)

      const tasks = await tasksStore.getAll()
      const created = tasks.find(t => t.title === 'Description test')
      assert.ok(created.description.includes('routine') || created.description.includes('auto'))
    })
  })

  describe('task template handling', () => {
    it('should copy all template fields to task', async () => {
      const routine = await routinesStore.createRoutine({
        name: 'Template copy',
        schedule: '0 * * * *',
        taskTemplate: {
          title: 'Full template',
          description: 'Complete template',
          tags: ['tag1', 'tag2'],
          estimatedHours: 5
        }
      })

      routine.nextRun = Date.now() - 1000
      routinesStore.routines[routinesStore.routines.length - 1].nextRun = routine.nextRun

      await executor.executeRoutine(routine)

      const tasks = await tasksStore.getAll()
      const created = tasks.find(t => t.title === 'Full template')
      assert.ok(created.tags.includes('tag1'))
      assert.ok(created.tags.includes('tag2'))
      assert.equal(created.estimatedHours, 5)
    })

    it('should handle missing template fields', async () => {
      const routine = await routinesStore.createRoutine({
        name: 'Minimal template',
        schedule: '0 * * * *',
        taskTemplate: {
          title: 'Minimal'
        }
      })

      routine.nextRun = Date.now() - 1000
      routinesStore.routines[routinesStore.routines.length - 1].nextRun = routine.nextRun

      await executor.executeRoutine(routine)

      const tasks = await tasksStore.getAll()
      const created = tasks.find(t => t.title === 'Minimal')
      assert.ok(created)
      assert.deepEqual(created.tags, [])
    })
  })

  describe('check routines', () => {
    it('should check for due routines', async () => {
      await routinesStore.createRoutine({
        name: 'Check test 1',
        schedule: '0 * * * *'
      })

      const initialTaskCount = (await tasksStore.getAll()).length

      const r = await routinesStore.createRoutine({
        name: 'Check test 2',
        schedule: '0 * * * *'
      })
      r.nextRun = Date.now() - 1000
      routinesStore.routines[routinesStore.routines.length - 1].nextRun = r.nextRun

      await executor.checkRoutines()

      const finalTaskCount = (await tasksStore.getAll()).length
      assert.ok(finalTaskCount > initialTaskCount)
    })

    it('should handle multiple due routines', async () => {
      const r1 = await routinesStore.createRoutine({
        name: 'Multiple 1',
        schedule: '0 * * * *',
        taskTemplate: { title: 'Multi task 1' }
      })
      const r2 = await routinesStore.createRoutine({
        name: 'Multiple 2',
        schedule: '0 * * * *',
        taskTemplate: { title: 'Multi task 2' }
      })

      r1.nextRun = Date.now() - 1000
      r2.nextRun = Date.now() - 1000
      routinesStore.routines[routinesStore.routines.length - 2].nextRun = r1.nextRun
      routinesStore.routines[routinesStore.routines.length - 1].nextRun = r2.nextRun

      await executor.checkRoutines()

      const tasks = await tasksStore.getAll()
      const multi1 = tasks.find(t => t.title === 'Multi task 1')
      const multi2 = tasks.find(t => t.title === 'Multi task 2')
      assert.ok(multi1)
      assert.ok(multi2)
    })
  })

  describe('auto-assignment', () => {
    it('should auto-assign by role if no specific agent', async () => {
      const routine = await routinesStore.createRoutine({
        name: 'Auto assign',
        schedule: '0 * * * *',
        taskTemplate: {
          title: 'Designer task',
          assignedTo: 'designer'
        }
      })

      routine.nextRun = Date.now() - 1000
      routinesStore.routines[routinesStore.routines.length - 1].nextRun = routine.nextRun

      await executor.executeRoutine(routine)

      const tasks = await tasksStore.getAll()
      const created = tasks.find(t => t.title === 'Designer task')
      assert.ok(created)
      assert.ok(created.tags.includes('designer'))
    })
  })

  describe('error handling', () => {
    it('should not crash on invalid routine', async () => {
      const badRoutine = {
        id: 'bad-routine',
        name: 'Bad routine',
        schedule: '0 * * * *',
        taskTemplate: {},
        enabled: true
      }

      let error = null
      try {
        await executor.executeRoutine(badRoutine)
      } catch (err) {
        error = err
      }

      assert.equal(error, null)
    })

    it('should handle task creation failures gracefully', async () => {
      const routine = await routinesStore.createRoutine({
        name: 'Error test',
        schedule: '0 * * * *',
        taskTemplate: {}
      })

      const originalCreate = tasksStore.create
      tasksStore.create = async () => {
        throw new Error('Task creation failed')
      }

      let error = null
      try {
        await executor.executeRoutine(routine)
      } catch (err) {
        error = err
      }

      tasksStore.create = originalCreate

      assert.equal(error, null)
    })
  })
})
