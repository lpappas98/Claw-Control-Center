# Worker Service Architecture

**Version**: 1.0  
**Author**: Blueprint (Architect Agent)  
**Date**: 2026-02-12  
**Status**: Design Phase

---

## Overview

This document defines the architecture for persistent worker services that replace the current fake heartbeat system. Workers are long-running Node.js processes that:

- Poll the task queue for assigned work
- Spawn Claude sessions to execute tasks
- Maintain real-time heartbeat status
- Handle errors and recover gracefully

---

## 1. Heartbeat Schema

### Storage Location
```
.clawhub/worker-heartbeats.json
```

### Schema Definition

```json
{
  "workers": {
    "slot-1": {
      "slot": "slot-1",
      "status": "idle",
      "task": null,
      "taskTitle": null,
      "sessionId": null,
      "lastUpdate": 1770865572000,
      "startedAt": 1770860000000,
      "metadata": {
        "workerPid": 12345,
        "workerVersion": "1.0.0",
        "restartCount": 0
      }
    },
    "slot-2": {
      "slot": "slot-2",
      "status": "working",
      "task": "task-abc123-1770865000000",
      "taskTitle": "Review code changes for PR #42",
      "sessionId": "agent:main:worker-slot-2:def456",
      "lastUpdate": 1770865570000,
      "startedAt": 1770860100000,
      "metadata": {
        "workerPid": 12346,
        "workerVersion": "1.0.0",
        "restartCount": 1,
        "taskStartedAt": 1770865400000
      }
    },
    "slot-3": {
      "slot": "slot-3",
      "status": "offline",
      "task": null,
      "taskTitle": null,
      "sessionId": null,
      "lastUpdate": 1770865200000,
      "startedAt": 1770860200000,
      "metadata": {
        "workerPid": null,
        "workerVersion": "1.0.0",
        "restartCount": 0,
        "offlineReason": "graceful-shutdown"
      }
    }
  }
}
```

### Field Definitions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `slot` | string | Yes | Unique identifier for the worker slot (e.g., "slot-1") |
| `status` | enum | Yes | Current status: `idle`, `working`, `offline` |
| `task` | string \| null | Yes | Current task ID if working, null otherwise |
| `taskTitle` | string \| null | Yes | Human-readable task title if working, null otherwise |
| `sessionId` | string \| null | Yes | Claude session ID if working, null otherwise |
| `lastUpdate` | number | Yes | Unix timestamp (ms) of last heartbeat update |
| `startedAt` | number | Yes | Unix timestamp (ms) when worker first started |
| `metadata` | object | No | Additional worker-specific metadata |

### Status Values

- **`idle`**: Worker is running and waiting for tasks
- **`working`**: Worker is actively executing a task
- **`offline`**: Worker is not running (crashed, stopped, or shutting down)

### Update Frequency

- **Idle workers**: Update heartbeat every 30 seconds
- **Working workers**: Update heartbeat every 15 seconds (to show liveness during long tasks)
- **Stale detection**: If `lastUpdate` is older than 90 seconds, mark worker as potentially crashed

---

## 2. Worker Lifecycle

### State Diagram

```
[Start] → Initialize → [Idle] → Poll Queue → Task Found?
                         ↑                          |
                         |                         Yes
                         |                          ↓
                    [Idle] ← Task Complete ← [Working]
                         ↑                          |
                         |                    Session Failed?
                         └──────────────────────────┘
                                    |
                              Retry/Abandon
```

### Lifecycle Phases

#### 1. **Startup**
```javascript
async function startup(slotId) {
  // 1. Initialize worker state
  const workerId = `worker-${slotId}`;
  const startedAt = Date.now();
  
  // 2. Write initial heartbeat
  await updateHeartbeat({
    slot: slotId,
    status: 'idle',
    task: null,
    taskTitle: null,
    sessionId: null,
    lastUpdate: Date.now(),
    startedAt: startedAt,
    metadata: {
      workerPid: process.pid,
      workerVersion: getVersion(),
      restartCount: await getRestartCount(slotId)
    }
  });
  
  // 3. Set up signal handlers for graceful shutdown
  process.on('SIGTERM', () => gracefulShutdown(slotId));
  process.on('SIGINT', () => gracefulShutdown(slotId));
  
  // 4. Start main loop
  console.log(`[${slotId}] Worker started, entering main loop`);
  await mainLoop(slotId);
}
```

