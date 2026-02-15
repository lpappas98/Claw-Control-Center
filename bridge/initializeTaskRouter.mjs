/**
 * Initialize TaskRouter and integrate with server.
 * Push-based execution using OpenClaw sub-agents via gateway /tools/invoke.
 */

import TaskRouter from './taskRouter.mjs'
import { emitTaskQueued, emitTaskCompleted, emitTaskBlocked } from './taskEvents.mjs'
import setupTaskRouterEndpoints from './taskRouterEndpoints.mjs'

// Gateway config — set at runtime by initializeTaskRouter()
let GATEWAY_URL = ''
let GATEWAY_TOKEN = ''

/**
 * Build the message that will be sent to the sub-agent when it spawns.
 */
function buildAgentMessage(taskContext) {
  const t = taskContext
  const lines = [
    `## Task Assignment: ${t.title || 'Untitled'}`,
    `**Task ID:** ${t.taskId}`,
    `**Priority:** ${t.priority || 'P2'}`,
    `**Agent Role:** ${t.owner || 'unassigned'}`,
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
    `2. Use the exec tool to run commands, read/write to edit files.`,
    `3. The workspace is at /home/openclaw/.openclaw/workspace/`,
    `4. The bridge API is at http://localhost:8787`,
    ``,
    `### Commit & Work Data Logging (REQUIRED)`,
    ``,
    `**Before moving to review, you MUST:**`,
    ``,
    `1. **Commit all changes** with descriptive commit messages:`,
    `   \`\`\`bash`,
    `   git add .`,
    `   git commit -m "feat: description of changes"`,
    `   \`\`\``,
    ``,
    `2. **Log your commits and work** via the work data API:`,
    `   \`\`\`bash`,
    `   # Get commit data (hash, message, timestamp)`,
    `   git log -n 3 --format='{"hash":"%H","message":"%s","timestamp":"%aI"}' | \\`,
    `     jq -s '.' > /tmp/commits.json`,
    `   `,
    `   # Log work data`,
    `   curl -X PUT http://localhost:8787/api/tasks/${t.taskId}/work \\`,
    `     -H "Content-Type: application/json" \\`,
    `     -d "$(cat /tmp/commits.json | jq -c '{commits: .}')"`,
    `   \`\`\``,
    ``,
    `3. **If you ran tests**, include test results:`,
    `   \`\`\`bash`,
    `   curl -X PUT http://localhost:8787/api/tasks/${t.taskId}/work \\`,
    `     -H "Content-Type: application/json" \\`,
    `     -d '{`,
    `       "commits": [{"hash":"abc123","message":"feat: impl","timestamp":"2026-02-15T23:00:00Z"}],`,
    `       "testResults": {"passed": 5, "failed": 0, "skipped": 0}`,
    `     }'`,
    `   \`\`\``,
    ``,
    `4. **Then move to review**:`,
    `   \`\`\`bash`,
    `   curl -X PUT http://localhost:8787/api/tasks/${t.taskId} \\`,
    `     -H "Content-Type: application/json" \\`,
    `     -d '{"lane": "review"}'`,
    `   \`\`\``,
    ``,
    `**If blocked:**`,
    `   \`\`\`bash`,
    `   curl -X PUT http://localhost:8787/api/tasks/${t.taskId} \\`,
    `     -H "Content-Type: application/json" \\`,
    `     -d '{"lane": "blocked"}'`,
    `   \`\`\``,
    ``,
    `**Why this matters:** Work data creates an audit trail showing what you accomplished. Missing work data indicates the task wasn't completed properly.`,
    ''
  )
  
  return lines.join('\n')
}

/**
 * Spawn a sub-agent via the gateway /tools/invoke endpoint.
 * Returns { ok, childSessionKey, runId } or { ok: false, error }
 */
