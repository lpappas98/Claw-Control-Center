/**
 * TaskRouter - Push-based agent execution orchestrator
 * 
 * Uses SubAgentRegistry as single source of truth for active sessions.
 * No more active-sessions.json — one file, one write path.
 */

import { onTaskQueued, onTaskCompleted, onTaskBlocked } from './taskEvents.mjs'
import { isTestTask } from './testTaskDetection.mjs'

const MAX_CONCURRENT = 4

export class TaskRouter {
  constructor(tasksStore, agentsManager) {
    this.tasksStore = tasksStore
    this.agentsManager = agentsManager
    this.sessionCallbacks = []
    this.registry = null // Set by initializeTaskRouter
    this.initialized = false
  }

  /** Set the SubAgentRegistry (called by initializeTaskRouter) */
  setRegistry(registry) {
    this.registry = registry
  }

  async initialize() {
    this.subscribeToTaskEvents()
    this.initialized = true
    console.log('TaskRouter initialized')
  }

  subscribeToTaskEvents() {
    onTaskQueued(({ taskId, agentAssignment, task }) => {
      this.onTaskQueued(taskId, agentAssignment, task)
    })
    onTaskCompleted(({ taskId, agentId }) => {
      this.onAgentSessionComplete(agentId, taskId, 'completed')
    })
    onTaskBlocked(({ taskId, agentId, reason }) => {
      this.onAgentSessionComplete(agentId, taskId, 'blocked', reason)
    })
  }

  // ── Active session tracking via registry ──────────────────────────

  /** Check if agent is currently working (from registry) */
  isAgentBusy(agentId) {
    if (!this.registry) return false
    return this.registry.getActive().some(e => e.agentId === agentId)
  }

  /** Count of currently active sub-agents */
  getActiveCount() {
    if (!this.registry) return 0
    return this.registry.getActive().length
  }

  /** Get active sessions map (for health monitor compat) */
  getActiveSessions() {
    if (!this.registry) return new Map()
    const map = new Map()
    for (const entry of this.registry.getActive()) {
      map.set(entry.agentId, { taskId: entry.taskId, startedAt: entry.spawnedAt })
    }
    return map
  }

  canSpawnAgent(agentId) {
    return !this.isAgentBusy(agentId) && this.getActiveCount() < MAX_CONCURRENT
  }

  // ── Task routing ──────────────────────────────────────────────────

  async onTaskQueued(taskId, agentAssignment = null, task = null) {
    try {
      if (!task) {
        task = await this.tasksStore.get(taskId)
        if (!task) return
      }

      // Skip test tasks - they should not spawn real agents
      if (isTestTask(task)) {
        console.log(`[TaskRouter] Skipping test task ${taskId} - will not spawn agent`)
        return
      }

      let agentId = task.owner || task.assignedTo || agentAssignment
      if (!agentId) agentId = this.autoAssignAgent(task)
      if (!agentId) {
        console.log(`[TaskRouter] No agent for task ${taskId}`)
        return
      }

      if (!this.canSpawnAgent(agentId)) {
        console.log(`[TaskRouter] Agent ${agentId} unavailable or at concurrency limit. Task ${taskId} remains queued.`)
        return
      }

      const claimed = await this.claimTask(taskId, agentId, task)
      if (!claimed) return

      await this.spawnAgentSession(agentId, task)
    } catch (err) {
      console.error(`[TaskRouter] Error in onTaskQueued: ${err.message}`)
    }
  }

  async onAgentSessionComplete(agentId, taskId, result = 'completed', reason = '') {
    try {
      console.log(`[TaskRouter] Agent ${agentId} session complete for task ${taskId} (${result})`)

      // Mark complete in registry
      if (this.registry) {
        await this.registry.markCompleteByTaskId(taskId, result === 'completed' ? 'completed' : 'failed')
      }

      // Emit activity event
      if (global.addActivity) {
        const entry = this.registry?.getByTaskId(taskId)
        global.addActivity({
          type: result === 'completed' ? 'agent_complete' : 'agent_failed',
          agent: agentId,
          taskId,
          taskTitle: entry?.taskTitle || taskId,
          time: Date.now(),
          message: result === 'completed'
            ? `${agentId} completed "${entry?.taskTitle || taskId}"`
            : `${agentId} failed on "${entry?.taskTitle || taskId}" — ${reason || 'unknown error'}`,
        })
      }

      // Look for next task
      const nextTask = await this.getNextQueuedTask(agentId)
      if (nextTask) {
        console.log(`[TaskRouter] Found next task ${nextTask.id} for agent ${agentId}, spawning...`)
        await this.onTaskQueued(nextTask.id, agentId)
        return
      }

      await this.trySpawnWaitingTasks()
    } catch (err) {
      console.error(`[TaskRouter] Error in onAgentSessionComplete: ${err.message}`)
    }
  }

