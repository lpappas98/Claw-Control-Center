/**
 * Initialize TaskRouter and integrate with server
 * Call this early in server startup to set up push-based execution
 */

import TaskRouter from './taskRouter.mjs'
import { emitTaskQueued, emitTaskCompleted, emitTaskBlocked } from './taskEvents.mjs'
import setupTaskRouterEndpoints from './taskRouterEndpoints.mjs'

/**
 * Build the message that will be sent to the agent when it spawns.
 * This is the full task context — the agent reads this and works.
 */
function buildAgentMessage(taskContext) {
  const t = taskContext
  const lines = [
    `## Task Assignment: ${t.title || 'Untitled'}`,
    `**Task ID:** ${t.taskId}`,
    `**Priority:** ${t.priority || 'P2'}`,
    `**Owner:** ${t.owner || 'unassigned'}`,
    '',
  ]
  
  if (t.problem) lines.push(`### Problem`, t.problem, '')
  if (t.scope) lines.push(`### Scope`, t.scope, '')
  
  if (t.acceptanceCriteria) {
    lines.push(`### Acceptance Criteria`)
    if (Array.isArray(t.acceptanceCriteria)) {
      t.acceptanceCriteria.forEach(ac => lines.push(`- [ ] ${ac}`))
    } else {
      lines.push(t.acceptanceCriteria)
    }
    lines.push('')
  }
  
  if (t.tags?.length) lines.push(`**Tags:** ${t.tags.join(', ')}`, '')
  
  lines.push(
    `### Instructions`,
    `1. Work on this task to completion.`,
    `2. Move the task to development: PUT /api/tasks/${t.taskId} with {"lane": "development"}`,
    `3. When done, move to review: PUT /api/tasks/${t.taskId} with {"lane": "review"}`,
    `4. Call POST http://localhost:8787/api/agents/${t.owner}/heartbeat with {"status": "online"} every 60 seconds while working.`,
    `5. The bridge API is at http://localhost:8787`,
    ''
  )
  
  return lines.join('\n')
}

/**
 * Initialize TaskRouter with stores and attach to server
 */
