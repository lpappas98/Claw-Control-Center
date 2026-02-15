/**
 * TaskRouter - Push-based agent execution orchestrator
 * Replaces pull-based cron model with event-driven spawning
 * 
 * Architecture:
 * Task queued → Router checks assignment → Router checks if agent free → Router spawns agent with context
 * Task complete → Router marks agent free → Router spawns next task for that agent (or other waiting agents)
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { onTaskQueued, onTaskCompleted, onTaskBlocked } from './taskEvents.mjs'

const ACTIVE_SESSIONS_FILE = '.clawhub/active-sessions.json'
const MAX_CONCURRENT = 4

export class TaskRouter {
  constructor(tasksStore, agentsManager) {
    this.tasksStore = tasksStore
    this.agentsManager = agentsManager
    this.activeSessions = new Map() // { agentId → { taskId, startedAt } }
    this.sessionCallbacks = [] // Functions to call when session completes
    this.initialized = false
  }

  /**
   * Initialize router and load persistent state
   */
  async initialize() {
    await this.loadActiveSessions()
    this.subscribeToTaskEvents()
    this.initialized = true
    console.log('TaskRouter initialized')
  }

  /**
   * Load active sessions from disk
   */
  async loadActiveSessions() {
    try {
      const data = await fs.readFile(ACTIVE_SESSIONS_FILE, 'utf8')
      const sessions = JSON.parse(data) || {}
      this.activeSessions = new Map(Object.entries(sessions))
    } catch {
      this.activeSessions = new Map()
    }
  }

  /**
   * Persist active sessions to disk
   */
  async saveActiveSessions() {
    const dir = path.dirname(ACTIVE_SESSIONS_FILE)
    await fs.mkdir(dir, { recursive: true })
    
    const sessions = Object.fromEntries(this.activeSessions)
    const tmp = `${ACTIVE_SESSIONS_FILE}.tmp`
    await fs.writeFile(tmp, JSON.stringify(sessions, null, 2), 'utf8')
    await fs.rename(tmp, ACTIVE_SESSIONS_FILE)
  }

  /**
   * Subscribe to all task events
   */
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

  /**
   * Task has entered queued status - check if we should spawn an agent immediately
   */
  async onTaskQueued(taskId, agentAssignment = null, task = null) {
    try {
      // If task object not provided, fetch from store
      if (!task) {
        task = await this.tasksStore.get(taskId)
        if (!task) {
          console.log(`[TaskRouter] Task ${taskId} not found`)
          return
        }
      }

      // Determine agent assignment
      // Try: explicit owner → agentAssignment → auto-assign from tags
      let agentId = task.owner || task.assignedTo || agentAssignment
      if (!agentId) {
        agentId = this.autoAssignAgent(task)
      }

      if (!agentId) {
        console.log(`[TaskRouter] Could not assign agent to task ${taskId}`)
        return
      }

      // Check if we can spawn immediately
      if (!this.canSpawnAgent(agentId)) {
        console.log(`[TaskRouter] Agent ${agentId} unavailable or at concurrency limit. Task ${taskId} remains queued.`)
        return
      }

      // Claim the task
      const claimed = await this.claimTask(taskId, agentId)
      if (!claimed) {
        console.log(`[TaskRouter] Could not claim task ${taskId} - another agent got it`)
        return
      }

      // Spawn agent session with task context
      await this.spawnAgentSession(agentId, task)
    } catch (err) {
      console.error(`[TaskRouter] Error in onTaskQueued: ${err.message}`)
    }
  }

  /**
   * Agent session completed or blocked - free up slot and spawn next task
   */
  async onAgentSessionComplete(agentId, taskId, result = 'completed', reason = '') {
    try {
      console.log(`[TaskRouter] Agent ${agentId} session complete for task ${taskId} (${result})`)
      
      // Mark agent as free
      this.activeSessions.delete(agentId)
      await this.saveActiveSessions()

      // Check for next task assigned to this agent
      const nextTask = await this.getNextQueuedTask(agentId)
      if (nextTask) {
        console.log(`[TaskRouter] Found next task ${nextTask.id} for agent ${agentId}, spawning...`)
        await this.onTaskQueued(nextTask.id, agentId)
        return
      }

      // Check if other agents have waiting tasks (due to concurrency limit)
      await this.trySpawnWaitingTasks()
    } catch (err) {
      console.error(`[TaskRouter] Error in onAgentSessionComplete: ${err.message}`)
    }
  }

  /**
   * Try to spawn any waiting tasks for other agents (unblock concurrency limit)
   */
  async trySpawnWaitingTasks() {
    try {
      const queuedTasks = await this.tasksStore.getAll({ lane: 'queued' })
      
      for (const task of queuedTasks) {
        const agentId = task.assignedTo
        if (!agentId) continue
        
        if (!this.activeSessions.has(agentId) && this.canSpawnAgent(agentId)) {
          console.log(`[TaskRouter] Spawning task ${task.id} for agent ${agentId}`)
          await this.onTaskQueued(task.id, agentId)
        }
      }
    } catch (err) {
      console.error(`[TaskRouter] Error in trySpawnWaitingTasks: ${err.message}`)
    }
  }

  /**
   * Check if agent can spawn a new session
   */
  canSpawnAgent(agentId) {
    // Agent not already running AND under global concurrency limit
    const agentBusy = this.activeSessions.has(agentId)
    const atLimit = this.activeSessions.size >= MAX_CONCURRENT

    return !agentBusy && !atLimit
  }

  /**
   * Auto-assign task to agent based on tag
   */
  autoAssignAgent(task) {
    // Simple tag-to-agent mapping
    const tags = task.tags || []
    const tagStr = (task.tags || []).join(' ').toLowerCase()

    // Backend/Infrastructure → Forge (dev-1)
    if (tagStr.includes('backend') || tagStr.includes('api') || tagStr.includes('infra')) {
      return 'dev-1'
    }

    // Frontend/UI → Patch (dev-2)
    if (tagStr.includes('frontend') || tagStr.includes('ui') || tagStr.includes('react')) {
      return 'dev-2'
    }

    // Architecture → Blueprint (architect)
    if (tagStr.includes('architecture') || tagStr.includes('design') || tagStr.includes('arch')) {
      return 'architect'
    }

    // QA → Sentinel (qa)
    if (tagStr.includes('qa') || tagStr.includes('test') || tagStr.includes('verification')) {
      return 'qa'
    }

    // Default: leave unassigned for human attention
    return null
  }

  /**
   * Atomically claim a task for an agent
   */
  async claimTask(taskId, agentId) {
    try {
      const task = await this.tasksStore.get(taskId)
      if (!task) return false

      // Only claim if still in queued status
      if (task.lane !== 'queued') return false

      // Update task to in_progress status
      await this.tasksStore.update(
        taskId,
        {
          lane: 'in_progress',
          assignedTo: agentId,
          claimedAt: Date.now(),
          claimedBy: agentId
        },
        'router'
      )

      return true
    } catch (err) {
      console.error(`[TaskRouter] Error claiming task: ${err.message}`)
      return false
    }
  }

  /**
   * Release a claimed task back to queued (for orphaned sessions)
   */
  async releaseTask(taskId) {
    try {
      const task = await this.tasksStore.get(taskId)
      if (!task) return false

      await this.tasksStore.update(
        taskId,
        {
          lane: 'queued',
          claimedAt: null,
          claimedBy: null
        },
        'router'
      )

      return true
    } catch (err) {
      console.error(`[TaskRouter] Error releasing task: ${err.message}`)
      return false
    }
  }

  /**
   * Get next queued task for an agent
   */
  async getNextQueuedTask(agentId) {
    const tasks = await this.tasksStore.getAll({
      lane: 'queued',
      assignedTo: agentId
    })
    return tasks.length > 0 ? tasks[0] : null
  }

  /**
   * Spawn an agent session with full task context
   * This is called by the Router (via onTaskQueued)
   */
  async spawnAgentSession(agentId, task) {
    try {
      // Mark agent as active before spawning (prevent double-spawn)
      this.activeSessions.set(agentId, {
        taskId: task.id,
        startedAt: Date.now()
      })
      await this.saveActiveSessions()

      console.log(`[TaskRouter] Spawning agent ${agentId} for task ${task.id}`)

      // Build full task context
      const taskContext = this.buildTaskContext(agentId, task)

      // The actual agent spawning happens in the server/gateway
      // We emit an event or call a callback that the server listens to
      if (this.sessionCallbacks.length > 0) {
        for (const callback of this.sessionCallbacks) {
          await callback(agentId, taskContext)
        }
      }
    } catch (err) {
      console.error(`[TaskRouter] Error spawning session: ${err.message}`)
      this.activeSessions.delete(agentId)
    }
  }

  /**
   * Build full task context to pass to agent
   */
  buildTaskContext(agentId, task) {
    return {
      agent: agentId,
      task: {
        id: task.id,
        title: task.title,
        description: task.description,
        priority: task.priority,
        tags: task.tags || [],
        project: task.project || null,
        assignedTo: agentId,
        acceptanceCriteria: task.metadata?.acceptanceCriteria || [],
        problem: task.metadata?.problem || '',
        scope: task.metadata?.scope || '',
        context: task.metadata?.context || ''
      },
      createdAt: task.createdAt,
      updatedAt: task.updatedAt
    }
  }

  /**
   * Register callback for agent session spawning
   */
  onSessionSpawn(callback) {
    this.sessionCallbacks.push(callback)
  }

  /**
   * Get current active sessions
   */
  getActiveSessions() {
    return new Map(this.activeSessions)
  }

  /**
   * Health check: find orphaned sessions
   */
  async getOrphanedSessions(realSessions = new Set()) {
    const orphaned = []

    for (const [agentId, session] of this.activeSessions) {
      if (!realSessions.has(agentId)) {
        orphaned.push({ agentId, taskId: session.taskId, startedAt: session.startedAt })
      }
    }

    return orphaned
  }
}

export default TaskRouter
