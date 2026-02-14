import { describe, it, after } from 'node:test'
import * as assert from 'node:assert/strict'
import { TasksStore, makeTaskId } from './tasksStore.mjs'
import * as fs from 'node:fs/promises'

describe('Time Tracking - TasksStore', () => {
  const testFile = '.test-time-tracking.json'

  after(async () => {
    try {
      await fs.unlink(testFile)
    } catch (e) {
      // ignore
    }
  })

  describe('logTime()', () => {
    it('should add a time entry to a task', async () => {
      const store = new TasksStore(testFile)
      const task = await store.create({
        title: 'Implement feature',
        description: 'Build new feature'
      })

      const updated = await store.logTime(task.id, 'agent-1', 2.5)
      
      assert.ok(updated)
      assert.equal(updated.timeEntries.length, 1)
      assert.equal(updated.timeEntries[0].agentId, 'agent-1')
      assert.equal(updated.timeEntries[0].hours, 2.5)
      assert.ok(updated.timeEntries[0].start)
      assert.ok(updated.timeEntries[0].end)
    })

    it('should accumulate actualHours from multiple time entries', async () => {
      const store = new TasksStore(testFile)
      const task = await store.create({
        title: 'Work on task'
      })

      await store.logTime(task.id, 'agent-1', 2)
      await store.logTime(task.id, 'agent-2', 3)
      const final = await store.logTime(task.id, 'agent-1', 1.5)

      assert.equal(final.actualHours, 6.5)
      assert.equal(final.timeEntries.length, 3)
    })

    it('should support start and end timestamps', async () => {
      const store = new TasksStore(testFile)
      const task = await store.create({
        title: 'Timed work'
      })

      const now = Date.now()
      const twoHoursAgo = now - (2 * 60 * 60 * 1000)

      const updated = await store.logTime(
        task.id,
        'agent-1',
        2,
        twoHoursAgo,
        now
      )

      assert.equal(updated.timeEntries[0].start, twoHoursAgo)
      assert.equal(updated.timeEntries[0].end, now)
    })

    it('should support optional note field', async () => {
      const store = new TasksStore(testFile)
      const task = await store.create({
        title: 'Task with note'
      })

      const updated = await store.logTime(
        task.id,
        'agent-1',
        1.5,
        null,
        null,
        'Completed implementation phase'
      )

      assert.equal(updated.timeEntries[0].note, 'Completed implementation phase')
    })

    it('should return null for non-existent task', async () => {
      const store = new TasksStore(testFile)
      const result = await store.logTime('non-existent', 'agent-1', 1)
      assert.equal(result, null)
    })

    it('should update the updatedAt timestamp', async () => {
      const store = new TasksStore(testFile)
      const task = await store.create({
        title: 'Update test'
      })

      const originalUpdated = task.updatedAt
      await new Promise(resolve => setTimeout(resolve, 10))

      const updated = await store.logTime(task.id, 'agent-1', 1)
      assert.ok(updated.updatedAt > originalUpdated)
    })

    it('should persist time entries to disk', async () => {
      const store1 = new TasksStore(testFile)
      const task = await store1.create({
        title: 'Persistent task'
      })
      await store1.logTime(task.id, 'agent-1', 3)

      // Load from disk with new store instance
      const store2 = new TasksStore(testFile)
      const loaded = await store2.get(task.id)

      assert.ok(loaded)
      assert.equal(loaded.timeEntries.length, 1)
      assert.equal(loaded.timeEntries[0].hours, 3)
      assert.equal(loaded.actualHours, 3)
    })
  })

  describe('getTimeEntries()', () => {
    it('should retrieve all time entries for a task', async () => {
      const store = new TasksStore(testFile)
      const task = await store.create({
        title: 'Multi-entry task'
      })

      await store.logTime(task.id, 'agent-1', 2, null, null, 'First session')
      await store.logTime(task.id, 'agent-2', 1.5, null, null, 'Second session')
      await store.logTime(task.id, 'agent-1', 0.5, null, null, 'Third session')

      const entries = await store.getTimeEntries(task.id)

      assert.equal(entries.length, 3)
      assert.equal(entries[0].hours, 2)
      assert.equal(entries[1].hours, 1.5)
      assert.equal(entries[2].hours, 0.5)
    })

    it('should return empty array for task with no time entries', async () => {
      const store = new TasksStore(testFile)
      const task = await store.create({
        title: 'No time task'
      })

      const entries = await store.getTimeEntries(task.id)
      assert.equal(entries.length, 0)
    })

    it('should return empty array for non-existent task', async () => {
      const store = new TasksStore(testFile)
      const entries = await store.getTimeEntries('non-existent')
      assert.deepEqual(entries, [])
    })

    it('should preserve entry metadata', async () => {
      const store = new TasksStore(testFile)
      const task = await store.create({
        title: 'Metadata test'
      })

      const start = Date.now() - 3600000
      const end = Date.now()
      const note = 'Fixed critical bug and added tests'

      await store.logTime(task.id, 'agent-xyz', 1.25, start, end, note)

      const entries = await store.getTimeEntries(task.id)
      const entry = entries[0]

      assert.equal(entry.agentId, 'agent-xyz')
      assert.equal(entry.hours, 1.25)
      assert.equal(entry.start, start)
      assert.equal(entry.end, end)
      assert.equal(entry.note, note)
    })
  })

  describe('Integration: Timer workflow', () => {
    it('should handle complete timer workflow: start -> multiple logs -> total hours', async () => {
      const store = new TasksStore(testFile)
      const task = await store.create({
        title: 'Feature development',
        estimatedHours: 8
      })

      const agentId = 'dev-agent-1'
      const now = Date.now()

      // Simulate work session 1: 2 hours
      await store.logTime(
        task.id,
        agentId,
        2,
        now - 2 * 3600000,
        now - 1800000,
        'Initial implementation'
      )

      // Simulate work session 2: 1.5 hours
      await store.logTime(
        task.id,
        agentId,
        1.5,
        now - 1800000,
        now - 300000,
        'Code review and fixes'
      )

      // Verify accumulated time
      const updated = await store.get(task.id)
      assert.equal(updated.actualHours, 3.5)
      assert.equal(updated.timeEntries.length, 2)

      // Get all entries
      const entries = await store.getTimeEntries(task.id)
      assert.equal(entries.length, 2)

      const totalLogged = entries.reduce((sum, e) => sum + e.hours, 0)
      assert.equal(totalLogged, 3.5)
    })

    it('should support multiple agents logging time on same task', async () => {
      const store = new TasksStore(testFile)
      const task = await store.create({
        title: 'Collaborative task'
      })

      const now = Date.now()

      // Backend dev logs time
      await store.logTime(task.id, 'backend-dev', 3, now - 10800000, now - 7200000)
      
      // Frontend dev logs time
      await store.logTime(task.id, 'frontend-dev', 2.5, now - 7200000, now - 4500000)
      
      // QA logs time for testing
      await store.logTime(task.id, 'qa-agent', 1, now - 1800000, now)

      const entries = await store.getTimeEntries(task.id)
      assert.equal(entries.length, 3)

      const uniqueAgents = new Set(entries.map(e => e.agentId))
      assert.equal(uniqueAgents.size, 3)

      const total = entries.reduce((sum, e) => sum + e.hours, 0)
      assert.equal(total, 6.5)
    })
  })

  describe('Edge cases', () => {
    it('should handle very small time entries (minutes)', async () => {
      const store = new TasksStore(testFile)
      const task = await store.create({
        title: 'Quick fix'
      })

      await store.logTime(task.id, 'agent-1', 0.25) // 15 minutes
      const updated = await store.get(task.id)
      assert.equal(updated.actualHours, 0.25)
    })

    it('should handle large time entries', async () => {
      const store = new TasksStore(testFile)
      const task = await store.create({
        title: 'Big project'
      })

      await store.logTime(task.id, 'agent-1', 40) // Full work week
      const updated = await store.get(task.id)
      assert.equal(updated.actualHours, 40)
    })

    it('should handle decimal precision', async () => {
      const store = new TasksStore(testFile)
      const task = await store.create({
        title: 'Precision test'
      })

      await store.logTime(task.id, 'agent-1', 1.333333)
      await store.logTime(task.id, 'agent-1', 2.666667)

      const updated = await store.get(task.id)
      const expected = 1.333333 + 2.666667
      assert.ok(Math.abs(updated.actualHours - expected) < 0.0001)
    })

    it('should initialize timeEntries array if missing', async () => {
      const store = new TasksStore(testFile)
      const task = await store.create({
        title: 'Test task'
      })

      // Task should have timeEntries array after creation
      const freshTask = await store.get(task.id)
      assert.ok(Array.isArray(freshTask.timeEntries))
      assert.equal(freshTask.timeEntries.length, 0)

      // First logTime should work correctly
      const updated = await store.logTime(task.id, 'agent-1', 1)
      assert.equal(updated.timeEntries.length, 1)
    })
  })
})