#### 2. **Task Detection** (Polling)
```javascript
async function pollForTask(slotId) {
  try {
    // Poll every 30 seconds
    const response = await fetch('http://localhost:8787/api/tasks');
    const tasks = await response.json();
    
    // Filter for tasks assigned to this slot
    const myTask = tasks
      .filter(t => t.owner === slotId && t.status === 'todo')
      .sort((a, b) => (b.priority || 0) - (a.priority || 0))[0];
    
    return myTask || null;
  } catch (error) {
    console.error(`[${slotId}] Failed to poll tasks:`, error);
    return null;
  }
}
```

#### 3. **Task Pickup**
```javascript
async function pickupTask(slotId, task) {
  // 1. Update heartbeat to "working"
  const sessionId = `agent:main:worker-${slotId}:${randomUUID()}`;
  
  await updateHeartbeat({
    slot: slotId,
    status: 'working',
    task: task.id,
    taskTitle: task.title,
    sessionId: sessionId,
    lastUpdate: Date.now(),
    metadata: {
      taskStartedAt: Date.now()
    }
  });
  
  // 2. Update task status to "in-progress"
  await fetch(`http://localhost:8787/api/tasks/${task.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'in-progress' })
  });
  
  // 3. Spawn Claude session
  const session = await spawnSession(sessionId, task);
  
  // 4. Monitor session
  await monitorSession(slotId, sessionId, task);
}
```

#### 4. **Session Monitoring**
```javascript
async function monitorSession(slotId, sessionId, task) {
  const pollInterval = 15000; // 15 seconds
  const maxDuration = 30 * 60 * 1000; // 30 minutes max per task
  const startTime = Date.now();
  
  while (true) {
    // Update heartbeat to show liveness
    await updateHeartbeat({
      slot: slotId,
      status: 'working',
      task: task.id,
      taskTitle: task.title,
      sessionId: sessionId,
      lastUpdate: Date.now()
    });
    
    // Check session status
    const status = await getSessionStatus(sessionId);
    
    if (status === 'complete') {
      console.log(`[${slotId}] Task ${task.id} completed successfully`);
      await completeTask(slotId, task.id, 'done');
      break;
    }
    
    if (status === 'failed') {
      console.error(`[${slotId}] Task ${task.id} failed`);
      await completeTask(slotId, task.id, 'blocked');
      break;
    }
    
    // Check for timeout
    if (Date.now() - startTime > maxDuration) {
      console.error(`[${slotId}] Task ${task.id} timed out`);
      await killSession(sessionId);
      await completeTask(slotId, task.id, 'blocked');
      break;
    }
    
    // Wait before next poll
    await sleep(pollInterval);
  }
}
```

#### 5. **Task Completion**
```javascript
async function completeTask(slotId, taskId, finalStatus) {
  // 1. Update task status
  await fetch(`http://localhost:8787/api/tasks/${taskId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: finalStatus })
  });
  
  // 2. Reset heartbeat to idle
  await updateHeartbeat({
    slot: slotId,
    status: 'idle',
    task: null,
    taskTitle: null,
    sessionId: null,
    lastUpdate: Date.now()
  });
  
  console.log(`[${slotId}] Returned to idle state`);
}
```

#### 6. **Graceful Shutdown**
```javascript
async function gracefulShutdown(slotId) {
  console.log(`[${slotId}] Graceful shutdown initiated`);
  
  // 1. Stop accepting new tasks
  shutdown = true;
  
  // 2. Wait for current task to complete (with timeout)
  const currentTask = await getCurrentTask(slotId);
  if (currentTask) {
    console.log(`[${slotId}] Waiting for current task to complete...`);
    await waitForTaskOrTimeout(currentTask, 5 * 60 * 1000); // 5 min max
  }
  
  // 3. Update heartbeat to offline
  await updateHeartbeat({
    slot: slotId,
    status: 'offline',
    task: null,
    taskTitle: null,
    sessionId: null,
    lastUpdate: Date.now(),
    metadata: {
      offlineReason: 'graceful-shutdown'
    }
  });
  
  // 4. Exit
  process.exit(0);
}
```

---

## 3. Task Polling Strategy

### API Endpoint
```
GET http://localhost:8787/api/tasks
```

Returns all tasks in the system. Workers filter client-side.

### Filter Logic

```javascript
function filterTasksForSlot(tasks, slotId) {
  return tasks.filter(task => {
    // 1. Must be assigned to this slot
    if (task.owner !== slotId) return false;
    
    // 2. Must be in "todo" status
    if (task.status !== 'todo') return false;
    
    // 3. Must not be blocked by dependencies (future enhancement)
    // if (task.blockedBy && task.blockedBy.length > 0) return false;
    
    return true;
  });
}
```

### Priority Handling

Tasks include an optional `priority` field (numeric). Higher values = higher priority.

```javascript
function selectNextTask(tasks, slotId) {
  const eligibleTasks = filterTasksForSlot(tasks, slotId);
  
  if (eligibleTasks.length === 0) return null;
  
  // Sort by priority (descending), then by creation time (ascending)
  eligibleTasks.sort((a, b) => {
    const priorityDiff = (b.priority || 0) - (a.priority || 0);
    if (priorityDiff !== 0) return priorityDiff;
    
    return a.createdAt - b.createdAt; // FIFO as tiebreaker
  });
  
  return eligibleTasks[0];
}
```

### Concurrent Task Handling

**Decision**: Workers handle **one task at a time** (no concurrency within a single worker).

**Rationale**:
- Simplifies state management
- Easier error handling and recovery
- Claude sessions are resource-intensive
- Horizontal scaling via multiple workers is preferred over vertical concurrency

If concurrent execution is needed in the future, spawn multiple workers for the same slot.

### Poll Interval

- **Base interval**: 30 seconds
- **Backoff on failure**: Exponential backoff up to 5 minutes
- **Jitter**: Add random 0-5 second offset to prevent thundering herd

```javascript
async function pollWithBackoff(slotId) {
  let backoffMs = 30000; // 30 seconds
  const maxBackoff = 5 * 60 * 1000; // 5 minutes
  
  while (!shutdown) {
    try {
      const task = await pollForTask(slotId);
      
      if (task) {
        await pickupTask(slotId, task);
        backoffMs = 30000; // Reset backoff on success
      }
      
      // Add jitter
      const jitter = Math.random() * 5000;
      await sleep(backoffMs + jitter);
      
    } catch (error) {
      console.error(`[${slotId}] Poll error:`, error);
      backoffMs = Math.min(backoffMs * 2, maxBackoff);
      await sleep(backoffMs);
    }
  }
}
```

---

## 4. Session Spawn Integration

### Sessions API

Workers use OpenClaw's `sessions_spawn` API to create Claude sessions.

### API Call Example

```javascript
async function spawnSession(sessionId, task) {
  const response = await fetch('http://localhost:8787/api/sessions/spawn', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionLabel: sessionId,
      channel: 'internal', // or 'telegram' if notifications needed
      prompt: buildPromptForTask(task),
      model: task.model || 'anthropic/claude-sonnet-4-5',
      thinking: 'low',
      autoStart: true
    })
  });
  
  if (!response.ok) {
    throw new Error(`Failed to spawn session: ${response.statusText}`);
  }
  
  const result = await response.json();
  return result;
}
```

### Task Data Passed to Session

The worker constructs a prompt that includes:

1. **Task context**: ID, title, description, owner
2. **Task instructions**: Step-by-step guidance from task description
3. **Working directory**: From task metadata
4. **Expected deliverables**: Clear success criteria
5. **Completion signal**: How to report task completion

```javascript
function buildPromptForTask(task) {
  return `You are a worker agent assigned to complete a task.

**Task ID**: ${task.id}
**Task Title**: ${task.title}
**Owner**: ${task.owner}
**Working Directory**: ${task.workingDir || '/home/openclaw/.openclaw/workspace/'}

**Description**:
${task.description}

**Instructions**:
${task.instructions || 'Complete the task as described above.'}

**Deliverables**:
${task.deliverables || 'Provide a summary of what was accomplished.'}

**Steps**:
${formatSteps(task.steps)}

**Completion**:
When finished, update the task status to "review" or "done" by calling:
\`\`\`bash
curl -X PATCH http://localhost:8787/api/tasks/${task.id} \\
  -H "Content-Type: application/json" \\
  -d '{"status": "review"}'
\`\`\`

Then report your findings.
`;
}

function formatSteps(steps) {
  if (!steps || steps.length === 0) return '(No specific steps provided)';
  return steps.map((step, i) => `${i + 1}. ${step}`).join('\n');
}
```

### Session Monitoring

```javascript
async function getSessionStatus(sessionId) {
  // Query sessions API for status
  const response = await fetch('http://localhost:8787/api/sessions');
  if (!response.ok) return 'unknown';
  
  const sessions = await response.json();
  const session = sessions.find(s => s.id === sessionId);
  
  if (!session) return 'unknown';
  if (session.completed) return 'complete';
  if (session.error) return 'failed';
  
  return 'running';
}
```

### Error Handling When Session Fails

```javascript
async function handleSessionFailure(slotId, sessionId, task, error) {
  console.error(`[${slotId}] Session ${sessionId} failed:`, error);
  
  // 1. Mark task as blocked
  await fetch(`http://localhost:8787/api/tasks/${task.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'blocked',
      metadata: {
        errorReason: error.message,
        failedAt: Date.now(),
        sessionId: sessionId
      }
    })
  });
  
  // 2. Clean up session resources
  await killSession(sessionId);
  
  // 3. Return to idle
  await updateHeartbeat({
    slot: slotId,
    status: 'idle',
    task: null,
    taskTitle: null,
    sessionId: null,
    lastUpdate: Date.now()
  });
  
  // 4. Notify admins (future enhancement)
  // await notifyFailure(slotId, task.id, error);
}
```

---

## 5. Error Handling Strategy

### Session Timeout Handling

**Problem**: Claude sessions may hang or run indefinitely.

**Solution**: Implement task-level timeout

```javascript
const DEFAULT_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const MAX_TIMEOUT = 2 * 60 * 60 * 1000; // 2 hours

async function monitorWithTimeout(slotId, sessionId, task) {
  const timeout = task.timeoutMs || DEFAULT_TIMEOUT;
  const startTime = Date.now();
  
  const timeoutPromise = new Promise((resolve) => {
    setTimeout(() => resolve('timeout'), timeout);
  });
  
  const monitorPromise = monitorSession(slotId, sessionId, task);
  
  const result = await Promise.race([monitorPromise, timeoutPromise]);
  
  if (result === 'timeout') {
    console.error(`[${slotId}] Task ${task.id} timed out after ${timeout}ms`);
    await killSession(sessionId);
    await handleSessionFailure(slotId, sessionId, task, 
      new Error('Session timeout exceeded'));
  }
}
```

### API Call Failures

**Problem**: Network errors, API downtime, or transient failures.

**Solution**: Retry with exponential backoff

```javascript
async function fetchWithRetry(url, options, maxRetries = 3) {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      
      // Don't retry on 4xx errors (client errors)
      if (response.status >= 400 && response.status < 500) {
        throw new Error(`Client error: ${response.status}`);
      }
      
    } catch (error) {
      lastError = error;
      const backoff = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
      console.warn(`Retry ${attempt + 1}/${maxRetries} after ${backoff}ms`);
      await sleep(backoff);
    }
  }
  
  throw lastError;
}
```

### Crash Recovery

**Problem**: Worker process crashes unexpectedly.

**Solution**: Use process manager (PM2, systemd, or Docker restart policy) + heartbeat monitoring

#### PM2 Configuration Example

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'worker-slot-1',
      script: './bridge/worker.mjs',
      args: 'slot-1',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production',
        SLOT_ID: 'slot-1'
      }
    },
    {
      name: 'worker-slot-2',
      script: './bridge/worker.mjs',
      args: 'slot-2',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production',
        SLOT_ID: 'slot-2'
      }
    }
  ]
};
```

#### On-Restart Behavior

```javascript
async function recoverFromCrash(slotId) {
  // 1. Check for orphaned task
  const heartbeat = await readHeartbeat(slotId);
  
  if (heartbeat && heartbeat.status === 'working') {
    console.log(`[${slotId}] Found orphaned task: ${heartbeat.task}`);
    
    // 2. Kill orphaned session
    if (heartbeat.sessionId) {
      await killSession(heartbeat.sessionId);
    }
    
    // 3. Reset task to "todo" for retry
    await fetch(`http://localhost:8787/api/tasks/${heartbeat.task}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'todo',
        metadata: {
          crashRecovery: true,
          previousSession: heartbeat.sessionId,
          recoveredAt: Date.now()
        }
      })
    });
  }
  
  // 4. Increment restart counter
  await incrementRestartCount(slotId);
}
```

### Stale Task Detection

**Problem**: Tasks stuck in "in-progress" but worker is offline or crashed.

**Solution**: Watchdog service monitors heartbeats

```javascript
// Separate watchdog service (runs every 2 minutes)
async function detectStaleWorkers() {
  const heartbeats = await readAllHeartbeats();
  const now = Date.now();
  const staleThreshold = 90 * 1000; // 90 seconds
  
  for (const [slot, heartbeat] of Object.entries(heartbeats.workers)) {
    const age = now - heartbeat.lastUpdate;
    
    if (age > staleThreshold && heartbeat.status !== 'offline') {
      console.warn(`Stale worker detected: ${slot} (${age}ms old)`);
      
      // Mark as offline
      await updateHeartbeat({
        ...heartbeat,
        status: 'offline',
        metadata: {
          ...heartbeat.metadata,
          offlineReason: 'stale-heartbeat',
          detectedAt: now
        }
      });
      
      // Reset any in-progress task
      if (heartbeat.task) {
        await fetch(`http://localhost:8787/api/tasks/${heartbeat.task}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'todo' })
        });
      }
    }
  }
}
```

---

## 6. Implementation Checklist

### Phase 1: Core Worker
- [ ] Create `bridge/worker.mjs` with main loop
- [ ] Implement heartbeat read/write functions
- [ ] Implement task polling logic
- [ ] Add graceful shutdown handlers

### Phase 2: Session Integration
- [ ] Implement `spawnSession()` function
- [ ] Build task-to-prompt conversion
- [ ] Add session monitoring loop
- [ ] Handle session completion/failure

### Phase 3: Error Handling
- [ ] Add timeout detection
- [ ] Implement retry logic for API calls
- [ ] Create crash recovery logic
- [ ] Build stale task watchdog

### Phase 4: Deployment
- [ ] Create PM2/systemd configuration
- [ ] Set up worker environment variables
- [ ] Test crash recovery behavior
- [ ] Monitor production heartbeats

### Phase 5: Monitoring & Observability
- [ ] Add structured logging
- [ ] Create worker metrics dashboard
- [ ] Set up alerting for stale workers
- [ ] Build worker restart counter tracking

---

## 7. Example Worker Implementation

See `bridge/worker.mjs` for reference implementation.

### Basic Structure

```javascript
#!/usr/bin/env node
import { updateHeartbeat, readHeartbeat } from './slot-heartbeats.mjs';

