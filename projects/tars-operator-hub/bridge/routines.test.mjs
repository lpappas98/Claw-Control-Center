import { describe, it, after } from 'node:test'
import * as assert from 'node:assert/strict'
import { RoutinesStore } from './routines.mjs'
import * as fs from 'node:fs/promises'

describe('RoutinesStore', () => {
  const testFile = '.test-routines.json'

  after(async () => {
    try {
      await fs.unlink(testFile)
    } catch {
      // ignore
    }
  })

  describe('routine creation', () => {
    it('should create a routine with valid schedule', async () => {
      const store = new RoutinesStore(testFile)
      const routine = await store.createRoutine({
        name: 'Daily standup',
        description: 'Morning standup meeting',
        schedule: '0 9 * * 1-5',
        taskTemplate: {
          title: 'Daily standup',
          description: 'Discuss progress and blockers',
          assignedTo: 'pm-1',
          tags: ['standup', 'meeting'],
          estimatedHours: 1
        }
      })

      assert.ok(routine.id)
      assert.ok(routine.id.startsWith('routine-'))
      assert.equal(routine.name, 'Daily standup')
      assert.equal(routine.schedule, '0 9 * * 1-5')
      assert.equal(routine.enabled, true)
      assert.ok(routine.createdAt)
      assert.ok(routine.nextRun)
      assert.equal(routine.lastRun, null)
    })

    it('should throw on invalid schedule', async () => {
      const store = new RoutinesStore(testFile)
      assert.rejects(
        () => store.createRoutine({
          name: 'Bad routine',
          schedule: 'invalid cron'
        }),
        /must have 5 fields/
      )
    })

    it('should set defaults for missing fields', async () => {
      const store = new RoutinesStore(testFile)
      const routine = await store.createRoutine({
        name: 'Minimal routine',
        schedule: '0 9 * * *'
      })

      assert.equal(routine.description, '')
      assert.deepEqual(routine.taskTemplate, {
        title: '',
        description: '',
        assignedTo: null,
        tags: [],
        estimatedHours: null
      })
      assert.equal(routine.enabled, true)
    })

    it('should calculate nextRun from cron schedule', async () => {
      const store = new RoutinesStore(testFile)
      const routine = await store.createRoutine({
        name: 'Test routine',
        schedule: '0 12 * * *'
      })

      assert.ok(routine.nextRun > Date.now())
    })
  })

  describe('routine retrieval', () => {
    it('should get routine by id', async () => {
      const store = new RoutinesStore(testFile)
      const created = await store.createRoutine({
        name: 'Get test',
        schedule: '0 * * * *'
      })

      const retrieved = await store.getRoutine(created.id)
      assert.equal(retrieved.id, created.id)
      assert.equal(retrieved.name, 'Get test')
    })

    it('should return null for non-existent routine', async () => {
      const store = new RoutinesStore(testFile)
      const routine = await store.getRoutine('non-existent')
      assert.equal(routine, null)
    })

    it('should get all routines', async () => {
      const store = new RoutinesStore(testFile)
      await store.createRoutine({
        name: 'Routine 1',
        schedule: '0 9 * * *'
      })
      await store.createRoutine({
        name: 'Routine 2',
        schedule: '0 12 * * *'
      })

      const all = await store.getAll()
      assert.ok(all.length >= 2)
    })

    it('should filter enabled routines', async () => {
      const store = new RoutinesStore(testFile)
      const r1 = await store.createRoutine({
        name: 'Enabled routine',
        schedule: '0 9 * * *',
        enabled: true
      })
      const r2 = await store.createRoutine({
        name: 'Disabled routine',
        schedule: '0 12 * * *',
        enabled: false
      })

      const enabled = await store.getAll(true)
      assert.ok(enabled.some(r => r.id === r1.id))
      assert.ok(!enabled.some(r => r.id === r2.id))
    })
  })

  describe('due routines', () => {
    it('should find routines that are due', async () => {
      const store = new RoutinesStore(testFile)
      
      const pastTime = new Date(Date.now() - 1000)
      const routine = await store.createRoutine({
        name: 'Past routine',
        schedule: '0 * * * *'
      })
      routine.nextRun = pastTime.getTime()
      store.routines[store.routines.length - 1].nextRun = routine.nextRun

      const due = await store.getDueRoutines()
      assert.ok(due.some(r => r.id === routine.id))
    })

    it('should not include disabled routines in due list', async () => {
      const store = new RoutinesStore(testFile)
      
      const routine = await store.createRoutine({
        name: 'Disabled routine',
        schedule: '0 * * * *',
        enabled: false
      })
      routine.nextRun = Date.now() - 1000
      store.routines[store.routines.length - 1].nextRun = routine.nextRun
      store.routines[store.routines.length - 1].enabled = false

      const due = await store.getDueRoutines()
      assert.ok(!due.some(r => r.id === routine.id))
    })
  })

  describe('routine update', () => {
    it('should update routine fields', async () => {
      const store = new RoutinesStore(testFile)
      const routine = await store.createRoutine({
        name: 'Original name',
        schedule: '0 9 * * *'
      })

      const updated = await store.updateRoutine(routine.id, {
        name: 'Updated name',
        description: 'New description'
      })

      assert.equal(updated.name, 'Updated name')
      assert.equal(updated.description, 'New description')
      assert.equal(updated.schedule, '0 9 * * *')
    })

    it('should update schedule and recalculate nextRun', async () => {
      const store = new RoutinesStore(testFile)
      const routine = await store.createRoutine({
        name: 'Schedule test',
        schedule: '0 9 * * *'
      })

      const oldSchedule = routine.schedule
      
      const updated = await store.updateRoutine(routine.id, {
        schedule: '0 18 * * *'
      })

      assert.notEqual(updated.schedule, oldSchedule)
      assert.equal(updated.schedule, '0 18 * * *')
    })

    it('should toggle enabled flag', async () => {
      const store = new RoutinesStore(testFile)
      const routine = await store.createRoutine({
        name: 'Toggle test',
        schedule: '0 * * * *',
        enabled: true
      })

      const disabled = await store.updateRoutine(routine.id, { enabled: false })
      assert.equal(disabled.enabled, false)

      const reenabled = await store.updateRoutine(routine.id, { enabled: true })
      assert.equal(reenabled.enabled, true)
    })

    it('should update task template', async () => {
      const store = new RoutinesStore(testFile)
      const routine = await store.createRoutine({
        name: 'Template test',
        schedule: '0 * * * *',
        taskTemplate: {
          title: 'Old title',
          description: 'Old description'
        }
      })

      const updated = await store.updateRoutine(routine.id, {
        taskTemplate: {
          title: 'New title',
          description: 'New description',
          assignedTo: 'dev-1',
          tags: ['important'],
          estimatedHours: 4
        }
      })

      assert.equal(updated.taskTemplate.title, 'New title')
      assert.equal(updated.taskTemplate.assignedTo, 'dev-1')
      assert.deepEqual(updated.taskTemplate.tags, ['important'])
      assert.equal(updated.taskTemplate.estimatedHours, 4)
    })

    it('should return null for non-existent routine', async () => {
      const store = new RoutinesStore(testFile)
      const result = await store.updateRoutine('non-existent', { name: 'Test' })
      assert.equal(result, null)
    })
  })

  describe('execution recording', () => {
    it('should record execution and update nextRun', async () => {
      const store = new RoutinesStore(testFile)
      const routine = await store.createRoutine({
        name: 'Exec test',
        schedule: '0 * * * *'
      })

      const wasNull = routine.lastRun === null
      
      const recorded = await store.recordExecution(routine.id)

      assert.equal(wasNull, true)
      assert.ok(recorded.lastRun > Date.now() - 1000)
      assert.ok(recorded.nextRun)
      assert.ok(recorded.nextRun > recorded.lastRun)
    })

    it('should return null for non-existent routine', async () => {
      const store = new RoutinesStore(testFile)
      const result = await store.recordExecution('non-existent')
      assert.equal(result, null)
    })
  })

  describe('deletion', () => {
    it('should delete routine', async () => {
      const store = new RoutinesStore(testFile)
      const routine = await store.createRoutine({
        name: 'Delete test',
        schedule: '0 * * * *'
      })

      const deleted = await store.deleteRoutine(routine.id)
      assert.equal(deleted, true)

      const retrieved = await store.getRoutine(routine.id)
      assert.equal(retrieved, null)
    })

    it('should return false for non-existent', async () => {
      const store = new RoutinesStore(testFile)
      const deleted = await store.deleteRoutine('non-existent')
      assert.equal(deleted, false)
    })
  })

  describe('persistence', () => {
    it('should persist routines to file', async () => {
      const store = new RoutinesStore(testFile)
      await store.createRoutine({
        name: 'Routine 1',
        schedule: '0 9 * * *'
      })
      await store.createRoutine({
        name: 'Routine 2',
        schedule: '0 12 * * *'
      })

      const store2 = new RoutinesStore(testFile)
      const routines = await store2.load()

      assert.ok(routines.length >= 2)
    })

    it('should handle missing file gracefully', async () => {
      const store = new RoutinesStore('/nonexistent/path.json')
      const routines = await store.load()

      assert.deepEqual(routines, [])
      assert.equal(store.loaded, true)
    })

    it('should generate unique routine IDs', async () => {
      const store = new RoutinesStore(testFile)
      const r1 = await store.createRoutine({ name: 'R1', schedule: '0 * * * *' })
      const r2 = await store.createRoutine({ name: 'R2', schedule: '0 * * * *' })
      const r3 = await store.createRoutine({ name: 'R3', schedule: '0 * * * *' })

      assert.notEqual(r1.id, r2.id)
      assert.notEqual(r2.id, r3.id)
    })
  })

  describe('common routines', () => {
    it('should create daily routine', async () => {
      const store = new RoutinesStore(testFile)
      const routine = await store.createRoutine({
        name: 'Daily task',
        schedule: '0 9 * * *'
      })

      assert.ok(routine.nextRun)
    })

    it('should create weekly routine', async () => {
      const store = new RoutinesStore(testFile)
      const routine = await store.createRoutine({
        name: 'Weekly meeting',
        schedule: '0 14 * * 1'
      })

      assert.ok(routine.nextRun)
    })

    it('should create monthly routine', async () => {
      const store = new RoutinesStore(testFile)
      const routine = await store.createRoutine({
        name: 'Monthly review',
        schedule: '0 10 1 * *'
      })

      assert.ok(routine.nextRun)
    })
  })
})
