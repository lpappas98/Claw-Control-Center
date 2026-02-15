# Implementation Prompt: Sub-Agent Tracking & UI Integration

## Context

We've switched from per-agent cron sessions to a push-based sub-agent model. The bridge's TaskRouter spawns sub-agents via the gateway's `/tools/invoke` endpoint calling `sessions_spawn`. Sub-agents work on tasks, call `/complete` when done, and the bridge dispatches the next task.

The UI (Mission Control dashboard) needs to show real-time sub-agent status: who's active, what they're working on, how long they've been running, and who's idle. This replaces the old agent heartbeat system.

## Architecture Overview

```
Bridge (Node process, always running)
  ├── TaskRouter (spawns sub-agents, tracks assignments)
  ├── SubAgentTracker (polls gateway, maintains state)
  ├── API endpoints (serves UI with agent/task data)
  │
  ↕ Gateway API (port 18789, /tools/invoke)
  │
  ├── sessions_list → all active sub-agent sessions
  ├── sessions_history → transcript for a session
  └── session_status → token usage, model, runtime
```

## Step 1: Bridge — Sub-Agent Registry

When the TaskRouter spawns a sub-agent, store the mapping. Create or extend a registry in the bridge:

```javascript
// subAgentRegistry.js

// In-memory map, persisted to .clawhub/sub-agent-registry.json on every change
const registry = new Map();

// Called by TaskRouter immediately after successful sessions_spawn
function registerSubAgent({ childSessionKey, runId, agentId, taskId, taskTitle, taskPriority, taskTag, spawnedAt }) {
  registry.set(childSessionKey, {
    childSessionKey,
    runId,
    agentId,         // "forge", "patch", "blueprint", "sentinel"
    taskId,
    taskTitle,
    taskPriority,
    taskTag,
    spawnedAt,        // Date.now()
    status: "active", // active | completed | failed | archived
    completedAt: null,
    tokenUsage: null,
    lastChecked: null,
  });
  persistRegistry();
}

// Called when sub-agent calls /complete or /blocked
function markComplete(childSessionKey, status = "completed") {
  const entry = registry.get(childSessionKey);
  if (entry) {
    entry.status = status;
    entry.completedAt = Date.now();
    persistRegistry();
  }
}

// Called by the SubAgentTracker polling loop (see Step 2)
function updateFromGateway(childSessionKey, { tokenUsage, isActive }) {
  const entry = registry.get(childSessionKey);
  if (entry) {
    entry.tokenUsage = tokenUsage;
    entry.lastChecked = Date.now();
    if (!isActive && entry.status === "active") {
      // Gateway says session is gone but we never got /complete
      // This means the sub-agent died or was archived
      entry.status = "failed";
      entry.completedAt = Date.now();
    }
    persistRegistry();
  }
}

// Returns current state for the UI
function getAll() {
  return Array.from(registry.values());
}

function getActive() {
  return Array.from(registry.values()).filter(e => e.status === "active");
}

function getByAgent(agentId) {
  return Array.from(registry.values()).filter(e => e.agentId === agentId);
}
```

## Step 2: Bridge — Gateway Polling for Live Status

Poll the gateway every 15-30 seconds to sync sub-agent session state. This catches cases where a sub-agent finishes or dies without calling `/complete`.

```javascript
// subAgentTracker.js

const POLL_INTERVAL = 15_000; // 15 seconds

async function pollGateway() {
  try {
    // Get all active sessions from gateway
    const res = await fetch(`${GATEWAY_URL}/tools/invoke`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GATEWAY_TOKEN}`,
      },
      body: JSON.stringify({
        tool: "sessions_list",
        args: {},
      }),
    });

    const data = await res.json();
    // Unwrap gateway envelope
    const sessionsRaw = data.result?.content?.find(c => c.type === "text")?.text;
    const sessions = JSON.parse(sessionsRaw || "[]");

    // Filter to sub-agent sessions only
    // Session keys look like: agent:<agentId>:subagent:<uuid>
    const subAgentSessions = sessions.filter(s =>
      s.sessionKey?.includes(":subagent:")
    );

    // Build a set of active session keys from gateway
    const activeKeys = new Set(subAgentSessions.map(s => s.sessionKey));

    // Update registry with live data
    for (const session of subAgentSessions) {
      subAgentRegistry.updateFromGateway(session.sessionKey, {
        tokenUsage: session.tokens || null,
        isActive: true,
      });
    }

    // Check for sessions that disappeared from gateway (completed/archived)
    for (const entry of subAgentRegistry.getActive()) {
      if (!activeKeys.has(entry.childSessionKey)) {
        subAgentRegistry.updateFromGateway(entry.childSessionKey, {
          tokenUsage: entry.tokenUsage,
          isActive: false,
        });
      }
    }
  } catch (err) {
    console.error("[SubAgentTracker] Gateway poll failed:", err.message);
  }
}