const SLOT_ID = process.argv[2] || process.env.SLOT_ID;
if (!SLOT_ID) {
  console.error('Usage: worker.mjs <slot-id>');
  process.exit(1);
}

let shutdown = false;

async function main() {
  console.log(`[${SLOT_ID}] Worker starting...`);
  await startup(SLOT_ID);
  
  while (!shutdown) {
    await pollAndExecute(SLOT_ID);
    await sleep(30000); // 30 second poll interval
  }
}

process.on('SIGTERM', () => gracefulShutdown(SLOT_ID));
process.on('SIGINT', () => gracefulShutdown(SLOT_ID));

main().catch(err => {
  console.error(`[${SLOT_ID}] Fatal error:`, err);
  process.exit(1);
});
```

---

## 8. Future Enhancements

### Multi-Task Concurrency
Allow workers to handle multiple tasks simultaneously (with resource limits).

### Task Dependencies
Implement `blockedBy` field to prevent tasks from starting until dependencies complete.

### Priority Queues
Separate high/medium/low priority queues with different polling strategies.

### Session Checkpointing
Periodically save session state to enable resume-on-crash.

### Distributed Workers
Scale workers across multiple machines with centralized heartbeat coordination.

### Adaptive Polling
Adjust poll frequency based on queue depth and task arrival rate.

---

## Appendix A: API Endpoints Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/tasks` | GET | List all tasks |
| `/api/tasks/:id` | GET | Get single task |
| `/api/tasks/:id` | PATCH | Update task status/metadata |
| `/api/sessions/spawn` | POST | Spawn new Claude session |
| `/api/sessions` | GET | List active sessions |
| `/api/sessions/:id` | DELETE | Kill session |
| `/api/heartbeats` | GET | Get all worker heartbeats |

---

## Appendix B: Glossary

- **Slot**: A logical worker identifier (e.g., "slot-1", "slot-2")
- **Heartbeat**: Periodic status update showing worker liveness
- **Session**: A Claude conversation instance spawned to execute a task
- **Task**: A unit of work with owner, description, and deliverables
- **Watchdog**: Monitoring service that detects and recovers stale workers

---

**End of Document**