  async trySpawnWaitingTasks() {
    try {
      const queuedTasks = await this.tasksStore.getAll({ lane: 'queued' })
      for (const task of queuedTasks) {
        const agentId = task.owner || task.assignedTo
        if (!agentId) continue
        if (this.canSpawnAgent(agentId)) {
          await this.onTaskQueued(task.id, agentId)
        }
      }
    } catch (err) {
      console.error(`[TaskRouter] Error in trySpawnWaitingTasks: ${err.message}`)
    }
  }

  // ── Task claiming ─────────────────────────────────────────────────

  async claimTask(taskId, agentId, task = null) {
    try {
      if (!task) task = await this.tasksStore.get(taskId)
      if (!task || task.lane !== 'queued') return false

      const updated = await this.tasksStore.update(taskId, {
        lane: 'development',
        assignedTo: agentId,
        claimedAt: Date.now(),
        claimedBy: agentId
      }, 'router')

      if (!updated) return false
      console.log(`[TaskRouter] ✅ Claimed task ${taskId} for agent ${agentId}`)
      return true
    } catch (err) {
      console.error(`[TaskRouter] Error claiming task: ${err.message}`)
      return false
    }
  }

  async releaseTask(taskId) {
    try {
      const task = await this.tasksStore.get(taskId)
      if (!task) return false
      await this.tasksStore.update(taskId, { lane: 'queued', claimedAt: null, claimedBy: null }, 'router')
      // Also mark failed in registry
      if (this.registry) await this.registry.markCompleteByTaskId(taskId, 'failed')
      return true
    } catch (err) {
      console.error(`[TaskRouter] Error releasing task: ${err.message}`)
      return false
    }
  }

  // ── Agent spawning ────────────────────────────────────────────────

  // ── Sequential spawn queue ─────────────────────────────────────────
  // Processes one spawn at a time with 4s delay between each.
  // Sub-agents run in parallel once spawned — only the spawn is serialized.
  
  _spawnQueue = []
  _spawnProcessing = false
  
  async spawnAgentSession(agentId, task) {
    return new Promise((resolve) => {
      this._spawnQueue.push({ agentId, task, resolve })
      this._processSpawnQueue()
    })
  }

  async _processSpawnQueue() {
    if (this._spawnProcessing || this._spawnQueue.length === 0) return
    this._spawnProcessing = true

    while (this._spawnQueue.length > 0) {
      const { agentId, task, resolve } = this._spawnQueue.shift()
      
      try {
        console.log(`[TaskRouter] Spawning agent ${agentId} for task ${task.id}`)
        const taskContext = this.buildTaskContext(agentId, task)

        for (const callback of this.sessionCallbacks) {
          await callback(agentId, taskContext)
        }
      } catch (err) {
        console.error(`[TaskRouter] Error spawning session: ${err.message}`)
        if (this.registry) await this.registry.markCompleteByTaskId(task.id, 'failed')
      }
      
      resolve()
      
      // 4s delay before next spawn (only if more in queue)
      if (this._spawnQueue.length > 0) {
        console.log(`[TaskRouter] Waiting 4s before next spawn (${this._spawnQueue.length} queued)`)
        await new Promise(r => setTimeout(r, 4000))
      }
    }

    this._spawnProcessing = false
  }

  buildTaskContext(agentId, task) {
    return {
      taskId: task.id,
      title: task.title,
      description: task.description || '',
      priority: task.priority,
      tags: task.tags || [],
      project: task.project || null,
      owner: agentId,
      acceptanceCriteria: task.acceptanceCriteria || [],
      problem: task.problem || '',
      scope: task.scope || '',
      createdAt: task.createdAt,
      updatedAt: task.updatedAt
    }
  }

  onSessionSpawn(callback) { this.sessionCallbacks.push(callback) }

  // ── Helpers ───────────────────────────────────────────────────────

  async getNextQueuedTask(agentId) {
    // Check by owner first, then assignedTo
    let tasks = await this.tasksStore.getAll({ lane: 'queued', owner: agentId })
    if (tasks.length === 0) {
      tasks = await this.tasksStore.getAll({ lane: 'queued', assignedTo: agentId })
    }
    return tasks.length > 0 ? tasks[0] : null
  }

  autoAssignAgent(task) {
    const tagStr = (task.tags || []).join(' ').toLowerCase()
    if (tagStr.includes('backend') || tagStr.includes('api') || tagStr.includes('infra')) return 'forge'
    if (tagStr.includes('frontend') || tagStr.includes('ui') || tagStr.includes('react')) return 'patch'
    if (tagStr.includes('architecture') || tagStr.includes('design') || tagStr.includes('arch')) return 'blueprint'
    if (tagStr.includes('qa') || tagStr.includes('test') || tagStr.includes('verification')) return 'sentinel'
    return null
  }
}

export default TaskRouter
