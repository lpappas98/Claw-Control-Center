import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * Enhanced Task Data Model
 * {
 *   id: string,
 *   title: string,
 *   description: string?,
 *   lane: "proposed" | "queued" | "development" | "review" | "blocked" | "done",
 *   priority: "P0" | "P1" | "P2" | "P3",
 *   assignedTo: string?,           // agent id
 *   createdBy: string?,             // user or agent id
 *   parentId: string?,              // for subtasks/epics
 *   projectId: string?,             // link to project
 *   tags: string[],
 *   estimatedHours: number?,
 *   actualHours: number?,
 *   timeEntries: [{agentId, start, end, hours}],
 *   dependsOn: string[],            // task IDs this depends on
 *   blocks: string[],               // task IDs this blocks
 *   statusHistory: [{at, from, to, note, by}],
 *   comments: [{at, by, text}],
 *   metadata: object,               // extensible
 *   createdAt: number,
 *   updatedAt: number
 * }
 */

function cap(list, max) {
  if (!Array.isArray(list)) return []
  if (list.length <= max) return list
  return list.slice(0, max)
}

export function makeTaskId(prefix = 'task') {
  return `${prefix}-${Math.random().toString(16).slice(2)}-${Date.now()}`
}

export function normalizeLane(lane) {
  const v = String(lane ?? '').toLowerCase()
  if (['proposed', 'queued', 'development', 'review', 'blocked', 'done'].includes(v)) return v
  return 'queued'
}

export function normalizePriority(p) {
  const v = String(p ?? '').toUpperCase()
  if (['P0', 'P1', 'P2', 'P3'].includes(v)) return v
  return 'P2'
}

export class TasksStore {
  constructor(filePath = '.clawhub/tasks.json') {
    this.filePath = filePath
    this.tasks = []
    this.loaded = false
  }

  /**
   * Validate dependencies for circular references
   * @throws {Error} if circular dependency detected
   */
  validateDependencies(taskId, dependsOn = [], allTasks = null) {
    if (!taskId || dependsOn.length === 0) return

    // Check for self-dependency
    if (dependsOn.includes(taskId)) {
      throw new Error(`Circular dependency detected: task ${taskId} cannot depend on itself`)
    }

    const tasks = allTasks || this.tasks
    
    // Create a temporary task map with the updated dependencies for the target task
    const tempTaskMap = new Map()
    for (const task of tasks) {
      if (task.id === taskId) {
        tempTaskMap.set(task.id, { ...task, dependsOn })
      } else {
        tempTaskMap.set(task.id, task)
      }
    }
    
    const visited = new Set()
    const recursionStack = new Set()

    const hasCycle = (id) => {
      if (recursionStack.has(id)) return true
      if (visited.has(id)) return false

      visited.add(id)
      recursionStack.add(id)

      const task = tempTaskMap.get(id)
      if (!task) return false

      for (const depId of (task.dependsOn || [])) {
        if (hasCycle(depId)) return true
      }

      recursionStack.delete(id)
      return false
    }

    // Check for cycles starting from any of the new dependencies
    for (const depId of dependsOn) {
      visited.clear()
      recursionStack.clear()
      if (hasCycle(depId)) {
        throw new Error(`Circular dependency detected: task ${taskId} cannot depend on ${depId}`)
      }
    }
  }

