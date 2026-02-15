/**
 * LegacyTasksAdapter - Wraps the in-memory tasks array with a TasksStore-compatible interface.
 * 
 * This eliminates the dual-store problem by making the TaskRouter, enhanced endpoints,
 * and all other consumers read/write from the SAME in-memory tasks array that the
 * legacy /api/tasks endpoints use.
 * 
 * The adapter does NOT own the array or the save function — the server passes them in.
 * This keeps the source of truth in one place (server.mjs's `let tasks` variable).
 */

import { normalizeLane, normalizePriority, makeTaskId } from './tasksStore.mjs'

export class LegacyTasksAdapter {
  /**
   * @param {() => import('../src/types').Task[]} getTasks - returns current tasks array
   * @param {(tasks: import('../src/types').Task[]) => void} setTasks - replaces tasks array
   * @param {() => void} scheduleSave - triggers deferred save to disk
   */
  constructor(getTasks, setTasks, scheduleSave) {
    this._getTasks = getTasks
    this._setTasks = setTasks
    this._scheduleSave = scheduleSave
  }

  /** Compatibility: some code accesses .data directly */
  get data() { return this._getTasks() }

  // ---- Core CRUD (TasksStore interface) ----

  async load() { /* no-op: legacy array is already loaded */ }

  async save() { this._scheduleSave() }

  async ensureLoaded() { /* no-op */ }

  async getAll(filters = {}) {
    let result = this._getTasks()
    if (filters.lane) result = result.filter(t => t.lane === filters.lane)
    if (filters.assignedTo) result = result.filter(t => t.assignedTo === filters.assignedTo)
    if (filters.owner) result = result.filter(t => t.owner === filters.owner)
    if (filters.projectId) result = result.filter(t => t.projectId === filters.projectId || t.project === filters.projectId)
    if (filters.project) result = result.filter(t => t.project === filters.project)
    if (filters.aspect) result = result.filter(t => t.aspect === filters.aspect)
    if (filters.priority) result = result.filter(t => t.priority === filters.priority)
    if (filters.tags && filters.tags.length > 0) {
      result = result.filter(t => filters.tags.some(tag => t.tags?.includes(tag)))
    }
    return result
  }

  async get(id) {
    return this._getTasks().find(t => t.id === id) || null
  }

  async getTask(id) { return this.get(id) }

  async create(taskData) {
    const now = Date.now()
    const nowIso = new Date(now).toISOString()
    const lane = normalizeLane(taskData.lane || 'queued')
    const task = {
      id: taskData.id || makeTaskId(),
      title: taskData.title || 'Untitled Task',
      description: taskData.description || '',
      lane,
      priority: normalizePriority(taskData.priority || 'P2'),
      owner: taskData.owner || taskData.assignedTo || null,
      assignedTo: taskData.assignedTo || taskData.owner || null,
      createdBy: taskData.createdBy || null,
      parentId: taskData.parentId || null,
      projectId: taskData.projectId || null,
      project: taskData.project || null,
      aspect: taskData.aspect || null,
      tags: Array.isArray(taskData.tags) ? taskData.tags : [],
      estimatedHours: taskData.estimatedHours || null,
      actualHours: 0,
      timeEntries: [],
      dependsOn: Array.isArray(taskData.dependsOn) ? taskData.dependsOn : [],
      blocks: Array.isArray(taskData.blocks) ? taskData.blocks : [],
      statusHistory: [{ at: nowIso, to: lane, note: 'created', by: taskData.createdBy || null }],
      comments: [],
      metadata: taskData.metadata || {},
      createdAt: nowIso,
      updatedAt: nowIso,
    }

    const tasks = this._getTasks()
    this._setTasks([task, ...tasks].slice(0, 500))
    this._scheduleSave()
    return task
  }

  async update(id, updates, updatedBy = null) {
    const tasks = this._getTasks()
    const idx = tasks.findIndex(t => t.id === id)
    if (idx < 0) return null

    const task = tasks[idx]
    const now = new Date().toISOString()
    const oldLane = task.lane

    // Track lane changes in statusHistory
    if (updates.lane && updates.lane !== oldLane) {
      task.statusHistory = task.statusHistory || []
      task.statusHistory = [{
        at: now,
        from: oldLane,
        to: normalizeLane(updates.lane),
        note: updates.statusNote || 'updated',
        by: updatedBy
      }, ...task.statusHistory]
    }

    // Apply updates
    Object.assign(task, updates, { updatedAt: now })

    // Normalize
    if (updates.lane) task.lane = normalizeLane(updates.lane)
    if (updates.priority) task.priority = normalizePriority(updates.priority)

    tasks[idx] = task
    this._setTasks(tasks)
    this._scheduleSave()
    return task
  }

  async assign(id, agentId, assignedBy = null) {
    return this.update(id, { assignedTo: agentId, owner: agentId }, assignedBy)
  }

  async addComment(id, text, by) {
    const tasks = this._getTasks()
    const task = tasks.find(t => t.id === id)
    if (!task) return null

    task.comments = task.comments || []
    task.comments.push({ at: new Date().toISOString(), by, text })
    task.updatedAt = new Date().toISOString()
    this._scheduleSave()
    return task
  }

  async logTime(id, agentId, hours, start = null, end = null, note = null) {
    const tasks = this._getTasks()
    const task = tasks.find(t => t.id === id)
    if (!task) return null

    task.timeEntries = task.timeEntries || []
    task.timeEntries.push({ agentId, hours, start: start || Date.now(), end: end || Date.now(), note })
    task.actualHours = (task.actualHours || 0) + hours
    task.updatedAt = new Date().toISOString()
    this._scheduleSave()
    return task
  }

  async getTimeEntries(id) {
    const task = await this.get(id)
    return task ? (task.timeEntries || []) : []
  }

  async getSubtasks(parentId) {
    return this._getTasks().filter(t => t.parentId === parentId)
  }

  async getDependencies(id) {
    const task = await this.get(id)
    if (!task || !task.dependsOn) return []
    return this._getTasks().filter(t => task.dependsOn.includes(t.id))
  }

  async getBlockedTasks(id) {
    const task = await this.get(id)
    if (!task || !task.blocks) return []
    return this._getTasks().filter(t => task.blocks.includes(t.id))
  }

  async getBlockerTasks(id) {
    const task = await this.get(id)
    if (!task || !task.dependsOn) return []
    return this._getTasks().filter(t => task.dependsOn.includes(t.id))
  }

  async updateDependencies(id, dependsOn, updatedBy = null) {
    return this.update(id, { dependsOn }, updatedBy)
  }

  async handleCompletion(id) {
    const task = await this.get(id)
    if (!task || !task.blocks || task.blocks.length === 0) return []

    const unblocked = []
    for (const blockedId of task.blocks) {
      const blockedTask = await this.get(blockedId)
      if (!blockedTask) continue
      const newDeps = (blockedTask.dependsOn || []).filter(depId => depId !== id)
      await this.updateDependencies(blockedId, newDeps, 'system')
      if (newDeps.length === 0 && blockedTask.lane === 'blocked') {
        await this.update(blockedId, { lane: 'queued', statusNote: 'auto-unblocked' }, 'system')
      }
      unblocked.push(blockedTask)
    }
    return unblocked
  }

  async delete(id) {
    const tasks = this._getTasks()
    const before = tasks.length
    const filtered = tasks.filter(t => t.id !== id)
    if (filtered.length !== before) {
      this._setTasks(filtered)
      this._scheduleSave()
      return true
    }
    return false
  }
}
