# OpenClaw Integration Guide

## Session Tracking for Claw Control Center

This guide explains how OpenClaw instances should register spawned sub-agents with the Claw Control Center so they appear in the Mission Control UI.

---

## Overview

When your OpenClaw instance spawns a sub-agent session (using `sessions_spawn` or similar), you should register it with the Control Center's Firestore database. This allows the session to appear in the **Mission Control** agents section in real-time.

### Why Register Sessions?

- **Visibility**: See all active sub-agents in one place
- **Monitoring**: Track session status, tasks, and activity
- **Management**: Terminate stale or idle sessions remotely
- **Audit**: Maintain a log of spawned agents and their work

---

## Quick Start

### 1. Connection Setup

First, ensure your OpenClaw instance is connected to the Control Center:

1. Go to the **Connect** tab in the Control Center web UI
2. Generate a connection token
3. Run the connection command on your OpenClaw instance:
   ```bash
   curl -X POST https://your-bridge.com/api/connect \
     -H "Content-Type: application/json" \
     -d '{"token":"your-token","instanceName":"my-openclaw"}'
   ```
4. Save the returned `instanceId` — you'll need it for session registration

### 2. Register a Session

When you spawn a sub-agent, immediately register it:

**HTTP Request:**
```bash
POST /api/sessions/register
Content-Type: application/json

{
  "sessionKey": "agent:main:subagent:abc123",
  "instanceId": "your-instance-id",
  "label": "dev-worker-1",
  "agentId": "developer",
  "model": "claude-sonnet-4",
  "task": "Implement feature X",
  "status": "active",
  "metadata": {
    "kind": "other",
    "channel": "telegram"
  }
}
```

**Response:**
```json
{
  "id": "session-xyz",
  "userId": "user123",
  "instanceId": "your-instance-id",
  "sessionKey": "agent:main:subagent:abc123",
  "label": "dev-worker-1",
  "agentId": "developer",
  "model": "claude-sonnet-4",
  "task": "Implement feature X",
  "status": "active",
  "spawnedAt": "2026-02-12T01:00:00.000Z",
  "lastSeenAt": "2026-02-12T01:00:00.000Z",
  "metadata": { ... }
}
```

### 3. Update Session Status

As the session progresses, update its status and task:

**HTTP Request:**
```bash
PATCH /api/sessions/update
Content-Type: application/json

{
  "id": "session-xyz",
  "task": "Testing implementation",
  "status": "active"
}
```

### 4. Terminate Session

When the session completes or is no longer needed:

**HTTP Request:**
```bash
DELETE /api/sessions/terminate
Content-Type: application/json

{
  "id": "session-xyz"
}
```

---

## Integration Patterns

### Pattern 1: Register on Spawn

Wrap `sessions_spawn` with registration:

```typescript
async function spawnAndRegister(task: string, label: string) {
  // Spawn the session
  const result = await sessions_spawn({
    task,
    label,
    agentId: 'developer',
    model: 'claude-sonnet-4',
  })

  // Register with Control Center
  await fetch('https://your-bridge.com/api/sessions/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionKey: result.sessionKey,
      instanceId: process.env.INSTANCE_ID,
      label,
      agentId: 'developer',
      model: 'claude-sonnet-4',
      task,
      status: 'active',
    }),
  })

  return result
}
```

### Pattern 2: Heartbeat Updates

Periodically update session status (e.g., every 30s):

```typescript
async function sessionHeartbeat(sessionId: string, task?: string) {
  await fetch('https://your-bridge.com/api/sessions/update', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: sessionId,
      task,
      status: 'active',
    }),
  })
}
```

### Pattern 3: Auto-Cleanup

Register a cleanup handler to terminate sessions when they exit:

```typescript
process.on('exit', async () => {
  await fetch('https://your-bridge.com/api/sessions/terminate', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: sessionId }),
  })
})
```

---

## Session Fields Reference

### Required Fields (Create)

| Field | Type | Description |
|-------|------|-------------|
| `sessionKey` | string | OpenClaw session key (e.g., `agent:main:subagent:xyz`) |
| `instanceId` | string | Your OpenClaw instance ID (from connection) |

### Optional Fields (Create)

| Field | Type | Description |
|-------|------|-------------|
| `label` | string | Human-readable label (e.g., "dev-worker-1") |
| `agentId` | string | Agent ID/type (e.g., "developer", "tester") |
| `model` | string | AI model being used |
| `task` | string | Current task description |
| `status` | `'active' \| 'idle' \| 'terminated'` | Session status (default: `'active'`) |
| `metadata` | object | Additional context (kind, channel, etc.) |

### Update Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Session ID (required) |
| `label` | string | Update label |
| `task` | string | Update current task |
| `status` | string | Update status |
| `model` | string | Update model |

---

## API Endpoints

All endpoints require authentication (use your OpenClaw connection token).

### POST `/api/sessions/register`

Register a new session.

**Request Body:**
```typescript
{
  sessionKey: string
  instanceId: string
  label?: string
  agentId?: string
  model?: string
  task?: string
  status?: 'active' | 'idle' | 'terminated'
  metadata?: object
}
```

**Response:** Full `ActiveSession` object

---

### PATCH `/api/sessions/update`

Update an existing session.

**Request Body:**
```typescript
{
  id: string
  label?: string
  task?: string
  status?: 'active' | 'idle' | 'terminated'
  model?: string
}
```

