# OpenClaw Instance Integration Guide

## Overview

The Claw Control Center uses a **local-first bridge architecture**. There is no authentication, no cloud connection, and no instance "registration" ceremony. Your OpenClaw instance simply calls the bridge API endpoints directly.

**Bridge URL:** `http://localhost:8787` (or `http://<host-ip>:8787` from another device)

---

## Quick Start

### 1. Start the Bridge Server

```bash
cd /path/to/claw-control-center
npm run bridge
```

Bridge listens on `http://localhost:8787`

### 2. Access the UI

```bash
npm run dev  # or open deployed UI
```

UI available at `http://localhost:5173` (or `http://<host-ip>:5173`)

### 3. Use from OpenClaw

Your OpenClaw instance can now:
- Create/update tasks
- Register spawned sub-agents (sessions)
- Create agent profiles
- Read project data

---

## API Reference

### Tasks

**Create Task:**
```bash
POST /api/tasks
Content-Type: application/json

{
  "title": "Fix bug in auth flow",
  "lane": "queued",          # queued|development|review|blocked|done
  "priority": "P1",           # P0|P1|P2|P3
  "owner": "dev-1",           # optional
  "problem": "...",           # optional
  "scope": "...",             # optional
  "acceptanceCriteria": ["..."]  # optional
}
```

**List Tasks:**
```bash
GET /api/tasks
```

**Update Task:**
```bash
PATCH /api/tasks/:id
Content-Type: application/json

{
  "lane": "development",
  "owner": "dev-2"
}
```

---

### Agent Profiles

**Create Agent Profile:**
```bash
POST /api/agent-profiles
Content-Type: application/json

{
  "name": "QA Agent",
  "role": "Quality Assurance",
  "emoji": "🧪",              # optional
  "description": "...",        # optional
  "personality": "...",        # optional
  "systemPrompt": "...",       # optional
  "enabled": true              # optional
}
```

**List Agent Profiles:**
```bash
GET /api/agent-profiles
```

**Update Agent Profile:**
```bash
PATCH /api/agent-profiles/:id
Content-Type: application/json

{
  "name": "Senior QA Agent",
  "enabled": false
}
```

**Delete Agent Profile:**
```bash
DELETE /api/agent-profiles/:id
```

---

### Active Sessions (Spawned Sub-Agents)

**Register Session:**
```bash
POST /api/sessions/register
Content-Type: application/json

{
  "sessionKey": "agent:main:subagent:abc123",
  "instanceId": "my-openclaw-instance",
  "label": "dev-worker-1",        # optional
  "agentId": "developer",         # optional
  "model": "claude-sonnet-4",     # optional
  "task": "Implement feature X",  # optional
  "status": "active"              # active|idle|terminated
}
```

**Update Session:**
```bash
PATCH /api/sessions/:id
Content-Type: application/json

{
  "task": "Running tests",
  "status": "active"
}
```

**List Sessions:**
```bash
GET /api/sessions

# Or filter by instance:
GET /api/sessions?instanceId=my-openclaw-instance
```

**Terminate Session:**
```bash
DELETE /api/sessions/:id
```

---

## Integration Patterns

### Pattern 1: Task Creation from OpenClaw

```typescript
async function createTask(title: string, priority: string) {
  const response = await fetch('http://localhost:8787/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title,
      lane: 'queued',
      priority,
      createdAt: new Date().toISOString()
    })
  })
  return response.json()
}
```

### Pattern 2: Register Spawned Agent

```typescript
async function registerSpawnedAgent(sessionKey: string, label: string, task: string) {
  const response = await fetch('http://localhost:8787/api/sessions/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionKey,
      instanceId: process.env.INSTANCE_ID || 'main-instance',
      label,
      task,
      status: 'active',
      model: 'claude-sonnet-4'
    })
  })
  const session = await response.json()
  return session.id
}
```

### Pattern 3: Update Session Progress

```typescript
async function updateSessionTask(sessionId: string, task: string) {
  await fetch(`http://localhost:8787/api/sessions/${sessionId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task })
  })
}
```

### Pattern 4: Cleanup on Exit

```typescript
process.on('exit', async () => {
  await fetch(`http://localhost:8787/api/sessions/${sessionId}`, {
    method: 'DELETE'
  })
})
```

---

## Example: Full Integration

Here's a complete example of an OpenClaw instance using the Control Center:

```typescript
import { sessions_spawn } from 'openclaw-sdk'

const BRIDGE_URL = process.env.BRIDGE_URL || 'http://localhost:8787'
const INSTANCE_ID = 'my-openclaw'

