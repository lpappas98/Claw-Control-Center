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

  describe('task creation', async () => {
    it('should create a new task', async () => {
      const store = new TasksStore(testFile)
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
      const store = new TasksStore(testFile)
      const task = await store.create({
        title: 'Test task',
        lane: 'DEVELOPMENT',
        priority: 'p2',
      })

      assert.equal(task.lane, 'development')
      assert.equal(task.priority, 'P2')
    })

    it('should initialize status history', async () => {
      const store = new TasksStore(testFile)
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
      const store = new TasksStore(testFile)
      const task = await store.create({ title: 'Initial' })

      const updated = await store.update(task.id, {
        title: 'Updated title',
        priority: 'P0',
      })

      assert.equal(updated.title, 'Updated title')
      assert.equal(updated.priority, 'P0')
    })

    it('should track lane changes in status history', async () => {
      const store = new TasksStore(testFile)
      const task = await store.create({ title: 'Task', lane: 'queued' })

      const updated = await store.update(task.id, {
        lane: 'development',
      })

      assert.equal(updated.statusHistory.length, 2)
      assert.equal(updated.statusHistory[1].from, 'queued')
      assert.equal(updated.statusHistory[1].to, 'development')
    })

    it('should return null for non-existent task', async () => {
      const store = new TasksStore(testFile)
      const result = await store.update('non-existent', { title: 'New' })

      assert.equal(result, null)
    })
  })

  describe('task assignment', async () => {
    it('should assign task to agent', async () => {
      const store = new TasksStore(testFile)
      const task = await store.create({ title: 'Task' })

      const updated = await store.assign(task.id, 'agent-123')

      assert.equal(updated.assignedTo, 'agent-123')
    })
  })

  describe('comments', async () => {
    it('should add comment to task', async () => {
      const store = new TasksStore(testFile)
      const task = await store.create({ title: 'Task' })

      const updated = await store.addComment(task.id, 'Great work!', 'user-1')

      assert.equal(updated.comments.length, 1)
      assert.equal(updated.comments[0].text, 'Great work!')
      assert.equal(updated.comments[0].by, 'user-1')
    })

    it('should add multiple comments', async () => {
      const store = new TasksStore(testFile)
      const task = await store.create({ title: 'Task' })

      await store.addComment(task.id, 'First', 'user-1')
      const updated = await store.addComment(task.id, 'Second', 'user-2')

      assert.equal(updated.comments.length, 2)
    })
  })

  describe('time tracking', async () => {
    it('should log time entry', async () => {
      const store = new TasksStore(testFile)
      const task = await store.create({ title: 'Task' })

      const updated = await store.logTime(task.id, 'agent-1', 2.5)

      assert.equal(updated.timeEntries.length, 1)
      assert.equal(updated.timeEntries[0].agentId, 'agent-1')
      assert.equal(updated.timeEntries[0].hours, 2.5)
    })

    it('should accumulate actual hours', async () => {
      const store = new TasksStore(testFile)
      const task = await store.create({ title: 'Task' })

      await store.logTime(task.id, 'agent-1', 2)
      const updated = await store.logTime(task.id, 'agent-2', 3.5)

      assert.equal(updated.actualHours, 5.5)
    })
  })

  describe('subtasks', async () => {
    it('should get subtasks', async () => {
      const store = new TasksStore(testFile)
      const parent = await store.create({ title: 'Parent' })
      const child = await store.create({ title: 'Child', parentId: parent.id })

      const subtasks = await store.getSubtasks(parent.id)

      assert.equal(subtasks.length, 1)
      assert.equal(subtasks[0].id, child.id)
    })

    it('should return empty for task with no subtasks', async () => {
      const store = new TasksStore(testFile)
      const task = await store.create({ title: 'Task' })

      const subtasks = await store.getSubtasks(task.id)

      assert.equal(subtasks.length, 0)
    })
  })

  describe('dependencies', async () => {
    it('should get dependencies', async () => {
      const store = new TasksStore(testFile)
      const taskA = await store.create({ title: 'A' })
      const taskB = await store.create({ title: 'B', dependsOn: [taskA.id] })

      const deps = await store.getDependencies(taskB.id)

      assert.equal(deps.length, 1)
      assert.equal(deps[0].id, taskA.id)
    })

    it('should update dependencies', async () => {
      const store = new TasksStore(testFile)
      const taskA = await store.create({ title: 'A' })
      const taskB = await store.create({ title: 'B', dependsOn: [taskA.id] })

      const updated = await store.updateDependencies(taskB.id, [])

      assert.deepEqual(updated.dependsOn, [])
    })
  })

  describe('blocking relationships', async () => {
    it('should auto-unblock tasks on completion', async () => {
      const store = new TasksStore(testFile)
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
  })

  describe('filtering', async () => {
    it('should filter by lane', async () => {
      const store = new TasksStore(testFile)
      await store.create({ title: 'Task 1', lane: 'queued' })
      await store.create({ title: 'Task 2', lane: 'development' })

      const tasks = await store.getAll({ lane: 'queued' })

      assert.equal(tasks.length, 1)
      assert.equal(tasks[0].lane, 'queued')
    })

    it('should filter by assignedTo', async () => {
      const store = new TasksStore(testFile)
      await store.create({ title: 'Task 1', assignedTo: 'agent-1' })
      await store.create({ title: 'Task 2', assignedTo: 'agent-2' })

      const tasks = await store.getAll({ assignedTo: 'agent-1' })

      assert.equal(tasks.length, 1)
      assert.equal(tasks[0].assignedTo, 'agent-1')
    })

    it('should filter by priority', async () => {
      const store = new TasksStore(testFile)
      await store.create({ title: 'Task 1', priority: 'P0' })
      await store.create({ title: 'Task 2', priority: 'P1' })

      const tasks = await store.getAll({ priority: 'P0' })

      assert.equal(tasks.length, 1)
      assert.equal(tasks[0].priority, 'P0')
    })
  })

  describe('deletion', async () => {
    it('should delete a task', async () => {
      const store = new TasksStore(testFile)
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
      const store = new TasksStore(testFile)
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