export async function initializeTaskRouter(app, tasksStore, agentsStore) {
  console.log('[TaskRouter] Initializing push-based execution model...')
  
  // Create router instance
  const taskRouter = new TaskRouter(tasksStore, agentsStore)
  
  // Initialize router (loads active sessions from disk)
  await taskRouter.initialize()
  
  // Setup the new task router endpoints (/claim, /complete, /blocked, /release)
  setupTaskRouterEndpoints(app, tasksStore, taskRouter)
  
  // Hook task creation to emit taskQueued event
  // This will be called by the POST /api/tasks endpoint after task creation
  const originalTaskCreatedCallback = global.onTaskCreated
  global.onTaskCreated = (task) => {
    console.log(`[TaskRouter] Task created: ${task.id}`)
    // Emit event so router can spawn agent if conditions met
    // Pass task object directly to avoid sync issues with deferred saves
    // Use owner field if available
    emitTaskQueued(task.id, task.owner || task.assignedTo, task)
    // Call original callback if it exists
    if (originalTaskCreatedCallback) originalTaskCreatedCallback(task)
  }
  
  // Hook task updates to trigger router for queued tasks
  const originalTaskUpdatedCallback = global.onTaskUpdated
  global.onTaskUpdated = (task, oldTask) => {
    // If task just entered queued state, emit event
    if (task.lane === 'queued' && oldTask.lane !== 'queued') {
      console.log(`[TaskRouter] Task moved to queued: ${task.id}`)
      // Pass task object to avoid sync issues
      // Use owner field if available
      emitTaskQueued(task.id, task.owner || task.assignedTo, task)
    }
    // Call original callback if it exists
    if (originalTaskUpdatedCallback) originalTaskUpdatedCallback(task, oldTask)
  }
  
  // Agent spawn proxy URL — runs on host, proxies to `openclaw agent` CLI
  // From inside Docker, host is reachable at the gateway IP of the claw-net bridge network
  const SPAWN_PROXY_URL = process.env.SPAWN_PROXY_URL || 'http://172.18.0.1:8790'
  
  // Track retry counts to prevent infinite loops
  const retryCount = new Map() // taskId -> number
  const MAX_RETRIES = 3
  
  // Register callback for agent session spawning via HTTP proxy
  taskRouter.onSessionSpawn(async (agentId, taskContext) => {
    const taskId = taskContext.taskId
    const retries = retryCount.get(taskId) || 0
    
    if (retries >= MAX_RETRIES) {
      console.error(`[TaskRouter] ❌ Agent ${agentId} failed ${MAX_RETRIES} times for task ${taskId} — giving up`)
      retryCount.delete(taskId)
      // Move to blocked instead of retrying
      try {
        await tasksStore.update(taskId, { lane: 'blocked', statusNote: `Agent spawn failed after ${MAX_RETRIES} attempts` })
      } catch (e) { console.error('[TaskRouter] Failed to block task:', e.message) }
      return
    }
    
    retryCount.set(taskId, retries + 1)
    console.log(`[TaskRouter] 🚀 Spawning agent ${agentId} for task ${taskId} (attempt ${retries + 1}/${MAX_RETRIES})`)
    
    const message = buildAgentMessage(taskContext)
    
    try {
      const resp = await fetch(`${SPAWN_PROXY_URL}/spawn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, message, timeout: 300 }),
        signal: AbortSignal.timeout(10000) // 10s to accept the request
      })
      
      if (!resp.ok) {
        const errText = await resp.text()
        throw new Error(`Proxy returned ${resp.status}: ${errText}`)
      }
      
      const data = await resp.json()
      console.log(`[TaskRouter] ✅ Proxy accepted spawn for agent ${agentId}: ${data.status}`)
      
      // Clear retry count on successful spawn
      retryCount.delete(taskId)
      
      // Note: The proxy runs the agent async. The agent itself should call
      // PUT /api/tasks/:id to move lanes when done. The health monitor
      // handles orphaned tasks that never complete.
      
    } catch (err) {
      console.error(`[TaskRouter] Agent ${agentId} spawn error for task ${taskId}: ${err.message}`)
      // Release back to queued for retry (health monitor will pick it up)
      try {
        await taskRouter.releaseTask(taskId)
      } catch (e) { console.error('[TaskRouter] Release error:', e.message) }
    }
  })
  
  // Attach router to global for access from other modules
  global.taskRouter = taskRouter
  
  console.log('[TaskRouter] ✅ Initialized successfully')
  console.log('[TaskRouter] Push-based execution model is now active')
  console.log('[TaskRouter] Task queues will immediately spawn agents instead of waiting for crons')
  
  return taskRouter
}

/**
 * Health monitor cron - runs every 5 minutes
 * Detects orphaned sessions and triggers router for stuck queued tasks
 */
export async function runTaskRouterHealthMonitor(taskRouter, tasksStore, agentsStore = null) {
  console.log('[TaskRouter] Running health monitor...')
  
  try {
    // Get active sessions from router
    const activeSessions = taskRouter.getActiveSessions()
    
    // Check for orphaned tasks that have been in development for >10 minutes
    const tasks = await tasksStore.getAll({ lane: 'development' })
    const now = Date.now()
    const orphanThresholdMs = 10 * 60 * 1000 // 10 minutes
    
    for (const task of tasks) {
      const claimedAt = task.claimedAt || task.updatedAt
      const ageMs = now - (typeof claimedAt === 'number' ? claimedAt : new Date(claimedAt).getTime())
      
      if (ageMs > orphanThresholdMs) {
        console.log(`[TaskRouter] Found orphaned task: ${task.id} (age: ${Math.round(ageMs / 1000)}s)`)
        // Release it back to queued so router can try again
        await taskRouter.releaseTask(task.id)
      }
    }
    
    // Check for tasks that should have agents working but don't
    const queuedTasks = await tasksStore.getAll({ lane: 'queued' })
    console.log(`[TaskRouter] Health check: ${activeSessions.size} active sessions, ${queuedTasks.length} queued tasks`)
    
    // Try to spawn any waiting tasks that couldn't be spawned due to concurrency
    await taskRouter.trySpawnWaitingTasks()
    
    // Step 4: Mark agents offline if no heartbeat in 5 minutes
    if (agentsStore) {
      await agentsStore.pruneStale(5 * 60 * 1000)
    }

    console.log('[TaskRouter] Health monitor complete')
  } catch (err) {
    console.error('[TaskRouter] Health monitor error:', err.message)
  }
}

export default { initializeTaskRouter, runTaskRouterHealthMonitor }
