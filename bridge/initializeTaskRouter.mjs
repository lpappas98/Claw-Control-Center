/**
 * Initialize TaskRouter and integrate with server
 * Call this early in server startup to set up push-based execution
 */

import { execFile } from 'node:child_process'
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
  
  // Register callback for agent session spawning via OpenClaw gateway
  taskRouter.onSessionSpawn(async (agentId, taskContext) => {
    console.log(`[TaskRouter] 🚀 Spawning agent ${agentId} for task ${taskContext.taskId}`)
    
    // Build the task message that the agent will receive
    const message = buildAgentMessage(taskContext)
    
    // Spawn via `openclaw agent` in the background
    // This is non-blocking — the agent runs asynchronously
    const timeout = 300 // 5 minute timeout per task
    const args = [
      'agent',
      '--agent', agentId,
      '--message', message,
      '--timeout', String(timeout),
      '--json'
    ]
    
    console.log(`[TaskRouter] Executing: openclaw agent --agent ${agentId} --timeout ${timeout}`)
    
    const child = execFile('openclaw', args, { 
      timeout: (timeout + 30) * 1000, // OS timeout slightly longer
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer for large responses
    }, async (error, stdout, stderr) => {
      try {
        if (error) {
          console.error(`[TaskRouter] Agent ${agentId} error for task ${taskContext.taskId}: ${error.message}`)
          // Release the task back to queued on failure
          await taskRouter.releaseTask(taskContext.taskId)
          await taskRouter.onAgentSessionComplete(agentId, taskContext.taskId, 'error', error.message)
          return
        }
        
        // Parse the agent's response
        let result = {}
        try {
          result = JSON.parse(stdout)
        } catch {
          result = { status: 'ok', raw: stdout?.substring(0, 500) }
        }
        
        console.log(`[TaskRouter] ✅ Agent ${agentId} completed task ${taskContext.taskId} (status: ${result.status || 'unknown'})`)
        
        // Mark the agent session as complete
        await taskRouter.onAgentSessionComplete(agentId, taskContext.taskId, 'completed')
      } catch (completionErr) {
        console.error(`[TaskRouter] Error handling agent completion: ${completionErr.message}`)
      }
    })
    
    // Log the spawned PID
    if (child.pid) {
      console.log(`[TaskRouter] Agent ${agentId} spawned with PID ${child.pid}`)
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