  async load() {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8')
      const data = JSON.parse(raw)
      this.tasks = cap(Array.isArray(data) ? data : data?.tasks, 1000)
      this.loaded = true
    } catch {
      this.tasks = []
      this.loaded = true
    }
    return this.tasks
  }

  async save() {
    const dir = path.dirname(this.filePath)
    await fs.mkdir(dir, { recursive: true })

    const tmp = `${this.filePath}.tmp`
    const payload = JSON.stringify(cap(this.tasks, 1000), null, 2)
    await fs.writeFile(tmp, payload, 'utf8')
    await fs.rename(tmp, this.filePath)
  }

  async ensureLoaded() {
    if (!this.loaded) await this.load()
  }

  /**
   * Get all tasks
   */
  async getAll(filters = {}) {
    await this.ensureLoaded()
    let result = this.tasks

    // Apply filters
    if (filters.lane) {
      result = result.filter(t => t.lane === filters.lane)
    }
    if (filters.assignedTo) {
      result = result.filter(t => t.assignedTo === filters.assignedTo)
    }
    if (filters.projectId) {
      result = result.filter(t => t.projectId === filters.projectId)
    }
    if (filters.priority) {
      result = result.filter(t => t.priority === filters.priority)
    }
    if (filters.tags && filters.tags.length > 0) {
      result = result.filter(t => 
        filters.tags.some(tag => t.tags?.includes(tag))
      )
    }

    return result
  }

  /**
   * Get task by ID
   */
  async get(id) {
    await this.ensureLoaded()
    return this.tasks.find(t => t.id === id)
  }

  /**
   * Create new task
   */
  async create(taskData) {
    await this.ensureLoaded()
    
    const now = Date.now()
    const dependsOn = Array.isArray(taskData.dependsOn) ? taskData.dependsOn : []
    
    // Validate dependencies before creating
    this.validateDependencies(null, dependsOn, this.tasks)

    const normalizedLane = normalizeLane(taskData.lane || 'queued')
    const task = {
      id: makeTaskId(),
      title: taskData.title || 'Untitled Task',
      description: taskData.description || '',
      lane: normalizedLane,
      priority: normalizePriority(taskData.priority || 'P2'),
      assignedTo: taskData.assignedTo || null,
      createdBy: taskData.createdBy || null,
      parentId: taskData.parentId || null,
      projectId: taskData.projectId || null,
      tags: Array.isArray(taskData.tags) ? taskData.tags : [],
      estimatedHours: taskData.estimatedHours || null,
      actualHours: 0,
      timeEntries: [],
      dependsOn: dependsOn,
      blocks: Array.isArray(taskData.blocks) ? taskData.blocks : [],
      statusHistory: [{
        at: now,
        to: normalizedLane,
        note: 'created',
        by: taskData.createdBy || null
      }],
      comments: [],
      metadata: (taskData.metadata && typeof taskData.metadata === 'object') ? taskData.metadata : {},
      createdAt: now,
      updatedAt: now
    }

    this.tasks.push(task)
    await this.save()
    return task
  }

  /**
   * Update task
   */
  async update(id, updates, updatedBy = null) {
    await this.ensureLoaded()
    const task = this.tasks.find(t => t.id === id)
    if (!task) return null

    const now = Date.now()
    const oldLane = task.lane

    // Track status changes
    if (updates.lane && updates.lane !== oldLane) {
      task.statusHistory = task.statusHistory || []
      task.statusHistory.push({
        at: now,
        from: oldLane,
        to: normalizeLane(updates.lane),
        note: updates.statusNote || 'updated',
        by: updatedBy
      })
    }

    // Apply updates
    Object.assign(task, updates, { updatedAt: now })

    // Normalize critical fields
    if (updates.lane) task.lane = normalizeLane(updates.lane)
    if (updates.priority) task.priority = normalizePriority(updates.priority)

    await this.save()
    return task
  }

  /**
   * Assign task to agent
   */
  async assign(id, agentId, assignedBy = null) {
    return this.update(id, { assignedTo: agentId }, assignedBy)
  }

  /**
   * Add comment to task
   */
  async addComment(id, text, by) {
    await this.ensureLoaded()
    const task = this.tasks.find(t => t.id === id)
    if (!task) return null

    task.comments = task.comments || []
    task.comments.push({
      at: Date.now(),
      by,
      text
    })
    task.updatedAt = Date.now()

    await this.save()
    return task
  }

  /**
   * Log time entry
   */
  async logTime(id, agentId, hours, start = null, end = null, note = null) {
    await this.ensureLoaded()
    const task = this.tasks.find(t => t.id === id)
    if (!task) return null

    task.timeEntries = task.timeEntries || []
    task.timeEntries.push({
      agentId,
      hours,
      start: start || Date.now(),
      end: end || Date.now(),
      note: note || null
    })

    task.actualHours = (task.actualHours || 0) + hours
    task.updatedAt = Date.now()

    await this.save()
    return task
  }

  /**
   * Get time entries for a task
   */
  async getTimeEntries(id) {
    const task = await this.get(id)
    if (!task) return []
    return task.timeEntries || []
  }

  /**
   * Get subtasks of a task
   */
  async getSubtasks(parentId) {
    await this.ensureLoaded()
    return this.tasks.filter(t => t.parentId === parentId)
  }

  /**
   * Get tasks this task depends on
   */
  async getDependencies(id) {
    const task = await this.get(id)
    if (!task || !task.dependsOn) return []

    await this.ensureLoaded()
    return this.tasks.filter(t => task.dependsOn.includes(t.id))
  }

  /**
   * Get tasks this task blocks
   */
  async getBlockedTasks(id) {
    const task = await this.get(id)
    if (!task || !task.blocks) return []

    await this.ensureLoaded()
    return this.tasks.filter(t => task.blocks.includes(t.id))
  }

  /**
   * Get tasks that block this task (tasks in dependsOn array)
   */
  async getBlockerTasks(id) {
    const task = await this.get(id)
    if (!task || !task.dependsOn) return []

    await this.ensureLoaded()
    return this.tasks.filter(t => task.dependsOn.includes(t.id))
  }

  /**
   * Update dependencies
   */
  async updateDependencies(id, dependsOn, updatedBy = null) {
    await this.ensureLoaded()
    
    // Validate dependencies before updating
    this.validateDependencies(id, dependsOn, this.tasks)
    
    return this.update(id, { dependsOn }, updatedBy)
  }

  /**
   * Auto-unblock tasks when this task completes
   */
  async handleCompletion(id) {
    const task = await this.get(id)
    if (!task || !task.blocks || task.blocks.length === 0) return []

    const unblocked = []
    
    for (const blockedId of task.blocks) {
      const blockedTask = await this.get(blockedId)
      if (!blockedTask) continue

      // Remove this task from blocked task's dependencies
      const newDeps = (blockedTask.dependsOn || []).filter(depId => depId !== id)
      await this.updateDependencies(blockedId, newDeps, 'system')

      // If no more dependencies, auto-move to queued
      if (newDeps.length === 0 && blockedTask.lane === 'blocked') {
        await this.update(blockedId, { 
          lane: 'queued',
          statusNote: 'auto-unblocked'
        }, 'system')
      }

      unblocked.push(blockedTask)
    }

    return unblocked
  }

  /**
   * Delete task
   */
  async delete(id) {
    await this.ensureLoaded()
    const before = this.tasks.length
    this.tasks = this.tasks.filter(t => t.id !== id)
    
    if (this.tasks.length !== before) {
      await this.save()
      return true
    }
    return false
  }
}

// Singleton instance
let store = null
export function getTasksStore(filePath) {
  if (!store) {
    store = new TasksStore(filePath)
  }
  return store
}

// Export legacy functions for backward compatibility
export async function loadTasks(filePath) {
  const store = new TasksStore(filePath)
  return store.load()
}

export async function saveTasks(filePath, tasks) {
  const store = new TasksStore(filePath)
  store.tasks = tasks
  await store.save()
}

export { makeTaskId as makeId }