async function spawnSubAgent(agentId, message, label) {
  const res = await fetch(`${GATEWAY_URL}/tools/invoke`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GATEWAY_TOKEN}`,
    },
    body: JSON.stringify({
      tool: 'sessions_spawn',
      args: {
        task: message,
        label: label || `task-${agentId}`,
        model: 'anthropic/claude-sonnet-4-5',
        runTimeoutSeconds: 600, // 10 minute timeout
      },
    }),
    signal: AbortSignal.timeout(15000),
  })

  if (!res.ok) {
    const text = await res.text()
    return { ok: false, error: `Gateway returned ${res.status}: ${text}` }
  }

  const data = await res.json()
  
  // Extract from gateway envelope
  const details = data.result?.details || {}
  if (details.status === 'accepted') {
    return {
      ok: true,
      childSessionKey: details.childSessionKey,
      runId: details.runId,
    }
  }

  // Try parsing from text content
  const text = data.result?.content?.find(c => c.type === 'text')?.text
  if (text) {
    const parsed = JSON.parse(text)
    if (parsed.status === 'accepted') {
      return {
        ok: true,
        childSessionKey: parsed.childSessionKey,
        runId: parsed.runId,
      }
    }
  }

  return { ok: false, error: `Unexpected response: ${JSON.stringify(data).substring(0, 200)}` }
}

/**
 * Initialize TaskRouter with stores and attach to server
 */
export async function initializeTaskRouter(app, tasksStore, agentsStore, subAgentRegistry, options = {}) {
  // Set gateway config from caller (avoids ESM import-time env var issues)
  GATEWAY_URL = options.gatewayUrl || process.env.GATEWAY_URL || 'http://172.18.0.1:18789'
  GATEWAY_TOKEN = options.gatewayToken || process.env.GATEWAY_TOKEN || ''
  
  console.log('[TaskRouter] Initializing push-based execution model...')
  
  const taskRouter = new TaskRouter(tasksStore, agentsStore)
  taskRouter.setRegistry(subAgentRegistry)
  await taskRouter.initialize()
  
  setupTaskRouterEndpoints(app, tasksStore, taskRouter)
  
  // Hook task creation → emit taskQueued event
  const originalTaskCreatedCallback = global.onTaskCreated
  global.onTaskCreated = (task) => {
    console.log(`[TaskRouter] Task created: ${task.id}`)
    emitTaskQueued(task.id, task.owner || task.assignedTo, task)
    if (originalTaskCreatedCallback) originalTaskCreatedCallback(task)
  }
  
  // Hook task updates → trigger router for re-queued tasks
  const originalTaskUpdatedCallback = global.onTaskUpdated
  global.onTaskUpdated = (task, oldTask) => {
    if (task.lane === 'queued' && oldTask.lane !== 'queued') {
      console.log(`[TaskRouter] Task moved to queued: ${task.id}`)
      emitTaskQueued(task.id, task.owner || task.assignedTo, task)
    }
    if (originalTaskUpdatedCallback) originalTaskUpdatedCallback(task, oldTask)
  }
  
  // Retry tracking
  const retryCount = new Map()
  const MAX_RETRIES = 3
  
  // Register spawn callback — uses gateway sub-agents
  taskRouter.onSessionSpawn(async (agentId, taskContext) => {
    const taskId = taskContext.taskId
    const retries = retryCount.get(taskId) || 0
    
    if (retries >= MAX_RETRIES) {
      console.error(`[TaskRouter] ❌ Failed ${MAX_RETRIES} times for task ${taskId} — blocking`)
      retryCount.delete(taskId)
      try {
        await tasksStore.update(taskId, { lane: 'blocked', statusNote: `Spawn failed after ${MAX_RETRIES} attempts` })
      } catch (e) { console.error('[TaskRouter] Block error:', e.message) }
      return
    }
    
    retryCount.set(taskId, retries + 1)
    console.log(`[TaskRouter] 🚀 Spawning sub-agent for ${agentId} → task ${taskId} (attempt ${retries + 1}/${MAX_RETRIES})`)
    
    const message = buildAgentMessage(taskContext)
    const label = `${agentId}-${taskId.substring(0, 8)}`
    
    try {
      const result = await spawnSubAgent(agentId, message, label)
      
      if (!result.ok) {
        throw new Error(result.error)
      }
      
      console.log(`[TaskRouter] ✅ Sub-agent spawned: ${result.childSessionKey} (run: ${result.runId})`)
      
      // Register in sub-agent registry
      if (subAgentRegistry) {
        await subAgentRegistry.register({
          childSessionKey: result.childSessionKey,
          runId: result.runId,
          agentId,
          taskId,
          taskTitle: taskContext.title,
          taskPriority: taskContext.priority,
          taskTag: taskContext.tags?.[0] || null,
          spawnedAt: Date.now(),
        })
      }
      
      // Emit activity event
      if (global.addActivity) {
        global.addActivity({
          type: 'agent_spawn',
          agent: agentId,
          taskId,
          taskTitle: taskContext.title,
          time: Date.now(),
          message: `${agentId} started working on "${taskContext.title}"`,
        })
      }
      
      // Clear retry count on success
      retryCount.delete(taskId)
      
    } catch (err) {
      console.error(`[TaskRouter] Spawn error for ${agentId} → ${taskId}: ${err.message}`)
      try { await taskRouter.releaseTask(taskId) } catch {}
    }
  })
  
  global.taskRouter = taskRouter
  
  console.log('[TaskRouter] ✅ Initialized (sub-agent mode)')
  console.log(`[TaskRouter] Gateway: ${GATEWAY_URL}`)
  
  return taskRouter
}

/**
 * Health monitor cron — runs every 5 minutes
 */
export async function runTaskRouterHealthMonitor(taskRouter, tasksStore, agentsStore = null, subAgentRegistry = null) {
  console.log('[TaskRouter] Running health monitor...')
  
  try {
    const activeSessions = taskRouter.getActiveSessions()
    
    // Check for orphaned tasks in development for >15 minutes
    const devTasks = await tasksStore.getAll({ lane: 'development' })
    const now = Date.now()
    const orphanThresholdMs = 15 * 60 * 1000
    
    for (const task of devTasks) {
      const claimedAt = task.claimedAt || task.updatedAt
      const ageMs = now - (typeof claimedAt === 'number' ? claimedAt : new Date(claimedAt).getTime())
      
      if (ageMs > orphanThresholdMs) {
        // Check if there's still an active sub-agent for this task
        const regEntry = subAgentRegistry?.getByTaskId(task.id)
        if (!regEntry || regEntry.status !== 'active') {
          console.log(`[TaskRouter] Orphaned task: ${task.id} (${Math.round(ageMs / 60000)}m, no active sub-agent)`)
          await taskRouter.releaseTask(task.id)
        } else {
          console.log(`[TaskRouter] Long-running task: ${task.id} (${Math.round(ageMs / 60000)}m, sub-agent still active)`)
        }
      }
    }
    
    // Try to spawn waiting tasks
    const queuedTasks = await tasksStore.getAll({ lane: 'queued' })
    console.log(`[TaskRouter] Health: ${activeSessions.size} active, ${queuedTasks.length} queued, ${devTasks.length} in development`)
    await taskRouter.trySpawnWaitingTasks()
    
    // Prune old registry entries
    if (subAgentRegistry) {
      await subAgentRegistry.prune(50)
    }
    
    console.log('[TaskRouter] Health monitor complete')
  } catch (err) {
    console.error('[TaskRouter] Health monitor error:', err.message)
  }
}

export default { initializeTaskRouter, runTaskRouterHealthMonitor }
