# Sub-Agent Architecture

The Claw Control Center uses a **push-based execution model** where tasks trigger agent spawns instantly, rather than agents polling for work.

## Overview

```
Task Created (POST /api/tasks with lane: "queued")
  │
  ▼
global.onTaskCreated fires
  │
  ▼
TaskRouter.onTaskQueued(taskId, owner, task)
  │
  ├─ Can we spawn? (under MAX_CONCURRENT + agent not busy)
  │
  ▼
Claim task (lane: queued → development)
  │
  ▼
Enqueue spawn request → Sequential spawn queue
  │
  ▼
Queue processor: spawn one at a time (3-5s between each)
  │
  ▼
spawnAgentSession()
  │
  ▼
HTTP POST to OpenClaw gateway /tools/invoke
  { tool: "sessions_spawn", args: { task, label, model } }
  │
  ▼
SubAgentRegistry.register({ childSessionKey, runId, agentId, taskId, ... })
  │
  ▼
Sub-agent works autonomously (reads files, writes code, commits, etc.)
  │
  ▼
Sub-agent calls PUT /api/tasks/:id { lane: "review" } when done
  │
  ▼
SubAgentTracker detects session completion → updates registry
```

## Key Components

### TaskRouter (`bridge/taskRouter.mjs`)

The brain of the system. Listens for task creation events and decides when/how to spawn agents.

**Responsibilities:**
- Listens for `task:queued` events
- Checks if the assigned agent is available (not already working)
- Checks if we're under `MAX_CONCURRENT` limit
- Claims the task (moves to `development` lane)
- Enqueues spawn requests into the sequential queue
- Handles retries (up to `MAX_RETRIES`) on spawn failure

**Configuration:**
```javascript
const MAX_CONCURRENT = 4    // Max parallel sub-agents
const MAX_RETRIES = 3       // Attempts before moving to blocked
const SPAWN_DELAY_MS = 3000 // Delay between sequential spawns
```

### SubAgentRegistry (`bridge/subAgentRegistry.mjs`)

Single source of truth for active sub-agent sessions. Persists to `.clawhub/sub-agent-registry.json`.

**Data stored per agent:**
```json
{
  "childSessionKey": "agent:main:subagent:uuid",
  "runId": "uuid",
  "agentId": "forge",
  "taskId": "task-abc123",
  "taskTitle": "Implement feature X",
  "taskPriority": "P1",
  "taskTag": "backend",
  "spawnedAt": 1708012345000,
  "status": "running"
}
```

**Key methods:**
- `register(session)` — Track a new sub-agent
- `getActive()` — All currently running agents
- `getByAgent(agentId)` — Check if agent is busy
- `markComplete(childSessionKey)` — Mark agent as done
- `markFailed(childSessionKey, error)` — Mark agent as failed

### SubAgentTracker (`bridge/subAgentTracker.mjs`)

Polls the OpenClaw gateway every 15 seconds to detect completed or failed sub-agent sessions. This catches cases where:
- A sub-agent completes but doesn't call the bridge API
- A sub-agent crashes or times out
- The bridge restarts and needs to reconcile state

### InitializeTaskRouter (`bridge/initializeTaskRouter.mjs`)

Wires everything together at server startup:
- Creates the spawn callback that calls the OpenClaw gateway
- Configures the sub-agent model and label format
- Reads gateway config from `.clawhub/config.json`
- Sets up the `global.onTaskCreated` hook

### LegacyTasksAdapter (`bridge/legacyTasksAdapter.mjs`)

Wraps the legacy in-memory `tasks[]` array with a store interface so the TaskRouter can read/write tasks through a unified API.

## How Sub-Agents Get Context

When a sub-agent is spawned, it receives a task message like:

```
You are an AI agent working on a task for the Claw Control Center.

Task: Implement user authentication
Priority: P0
Owner: forge

Problem: Users need to log in before accessing the dashboard.

Scope: Add JWT auth middleware to Express server.

Acceptance Criteria:
- Login endpoint returns JWT token
- Protected routes require valid token

When complete, move the task to review:
curl -X PUT http://localhost:8787/api/tasks/TASK_ID \
  -H "Content-Type: application/json" \
  -d '{"lane": "review"}'
```

Sub-agents inherit the full workspace and all OpenClaw tools (exec, read, write, web_search, etc.). They work just like a human developer would — reading code, making changes, committing, and updating the task status.

## Retry & Failure Handling

```
Spawn attempt 1 fails (gateway timeout)
  → Wait 3s
  → Spawn attempt 2 fails
    → Wait 3s
    → Spawn attempt 3 fails
      → Move task to "blocked" lane
      → Log failure in activity feed
```

Each failed spawn is logged. After `MAX_RETRIES` (default 3), the task moves to the `blocked` lane so it's visible in the UI and can be manually re-queued.

## Sequential Spawn Queue

Spawning multiple sub-agents simultaneously can overwhelm the gateway. The TaskRouter uses a sequential queue:

1. Multiple tasks arrive at once → all enqueued
2. Queue processes one spawn at a time
3. 3-5 second delay between each spawn
4. Agents execute in parallel after spawning — only the spawn itself is sequential

This ensures reliable spawning even with 4 concurrent agents.

## Gateway Communication

The bridge communicates with OpenClaw via HTTP:

```
Bridge → POST http://{gatewayUrl}/tools/invoke
Headers: { Authorization: Bearer {gatewayToken} }
Body: {
  "tool": "sessions_spawn",
  "args": {
    "task": "Agent prompt with task details...",
    "label": "forge-task-abc",
    "model": "anthropic/claude-sonnet-4-5"
  }
}

Response: {
  "childSessionKey": "agent:main:subagent:uuid",
  "runId": "uuid"
}
```

Gateway config is stored in `.clawhub/config.json`:
```json
{
  "gatewayToken": "your-token-here",
  "gatewayUrl": "http://172.18.0.1:18789"
}
```

**Finding the gateway URL from Docker:**
The gateway runs on the host machine. From inside a Docker container on the `claw-net` bridge network, the host is typically reachable at `172.18.0.1`. Verify with:
```bash
docker network inspect claw-net | grep Gateway
```

## Monitoring

### API Endpoints
- `GET /api/agents/status` — All agents with live status (active/idle) and current task details
- `GET /api/agents/active` — Only currently active sub-agents
- `GET /api/agents/:id/history` — Spawn history for a specific agent

### Activity Feed
All sub-agent events are emitted to the activity feed (via WebSocket):
- `agent:spawn` — Sub-agent spawned for task
- `agent:complete` — Sub-agent finished successfully
- `agent:fail` — Sub-agent failed or timed out

### UI Dashboard
The Mission Control page shows:
- **Agent strip** — Live tiles for each working agent with task name and elapsed time
- **Kanban board** — Tasks moving through lanes in real-time
- **Activity feed** — Chronological event log