// Start polling
setInterval(pollGateway, POLL_INTERVAL);
```

## Step 3: Bridge — API Endpoints for the UI

Add these endpoints to serve the dashboard:

```javascript
// GET /api/agents/status
// Returns all agent slots with their current sub-agent activity
app.get("/api/agents/status", (req, res) => {
  const AGENT_DEFINITIONS = [
    { id: "forge", name: "Forge", role: "Dev", emoji: "🔨" },
    { id: "patch", name: "Patch", role: "Dev", emoji: "🌟" },
    { id: "blueprint", name: "Blueprint", role: "Architect", emoji: "🏗️" },
    { id: "sentinel", name: "Sentinel", role: "QA", emoji: "🔍" },
    { id: "tars", name: "TARS", role: "PM", emoji: "🍊" },
  ];

  const activeSubAgents = subAgentRegistry.getActive();

  const agents = AGENT_DEFINITIONS.map(def => {
    const activeSession = activeSubAgents.find(s => s.agentId === def.id);
    return {
      ...def,
      status: activeSession ? "active" : "idle",
      currentTask: activeSession ? {
        id: activeSession.taskId,
        title: activeSession.taskTitle,
        priority: activeSession.taskPriority,
        tag: activeSession.taskTag,
        startedAt: activeSession.spawnedAt,
        runningFor: activeSession.spawnedAt ? Date.now() - activeSession.spawnedAt : 0,
        sessionKey: activeSession.childSessionKey,
        tokenUsage: activeSession.tokenUsage,
      } : null,
    };
  });

  res.json({ agents });
});

// GET /api/agents/:agentId/history
// Returns recent sub-agent runs for a specific agent
app.get("/api/agents/:agentId/history", (req, res) => {
  const history = subAgentRegistry.getByAgent(req.params.agentId)
    .sort((a, b) => (b.spawnedAt || 0) - (a.spawnedAt || 0))
    .slice(0, 20);
  res.json({ history });
});

// GET /api/agents/active
// Returns only currently active sub-agents (lightweight poll endpoint for the UI)
app.get("/api/agents/active", (req, res) => {
  const active = subAgentRegistry.getActive().map(s => ({
    agentId: s.agentId,
    taskId: s.taskId,
    taskTitle: s.taskTitle,
    taskPriority: s.taskPriority,
    runningFor: s.spawnedAt ? Date.now() - s.spawnedAt : 0,
    tokenUsage: s.tokenUsage,
  }));
  res.json({ active, count: active.length });
});
```

## Step 4: UI — Mission Control Agent Strip

The Mission Control dashboard polls `GET /api/agents/status` every 10 seconds and renders the agent strip.

### Agent Strip Behavior

**When ≤3 agents are active:** Show expanded cards (300px) for active agents + idle cluster for the rest.

**When ≥4 agents are active:** Show compact equal-width cards for all agents.

### Active Agent Card Shows:
- Agent emoji + name + role badge
- Green pulsing status dot
- Current task title (truncated)
- Task priority badge (P0/P1/P2 color-coded)
- Task tag badge (Backend/UI/QA/Arch)
- Running time (live counter: "3m 42s")
- Token usage if available (e.g., "~12k tokens")

### Idle Agent Card Shows:
- Agent emoji + name
- Gray status dot
- "Idle" or "Waiting for tasks" label
- Last completed task + how long ago (from history endpoint)

### Implementation Notes for the UI:

```javascript
// In the Mission Control React component:

const [agents, setAgents] = useState([]);

useEffect(() => {
  const poll = async () => {
    const res = await fetch("/api/agents/status");
    const data = await res.json();
    setAgents(data.agents);
  };

  poll(); // Initial fetch
  const interval = setInterval(poll, 10_000); // Every 10 seconds
  return () => clearInterval(interval);
}, []);

// Running time display (updates every second for active agents)
const [now, setNow] = useState(Date.now());
useEffect(() => {
  const tick = setInterval(() => setNow(Date.now()), 1000);
  return () => clearInterval(tick);
}, []);

function formatRunningTime(startedAt) {
  if (!startedAt) return "";
  const seconds = Math.floor((now - startedAt) / 1000);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}
