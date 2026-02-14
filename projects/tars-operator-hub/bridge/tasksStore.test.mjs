import { describe, it, after } from 'node:test'
import * as assert from 'node:assert/strict'
import { TasksStore, makeTaskId, normalizeLane, normalizePriority } from './tasksStore.mjs'
import * as fs from 'node:fs/promises'

describe('TasksStore', () => {
  const testFile = '.test-tasks.json'

  after(async () => {
    try {
      await fs.unlink(testFile)
    } catch (e) {
      // ignore
    }
  })

  // Helper to create a fresh store for each test
  async function createFreshStore() {
    try {
      await fs.unlink(testFile)
    } catch (e) {
      // ignore
    }
    return new TasksStore(testFile)
  }

  describe('task creation', async () => {
    it('should create a new task', async () => {
      const store = await createFreshStore()
      const task = await store.create({
        title: 'Implement login form',
        description: 'Build React component for user login',
        lane: 'queued',
        priority: 'P1',
        tags: ['frontend', 'ui'],
      })

      assert.ok(task.id)
      assert.equal(task.title, 'Implement login form')
      assert.equal(task.lane, 'queued')
      assert.equal(task.priority, 'P1')
      assert.deepEqual(task.tags, ['frontend', 'ui'])
      assert.ok(task.createdAt)
      assert.equal(task.comments.length, 0)
    })

    it('should normalize lane and priority', async () => {
      const store = await createFreshStore()
      const task = await store.create({
        title: 'Test task',
        lane: 'DEVELOPMENT',
        priority: 'p2',
      })

      assert.equal(task.lane, 'development')
      assert.equal(task.priority, 'P2')
    })

    it('should initialize status history', async () => {
      const store = await createFreshStore()
      const task = await store.create({
        title: 'Task with history',
        lane: 'development',
      })

      assert.ok(task.statusHistory)
      assert.equal(task.statusHistory.length, 1)
      assert.equal(task.statusHistory[0].to, 'development')
    })
  })

  describe('task updates', async () => {
    it('should update task fields', async () => {
      const store = await createFreshStore()
      const task = await store.create({ title: 'Initial' })

      const updated = await store.update(task.id, {
        title: 'Updated title',
        priority: 'P0',
      })

      assert.equal(updated.title, 'Updated title')
      assert.equal(updated.priority, 'P0')
    })

    it('should track lane changes in status history', async () => {
      const store = await createFreshStore()
      const task = await store.create({ title: 'Task', lane: 'queued' })

      const updated = await store.update(task.id, {
        lane: 'development',
      })

      assert.equal(updated.statusHistory.length, 2)
      assert.equal(updated.statusHistory[1].from, 'queued')
      assert.equal(updated.statusHistory[1].to, 'development')
    })

    it('should return null for non-existent task', async () => {
      const store = await createFreshStore()
      const result = await store.update('non-existent', { title: 'New' })

      assert.equal(result, null)
    })
  })

  describe('task assignment', async () => {
    it('should assign task to agent', async () => {
      const store = await createFreshStore()
      const task = await store.create({ title: 'Task' })

      const updated = await store.assign(task.id, 'agent-123')

      assert.equal(updated.assignedTo, 'agent-123')
    })
  })

  describe('comments', async () => {
    it('should add comment to task', async () => {
      const store = await createFreshStore()
      const task = await store.create({ title: 'Task' })

      const updated = await store.addComment(task.id, 'Great work!', 'user-1')

      assert.equal(updated.comments.length, 1)
      assert.equal(updated.comments[0].text, 'Great work!')
      assert.equal(updated.comments[0].by, 'user-1')
    })

    it('should add multiple comments', async () => {
      const store = await createFreshStore()
      const task = await store.create({ title: 'Task' })

      await store.addComment(task.id, 'First', 'user-1')
      const updated = await store.addComment(task.id, 'Second', 'user-2')

      assert.equal(updated.comments.length, 2)
    })
  })

  describe('time tracking', async () => {
    it('should log time entry', async () => {
      const store = await createFreshStore()
      const task = await store.create({ title: 'Task' })

      const updated = await store.logTime(task.id, 'agent-1', 2.5)

      assert.equal(updated.timeEntries.length, 1)
      assert.equal(updated.timeEntries[0].agentId, 'agent-1')
      assert.equal(updated.timeEntries[0].hours, 2.5)
    })

    it('should accumulate actual hours', async () => {
      const store = await createFreshStore()
      const task = await store.create({ title: 'Task' })

      await store.logTime(task.id, 'agent-1', 2)
      const updated = await store.logTime(task.id, 'agent-2', 3.5)

      assert.equal(updated.actualHours, 5.5)
    })
  })

  describe('subtasks', async () => {
    it('should get subtasks', async () => {
      const store = await createFreshStore()
      const parent = await store.create({ title: 'Parent' })
      const child = await store.create({ title: 'Child', parentId: parent.id })

      const subtasks = await store.getSubtasks(parent.id)

      assert.equal(subtasks.length, 1)
      assert.equal(subtasks[0].id, child.id)
    })

    it('should return empty for task with no subtasks', async () => {
      const store = await createFreshStore()
      const task = await store.create({ title: 'Task' })

      const subtasks = await store.getSubtasks(task.id)

      assert.equal(subtasks.length, 0)
    })
  })

  describe('dependencies', async () => {
    it('should get dependencies', async () => {
      const store = await createFreshStore()
      const taskA = await store.create({ title: 'A' })
      const taskB = await store.create({ title: 'B', dependsOn: [taskA.id] })

      const deps = await store.getDependencies(taskB.id)

      assert.equal(deps.length, 1)
      assert.equal(deps[0].id, taskA.id)
    })

    it('should get blocker tasks', async () => {
      const store = await createFreshStore()
      const taskA = await store.create({ title: 'A' })
      const taskB = await store.create({ title: 'B', dependsOn: [taskA.id] })

      const blockers = await store.getBlockerTasks(taskB.id)

      assert.equal(blockers.length, 1)
      assert.equal(blockers[0].id, taskA.id)
    })

    it('should update dependencies', async () => {
      const store = await createFreshStore()
      const taskA = await store.create({ title: 'A' })
      const taskB = await store.create({ title: 'B', dependsOn: [taskA.id] })

      const updated = await store.updateDependencies(taskB.id, [])

      assert.deepEqual(updated.dependsOn, [])
    })

    it('should prevent circular dependencies', async () => {
      const store = await createFreshStore()
      const taskA = await store.create({ title: 'A' })
      const taskB = await store.create({ title: 'B', dependsOn: [taskA.id] })

      let threw = false
      try {
        await store.updateDependencies(taskA.id, [taskB.id])
      } catch (e) {
        threw = true
        assert.match(e.message, /Circular dependency detected/)
      }
      assert.ok(threw, 'Should have thrown circular dependency error')
    })

    it('should prevent self-dependencies', async () => {
      const store = await createFreshStore()
      const taskA = await store.create({ title: 'A' })

      let threw = false
      try {
        await store.updateDependencies(taskA.id, [taskA.id])
      } catch (e) {
        threw = true
        assert.match(e.message, /Circular dependency detected/)
      }
      assert.ok(threw, 'Should have thrown circular dependency error')
    })

    it('should handle multiple dependencies', async () => {
      const store = await createFreshStore()
      const taskA = await store.create({ title: 'A' })
      const taskB = await store.create({ title: 'B' })
      const taskC = await store.create({ title: 'C', dependsOn: [taskA.id, taskB.id] })

      const deps = await store.getDependencies(taskC.id)

      assert.equal(deps.length, 2)
    })
  })

  describe('blocking relationships', async () => {
    it('should auto-unblock tasks on completion', async () => {
      const store = await createFreshStore()
      const blocker = await store.create({
        title: 'Blocker',
        blocks: [],
      })

      const blocked = await store.create({
        title: 'Blocked',
        lane: 'blocked',
        dependsOn: [blocker.id],
      })

      await store.update(blocker.id, { blocks: [blocked.id] })

      const unblocked = await store.handleCompletion(blocker.id)

      assert.equal(unblocked.length, 1)
      const updated = await store.get(blocked.id)
      assert.equal(updated.lane, 'queued')
      assert.equal(updated.dependsOn.length, 0)
    })

    it('should get blocked tasks', async () => {
      const store = await createFreshStore()
      const blocker = await store.create({ title: 'Blocker', blocks: [] })
      const blocked1 = await store.create({ title: 'Blocked 1' })
      const blocked2 = await store.create({ title: 'Blocked 2' })

      await store.update(blocker.id, { blocks: [blocked1.id, blocked2.id] })

      const blocked = await store.getBlockedTasks(blocker.id)

      assert.equal(blocked.length, 2)
    })

    it('should handle multiple blockers for same task', async () => {
      const store = await createFreshStore()
      const blocker1 = await store.create({ title: 'Blocker 1' })
      const blocker2 = await store.create({ title: 'Blocker 2' })
      const blocked = await store.create({
        title: 'Blocked',
        lane: 'blocked',
        dependsOn: [blocker1.id, blocker2.id],
      })

      await store.update(blocker1.id, { blocks: [blocked.id] })
      await store.update(blocker2.id, { blocks: [blocked.id] })

      // Complete first blocker
      const unblocked1 = await store.handleCompletion(blocker1.id)
      assert.equal(unblocked1.length, 1)

      // Task should still be blocked with one remaining dependency
      const check = await store.get(blocked.id)
      assert.equal(check.dependsOn.length, 1)
      // Lane should remain blocked since there are still dependencies
      assert.equal(check.lane, 'blocked')

      // Complete second blocker
      const unblocked2 = await store.handleCompletion(blocker2.id)
      assert.equal(unblocked2.length, 1)

      // Now task should be unblocked and moved to queued
      const finalCheck = await store.get(blocked.id)
      assert.equal(finalCheck.dependsOn.length, 0)
      assert.equal(finalCheck.lane, 'queued')
    })

    it('should not unblock if task has other dependencies', async () => {
      const store = await createFreshStore()
      const blocker1 = await store.create({ title: 'Blocker 1' })
      const blocker2 = await store.create({ title: 'Blocker 2' })
      const blocked = await store.create({
        title: 'Blocked',
        lane: 'blocked',
        dependsOn: [blocker1.id, blocker2.id],
      })

      await store.update(blocker1.id, { blocks: [blocked.id] })

      await store.handleCompletion(blocker1.id)

      const updated = await store.get(blocked.id)
      assert.equal(updated.lane, 'blocked')
      assert.equal(updated.dependsOn.length, 1)
    })
  })

  describe('filtering', async () => {
    it('should filter by lane', async () => {
      const store = await createFreshStore()
      await store.create({ title: 'Task 1', lane: 'queued' })
      await store.create({ title: 'Task 2', lane: 'development' })

      const tasks = await store.getAll({ lane: 'queued' })

      assert.equal(tasks.length, 1)
      assert.equal(tasks[0].lane, 'queued')
    })

    it('should filter by assignedTo', async () => {
      const store = await createFreshStore()
      await store.create({ title: 'Task 1', assignedTo: 'agent-1' })
      await store.create({ title: 'Task 2', assignedTo: 'agent-2' })

      const tasks = await store.getAll({ assignedTo: 'agent-1' })

      assert.equal(tasks.length, 1)
      assert.equal(tasks[0].assignedTo, 'agent-1')
    })

    it('should filter by priority', async () => {
      const store = await createFreshStore()
      await store.create({ title: 'Task 1', priority: 'P0' })
      await store.create({ title: 'Task 2', priority: 'P1' })

      const tasks = await store.getAll({ priority: 'P0' })

      assert.equal(tasks.length, 1)
      assert.equal(tasks[0].priority, 'P0')
    })
  })

  describe('deletion', async () => {
    it('should delete a task', async () => {
      const store = await createFreshStore()
      const task = await store.create({ title: 'Task' })

      const deleted = await store.delete(task.id)

      assert.equal(deleted, true)
      const check = await store.get(task.id)
      assert.equal(check, undefined)
    })
  })

  describe('utilities', async () => {
    it('should generate unique task IDs', () => {
      const id1 = makeTaskId()
      const id2 = makeTaskId()

      assert.notEqual(id1, id2)
      assert.ok(id1.startsWith('task-'))
    })

    it('should normalize lanes', () => {
      assert.equal(normalizeLane('development'), 'development')
      assert.equal(normalizeLane('QUEUED'), 'queued')
      assert.equal(normalizeLane('invalid'), 'queued')
      assert.equal(normalizeLane(null), 'queued')
    })

    it('should normalize priorities', () => {
      assert.equal(normalizePriority('P0'), 'P0')
      assert.equal(normalizePriority('p1'), 'P1')
      assert.equal(normalizePriority('invalid'), 'P2')
      assert.equal(normalizePriority(null), 'P2')
    })
  })

  describe('persistence', async () => {
    it('should persist tasks to file', async () => {
      const store = await createFreshStore()
      await store.create({ title: 'Task 1' })
      await store.create({ title: 'Task 2' })

      const store2 = new TasksStore(testFile)
      const tasks = await store2.load()

      assert.equal(tasks.length, 2)
    })

    it('should handle missing file gracefully', async () => {
      const store = new TasksStore('/nonexistent/path.json')
      const tasks = await store.load()

      assert.deepEqual(tasks, [])
      assert.equal(store.loaded, true)
    })
  })
})