// Create a task
async function createDevTask(title: string) {
  const task = await fetch(`${BRIDGE_URL}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title,
      lane: 'queued',
      priority: 'P2'
    })
  }).then(r => r.json())
  
  console.log('Created task:', task.id)
  return task
}

// Spawn an agent and register it
async function spawnAndRegister(task: string) {
  // 1. Spawn via OpenClaw
  const result = await sessions_spawn({
    task,
    label: 'dev-worker',
    agentId: 'developer',
    model: 'claude-sonnet-4'
  })

  // 2. Register in Control Center
  const session = await fetch(`${BRIDGE_URL}/api/sessions/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionKey: result.sessionKey,
      instanceId: INSTANCE_ID,
      label: 'dev-worker',
      task,
      status: 'active',
      model: 'claude-sonnet-4'
    })
  }).then(r => r.json())

  console.log('Registered session:', session.id)

  // 3. Update progress periodically
  const interval = setInterval(async () => {
    await fetch(`${BRIDGE_URL}/api/sessions/${session.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task: 'Still working...',
        status: 'active'
      })
    })
  }, 30000) // Every 30s

  // 4. Cleanup on completion
  setTimeout(async () => {
    clearInterval(interval)
    await fetch(`${BRIDGE_URL}/api/sessions/${session.id}`, {
      method: 'DELETE'
    })
    console.log('Session terminated')
  }, 300000) // After 5 min

  return session
}

// Example usage
async function main() {
  const task = await createDevTask('Implement login page')
  await spawnAndRegister('Build React login component with form validation')
}

main()
```

---

## Best Practices

### 1. Instance ID

Use a consistent `instanceId` for all sessions from the same OpenClaw instance:

```typescript
const INSTANCE_ID = process.env.OPENCLAW_INSTANCE_ID || 
                    require('os').hostname() ||
                    'default-instance'
```

### 2. Heartbeats

Update sessions periodically to show they're alive:

```typescript
setInterval(async () => {
  await fetch(`${BRIDGE_URL}/api/sessions/${sessionId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'active' })
  })
}, 30000) // Every 30 seconds
```

### 3. Cleanup

Always terminate sessions when done:

```typescript
try {
  await doWork()
} finally {
  await fetch(`${BRIDGE_URL}/api/sessions/${sessionId}`, {
    method: 'DELETE'
  })
}
```

### 4. Error Handling

Gracefully handle bridge unavailability:

```typescript
async function registerSession(data: SessionCreate) {
  try {
    const response = await fetch(`${BRIDGE_URL}/api/sessions/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    return response.json()
  } catch (error) {
    console.warn('Failed to register session (bridge unavailable):', error)
    // Continue anyway - bridge is optional
    return null
  }
}
```

---

## Data Storage

All data is stored locally in JSON files:

```
~/.openclaw/workspace/
├── tasks.json              # Task board
├── agent-profiles.json     # Agent profile definitions
├── active-sessions.json    # Spawned sub-agent tracking
├── rules.json              # Automation rules
└── .clawhub/
    └── projects/           # PM project data
```

These files can be:
- Backed up
- Version controlled
- Synced across devices (rsync, Dropbox, etc.)
- Migrated between machines

---

## Troubleshooting

### Bridge not responding

1. **Check bridge is running:**
   ```bash
   curl http://localhost:8787/healthz
   ```

2. **Check port availability:**
   ```bash
   lsof -i :8787
   ```

3. **Restart bridge:**
   ```bash
   cd /path/to/claw-control-center
   npm run bridge
   ```

### Sessions not appearing in UI

1. **Verify registration succeeded:**
   ```bash
   curl http://localhost:8787/api/sessions
   ```

2. **Check JSON file:**
   ```bash
   cat ~/.openclaw/workspace/active-sessions.json
   ```

3. **Refresh UI:**
   - UI polls every 10 seconds
   - Hard refresh if needed (Cmd+Shift+R)

### Tasks not persisting

1. **Check file permissions:**
   ```bash
   ls -la ~/.openclaw/workspace/tasks.json
   ```

2. **Verify bridge has write access:**
   ```bash
   touch ~/.openclaw/workspace/test.json && rm ~/.openclaw/workspace/test.json
   ```

---

## Advanced: Custom Bridge URL

If running bridge on a different machine:

```typescript
const BRIDGE_URL = process.env.BRIDGE_URL || 'http://192.168.1.51:8787'
```

Or if using a reverse proxy:

```typescript
const BRIDGE_URL = 'https://control.example.com/api'
```

---

## Next Steps

1. **Try the examples** - Create a task, register a session
2. **Monitor the UI** - Watch sessions appear in real-time
3. **Integrate with your workflow** - Add bridge calls to your OpenClaw automations
4. **Customize** - Extend bridge with your own endpoints if needed

---

## Support

- **Docs:** This file + README.md
- **Issues:** Check browser console and bridge logs
- **Bridge logs:** `npm run bridge` output
- **UI logs:** Browser DevTools console

The system is designed to fail gracefully - if the bridge is unavailable, your OpenClaw instance continues to work normally.