**Response:** Updated `ActiveSession` object

---

### GET `/api/sessions/list?instanceId={id}`

List all active sessions (optionally filter by instance).

**Query Params:**
- `instanceId` (optional): Filter by instance ID

**Response:**
```json
[
  {
    "id": "session-xyz",
    "sessionKey": "agent:main:subagent:abc123",
    "label": "dev-worker-1",
    "status": "active",
    "task": "Implement feature X",
    ...
  }
]
```

---

### DELETE `/api/sessions/terminate`

Terminate a session (sets status to `'terminated'`).

**Request Body:**
```typescript
{
  id: string
}
```

**Response:**
```json
{
  "ok": true
}
```

---

## Firestore Collection Structure

Sessions are stored in Firestore under:

```
users/
  {userId}/
    activeSessions/
      {sessionId}/
        - id: string
        - userId: string
        - instanceId: string
        - sessionKey: string
        - label?: string
        - agentId?: string
        - model?: string
        - task?: string
        - status: 'active' | 'idle' | 'terminated'
        - spawnedAt: string (ISO timestamp)
        - lastSeenAt: string (ISO timestamp)
        - metadata?: object
```

---

## UI Display

Registered sessions appear in the **Mission Control** agents section:

**Session Card Shows:**
- 🔄 Label or session key
- Status badge (active/idle/terminated)
- Current task (if set)
- Model and agent ID (if set)
- Last seen timestamp
- **Terminate** button (manual cleanup)

**Filtering:**
- Terminated sessions older than 1 hour are automatically hidden
- Sessions are sorted by `lastSeenAt` (most recent first)
- Blue left border distinguishes sessions from profiles and instances

---

## Best Practices

### 1. Register Immediately

Register the session **immediately after spawning**, before any work begins. This ensures visibility from the start.

### 2. Use Descriptive Labels

Choose labels that clearly identify the session's purpose:
- ✅ `"dev-worker-api-endpoints"`
- ✅ `"qa-integration-tests"`
- ❌ `"session-1"`

### 3. Update Task Field

Keep the `task` field updated as the session progresses:
```typescript
await updateSession(sessionId, { task: "Running tests" })
await updateSession(sessionId, { task: "Generating report" })
await updateSession(sessionId, { task: "Cleanup" })
```

### 4. Clean Up on Exit

Always terminate sessions when done:
```typescript
try {
  await doWork()
} finally {
  await terminateSession(sessionId)
}
```

### 5. Handle Failures Gracefully

Session registration failures should **not** block spawning:
```typescript
try {
  await registerSession(data)
} catch (e) {
  console.warn('Failed to register session:', e)
  // Continue anyway
}
```

---

## Troubleshooting

### Sessions Not Appearing in UI

1. **Check authentication**: Ensure your instance is connected with a valid token
2. **Verify instanceId**: Use the exact `instanceId` returned during connection
3. **Check browser console**: Open DevTools to see polling errors
4. **Verify Firestore rules**: Ensure the collection allows read/write for authenticated users

### Sessions Stuck as "Active"

- Ensure you're calling `terminateSession()` when done
- Check for crashes/exceptions that skip cleanup
- Add process exit handlers to terminate on unexpected exits

### Duplicate Sessions

- Use unique `sessionKey` values for each session
- Don't re-register the same session multiple times
- Check for retry loops in your registration code

---

## Example: Full Integration

Here's a complete example showing spawn → register → update → terminate:

```typescript
import { registerSession, updateSession, terminateSession } from './controlCenter'

async function runDevTask(task: string) {
  let sessionId: string | null = null

  try {
    // 1. Spawn the session
    const spawn = await sessions_spawn({
      task,
      label: 'dev-worker-ui',
      agentId: 'developer',
      model: 'claude-sonnet-4',
    })

    // 2. Register with Control Center
    const session = await registerSession({
      sessionKey: spawn.sessionKey,
      instanceId: process.env.INSTANCE_ID!,
      label: 'dev-worker-ui',
      agentId: 'developer',
      model: 'claude-sonnet-4',
      task,
      status: 'active',
    })
    sessionId = session.id

    // 3. Update as work progresses
    await updateSession(sessionId, { task: 'Building UI components' })
    await doUIWork()

    await updateSession(sessionId, { task: 'Writing tests' })
    await doTestWork()

    await updateSession(sessionId, { task: 'Committing changes' })
    await commitWork()

    console.log('✅ Task complete')
  } catch (error) {
    console.error('❌ Task failed:', error)
    if (sessionId) {
      await updateSession(sessionId, { task: `Failed: ${error}`, status: 'terminated' })
    }
  } finally {
    // 4. Always terminate
    if (sessionId) {
      await terminateSession(sessionId)
    }
  }
}
```

---

## Future Enhancements

Planned features for session tracking:

- **Session logs**: View real-time output from spawned agents
- **Resource usage**: Track token/cost/time per session
- **Manual respawn**: Restart terminated sessions from the UI
- **Session history**: Browse past sessions with filters
- **Alerts**: Notify on long-running or stale sessions

---

## Support

For issues or questions:
- **Docs**: https://docs.openclaw.ai
- **Discord**: https://discord.com/invite/clawd
- **GitHub**: https://github.com/openclaw/openclaw

---

**🎯 Key Takeaway**: Register spawned sessions immediately after creation, update task/status as work progresses, and always terminate when done. This ensures accurate visibility in the Control Center.
