# Auto-Spawn Agent System

## Overview

The Claw Control Center supports automatic agent spawning on OpenClaw startup. Agents are spawned as isolated sessions and auto-register with the bridge.

## Configuration

### OpenClaw Config

Add to your `~/.openclaw/openclaw.json`:

```json
{
  "clawControlCenter": {
    "enabled": true,
    "bridgeUrl": "http://localhost:8787",
    "agents": [
      {
        "id": "tars",
        "name": "TARS",
        "emoji": "🧠",
        "roles": ["pm", "architect"],
        "model": "anthropic/claude-sonnet-4-5",
        "autoSpawn": false,
        "description": "Project Manager - coordinates all agents"
      },
      {
        "id": "dev-1",
        "name": "Forge",
        "emoji": "🛠️",
        "roles": ["backend-dev", "api", "database"],
        "model": "anthropic/claude-haiku-4-5",
        "autoSpawn": true,
        "description": "Backend Developer - APIs, services, database"
      },
      {
        "id": "dev-2",
        "name": "Patch",
        "emoji": "🧩",
        "roles": ["frontend-dev", "ui", "react"],
        "model": "anthropic/claude-haiku-4-5",
        "autoSpawn": true,
        "description": "Frontend Developer - UI, React components"
      },
      {
        "id": "qa",
        "name": "Sentinel",
        "emoji": "🛡️",
        "roles": ["qa", "testing", "review"],
        "model": "anthropic/claude-haiku-4-5",
        "autoSpawn": true,
        "description": "QA Engineer - testing and validation"
      },
      {
        "id": "architect",
        "name": "Blueprint",
        "emoji": "🏗️",
        "roles": ["architect", "design", "planning"],
        "model": "anthropic/claude-haiku-4-5",
        "autoSpawn": true,
        "description": "System Architect - design and planning"
      }
    ]
  }
}
```

### Agent Properties

- **id**: Unique agent identifier (used for task assignment)
- **name**: Display name
- **emoji**: Avatar emoji
- **roles**: Array of role keywords for task routing
- **model**: Model to use for this agent's sessions
- **autoSpawn**: If true, spawn on gateway startup
- **description**: Agent purpose (shown in UI)

## Architecture

### Startup Flow

1. **Gateway starts** → reads config
2. **For each agent with autoSpawn=true:**
   - Spawn isolated session with `sessions_spawn`
   - Session labeled as `claw-agent-{id}`
   - Agent receives bootstrap task with registration instructions
3. **Agent first run:**
   - Auto-registers with bridge via API
   - Starts heartbeat checking for tasks
4. **Coordination:**
   - Main session (TARS) acts as PM
   - Spawned agents work on assigned tasks
   - Bridge coordinates via task assignment

### Agent Isolation

Each spawned agent runs in an **isolated session**:
- Own message history (no access to main session context)
- Own model (can use haiku for workers, sonnet for PM)
- Own workspace context (gets AGENTS.md template)
- Communicates via bridge task system

### Heartbeat System

Agents check for tasks on staggered schedules:
- dev-1: :03, :18, :33, :48
- dev-2: :06, :21, :36, :51
- qa: :09, :24, :39, :54
- architect: :12, :27, :42, :57
- tars (PM): :00, :15, :30, :45

## Implementation Files

### Gateway Integration
- `scripts/spawn-agents.mjs` - Startup script that spawns agents
- `scripts/agent-bootstrap-task.txt` - Template for agent first-run task

### Agent Templates
- `templates/agent-AGENTS.md` - AGENTS.md for spawned agents
- `templates/agent-SOUL.md` - SOUL.md for spawned agents
- `templates/agent-HEARTBEAT.md` - Task checking heartbeat

## Usage

### Start Gateway with Auto-Spawn

```bash
# Start OpenClaw gateway
openclaw gateway start

# Spawn agents (if not auto-started)
cd ~/.openclaw/workspace
node scripts/spawn-agents.mjs
```

### Verify Agents

```bash
# List running sessions
curl http://localhost:18789/api/sessions

# Check registered agents
curl http://localhost:8787/api/agents

# View agent status in UI
# Navigate to http://localhost:5173 → Agents tab
```

### Manual Spawn (Development)

```bash
# Spawn a specific agent for testing
node scripts/spawn-single-agent.mjs --agent dev-1
```

## Troubleshooting

### Agents not spawning
- Check OpenClaw gateway is running: `openclaw status`
- Verify config exists: `cat ~/.openclaw/openclaw.json`
- Check logs: `tail -f /tmp/openclaw/openclaw-*.log`

### Agents not registering
- Verify bridge is running: `curl http://localhost:8787/api/status`
- Check agent session logs: `openclaw sessions list`
- Test registration API: `curl -X POST http://localhost:8787/api/agents -d '{...}'`

### Agent conflicts
- Each agent must have unique `id`
- Session labels must not conflict (`claw-agent-{id}`)
- Use `sessions list` to find and clean up orphaned sessions

## Architecture Decisions

### Why isolated sessions?
- **Security**: Agents can't access main session private context
- **Model flexibility**: Use cheaper models (haiku) for workers
- **Parallel execution**: Agents work independently
- **Clean coordination**: Task-based communication via bridge

### Why not direct sessions_send?
- **Scalability**: Works across machines via Tailscale
- **Persistence**: Tasks survive agent restarts
- **Audit trail**: All work tracked in bridge
- **UI integration**: Tasks visible in Control Center

### Why staggered heartbeats?
- **Load balancing**: Avoid API rate limits
- **Resource efficiency**: Spread CPU/network load
- **Responsiveness**: Some agent always checking soon
