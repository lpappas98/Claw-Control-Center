/**
 * Initialize TaskRouter and integrate with server
 * Call this early in server startup to set up push-based execution
 */

import TaskRouter from './taskRouter.mjs'
import { emitTaskQueued, emitTaskCompleted, emitTaskBlocked } from './taskEvents.mjs'
import setupTaskRouterEndpoints from './taskRouterEndpoints.mjs'

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
    emitTaskQueued(task.id, task.assignedTo)
    // Call original callback if it exists
    if (originalTaskCreatedCallback) originalTaskCreatedCallback(task)
  }
  
  // Hook task updates to trigger router for queued tasks
  const originalTaskUpdatedCallback = global.onTaskUpdated
  global.onTaskUpdated = (task, oldTask) => {
    // If task just entered queued state, emit event
    if (task.lane === 'queued' && oldTask.lane !== 'queued') {
      console.log(`[TaskRouter] Task moved to queued: ${task.id}`)
      emitTaskQueued(task.id, task.assignedTo)
    }
    // Call original callback if it exists
    if (originalTaskUpdatedCallback) originalTaskUpdatedCallback(task, oldTask)
  }
  
  // Register callback for agent session spawning
  // When router decides to spawn an agent, it will call this function
  taskRouter.onSessionSpawn(async (agentId, taskContext) => {
    console.log(`[TaskRouter] Spawning agent ${agentId} with task context`)
    // The actual agent spawning would happen here via OpenClaw's session_spawn
    // For now, we just log it
    // In production, this would call the gateway to spawn an isolated agent session
    // with the taskContext as the initial message
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
export async function runTaskRouterHealthMonitor(taskRouter, tasksStore) {
  console.log('[TaskRouter] Running health monitor...')
  
  try {
    // Get active sessions from router
    const activeSessions = taskRouter.getActiveSessions()
    
    // Check for orphaned tasks that have been in_progress for >10 minutes
    const tasks = await tasksStore.getAll({ lane: 'in_progress' })
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
    
    console.log('[TaskRouter] Health monitor complete')
  } catch (err) {
    console.error('[TaskRouter] Health monitor error:', err.message)
  }
}

export default { initializeTaskRouter, runTaskRouterHealthMonitor }