```

### Agent Card Component Structure:

```jsx
function AgentCard({ agent }) {
  const isActive = agent.status === "active";
  const task = agent.currentTask;

  return (
    <div style={{
      borderLeft: isActive ? "3px solid #10b981" : "3px solid #1e293b",
      // ... card styles
    }}>
      {/* Header: emoji + name + role */}
      <div>
        <span>{agent.emoji}</span>
        <span>{agent.name}</span>
        <span className="role-badge">{agent.role}</span>
        <span className={`status-dot ${isActive ? "active" : "idle"}`} />
      </div>

      {/* Active: show task info */}
      {isActive && task && (
        <div>
          <p className="task-title">{task.title}</p>
          <div className="task-meta">
            <span className="priority-badge">{task.priority}</span>
            <span className="tag-badge">{task.tag}</span>
            <span className="running-time">{formatRunningTime(task.startedAt)}</span>
            {task.tokenUsage && (
              <span className="tokens">~{Math.round(task.tokenUsage / 1000)}k</span>
            )}
          </div>
        </div>
      )}

      {/* Idle: show last activity */}
      {!isActive && (
        <p className="idle-label">Idle — waiting for tasks</p>
      )}
    </div>
  );
}
```

## Step 5: UI — Activity Feed Integration

When a sub-agent spawns, completes, or fails, emit events to your activity feed:

```javascript
// In the bridge, whenever sub-agent state changes:

// On spawn:
activityFeed.push({
  type: "agent_spawn",
  agent: agentId,
  taskId,
  taskTitle,
  time: Date.now(),
  message: `${agentId} started working on "${taskTitle}"`,
});

// On complete:
activityFeed.push({
  type: "agent_complete",
  agent: agentId,
  taskId,
  taskTitle,
  duration: completedAt - spawnedAt,
  time: Date.now(),
  message: `${agentId} completed "${taskTitle}" in ${formatDuration(duration)}`,
});

// On failure/timeout:
activityFeed.push({
  type: "agent_failed",
  agent: agentId,
  taskId,
  taskTitle,
  time: Date.now(),
  message: `${agentId} failed on "${taskTitle}" — task released back to queue`,
});
```

The activity feed endpoint (`GET /api/activity`) already exists — just make sure these events flow through it so the Mission Control activity sidebar shows agent lifecycle events alongside task movements.

## Step 6: Remove Old Heartbeat System

Once this is working:

1. **Delete** per-agent heartbeat cron jobs
2. **Delete** the `POST /api/agents/:id/heartbeat` endpoint
3. **Delete** the `AgentsStore` / `agents.json` file (agent definitions move to the hardcoded `AGENT_DEFINITIONS` array or a simpler config)
4. **Delete** the spawn proxy process on the host
5. **Update** any UI components that read from the old heartbeat data to use `GET /api/agents/status` instead

The `agents.json` heartbeat file is replaced by:
- **Live status:** Gateway `sessions_list` (polled every 15s by bridge)
- **Assignment tracking:** `sub-agent-registry.json` (updated on spawn/complete)
- **Agent definitions:** Hardcoded in bridge config (name, role, emoji — these don't change)

## Step 7: Health Monitor Updates

The single health cron (every 5 minutes) should now also:

1. Check `sub-agent-registry.json` for entries marked "active" longer than 15 minutes
2. Cross-reference against gateway `sessions_list`
3. If a session is gone but registry says "active" → mark as failed, release task back to queue
4. If a session exists but has been running > 15 min → log a warning (might be a long task, might be stuck)
5. Check for tasks in "in_progress" with no corresponding active sub-agent → release back to queue

## Summary of What Changes

```
REMOVE:
  - Per-agent cron jobs (forge-heartbeat, patch-heartbeat, etc.)
  - Spawn proxy process on host
  - POST /api/agents/:id/heartbeat endpoint
  - AgentsStore / agents.json
  - Old heartbeat polling in UI

ADD:
  - subAgentRegistry.js (bridge — tracks spawn→task mappings)
  - subAgentTracker.js (bridge — polls gateway every 15s)
  - GET /api/agents/status (bridge — serves UI with merged agent+task data)
  - GET /api/agents/:agentId/history (bridge — recent runs per agent)
  - GET /api/agents/active (bridge — lightweight active-only endpoint)
  - Activity feed events for spawn/complete/fail
  - sub-agent-registry.json (persisted state)

MODIFY:
  - TaskRouter: after successful sessions_spawn, call subAgentRegistry.registerSubAgent()
  - TaskRouter: on /complete callback, call subAgentRegistry.markComplete()
  - Mission Control UI: poll /api/agents/status instead of old heartbeat data
  - Health monitor: add sub-agent orphan detection
  - openclaw.json: add subagents config (maxConcurrent, allowAgents, model)
```
