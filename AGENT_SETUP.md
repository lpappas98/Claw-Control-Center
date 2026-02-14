# Agent Setup and Task Query Configuration

## Overview

Agents in OpenClaw run a heartbeat process that periodically checks for and executes assigned tasks.

## Task Query API

The agent heartbeat script queries the Bridge API to find tasks assigned to the agent.

### Correct Query Pattern

```
GET /api/tasks?lane=queued&owner={agentId}
```

**Parameters:**
- `lane`: Must be `queued` (not `status`)
- `owner`: Agent ID that owns the task (not `assignee`)

### Common Mistakes (DO NOT USE)

❌ Incorrect: `GET /api/tasks?status=assigned&assignee={id}`
- `status` parameter is not recognized by the API
- `assignee` parameter is not recognized by the API

✅ Correct: `GET /api/tasks?lane=queued&owner={id}`
- Queries the `queued` lane
- Filters by task owner (agent ID)

## Agent Heartbeat Script

**Location:** `/home/openclaw/.openclaw/workspace/scripts/agent-heartbeat.mjs`

**Function:** `checkForTasks(agent)`

The function queries the Bridge API at the configured `BRIDGE_URL` (default: `http://localhost:8787`).

### How It Works

1. Agent starts and loads its identity from `IDENTITY.md`
2. Every 30 seconds, agent sends a heartbeat to `/api/agents/{id}/heartbeat`
3. On each heartbeat, agent checks for queued tasks using the correct query
4. If tasks found, agent claims the highest priority task (P0 > P1 > P2 > P3)
5. Agent spawns an OpenClaw session to execute the task
6. Task status moves through lanes: `queued` → `development` → `review` → `completed`

### Task Lanes

- `queued`: Task is waiting for an agent to claim it
- `development`: Agent has claimed and is actively working on it
- `review`: Task completed, awaiting review
- `blocked`: Task encountered an error or is blocked
- `completed`: Task successfully finished

## Testing Task Assignment

To verify agents are claiming tasks:

```bash
# Create a task assigned to an agent
curl -X POST http://localhost:8787/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Task",
    "problem": "This is a test",
    "lane": "queued",
    "owner": "dev-2",
    "priority": "P1"
  }'

# Agent should claim it within 30 seconds
# You should see in the heartbeat process:
# "Found 1 assigned task(s): [P1] {id}: Test Task"
```

## Key Configuration

| Setting | Default | Purpose |
|---------|---------|---------|
| `BRIDGE_URL` | `http://localhost:8787` | Bridge API endpoint |
| `HEARTBEAT_INTERVAL_MS` | 30000 (30s) | How often to check for tasks |
| `AGENT_WORKSPACE` | Current working directory | Agent workspace path |

## Debugging

If agents aren't picking up tasks:

1. Check Bridge is running: `curl http://localhost:8787/api/health`
2. Verify agent identity: `cat {agent-workspace}/IDENTITY.md`
3. Check heartbeat logs: `cat {agent-workspace}/heartbeat.log`
4. Verify task exists with correct owner: `curl http://localhost:8787/api/tasks`
5. Test query directly: `curl "http://localhost:8787/api/tasks?lane=queued&owner=dev-2"`

## History

- **2026-02-14:** Fixed query parameters from incorrect `status=assigned&assignee={id}` to correct `lane=queued&owner={id}`
