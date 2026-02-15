# Claw Control Center

Multi-agent task management system for [OpenClaw](https://github.com/openclaw/openclaw). Create tasks, and AI sub-agents autonomously pick them up, implement them, and move them through your kanban board — no manual intervention required.

## How It Works

```
You create a task (UI or API)
        │
        ▼
  TaskRouter claims it instantly
        │
        ▼
  Spawns a sub-agent via OpenClaw gateway
        │
        ▼
  Sub-agent works autonomously
  (reads files, writes code, runs commands)
        │
        ▼
  Moves task to Review when done
```

No polling. No cron jobs. Tasks are picked up in seconds, not minutes.

## Architecture

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────┐
│   React UI  │────▶│  Bridge (API)   │────▶│  .clawhub/   │
│  port 5173  │◀────│   port 8787     │     │  JSON files  │
└─────────────┘  WS └────────┬────────┘     └──────────────┘
                             │
                    ┌────────▼────────┐
                    │  OpenClaw       │
                    │  Gateway        │
                    │  (sessions_spawn)│
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
         Sub-Agent 1    Sub-Agent 2    Sub-Agent 3
         (Forge)        (Patch)        (Blueprint)
```

**Key components:**
- **Bridge** — Express API server. Manages tasks, agents, projects. Runs the TaskRouter.
- **UI** — React + TypeScript dashboard. Kanban board, agent status, activity feed.
- **TaskRouter** — Watches for new tasks, claims them, spawns sub-agents via the OpenClaw gateway.
- **SubAgentRegistry** — Tracks active sub-agent sessions and their task assignments.
- **SubAgentTracker** — Polls the gateway every 15s to detect completed/failed sub-agents.

## Features

- **Push-based execution** — Tasks trigger agent spawns instantly (no polling delay)
- **Parallel agents** — Up to 4 sub-agents working simultaneously
- **Kanban board** — 5 lanes: Proposed → Queued → Development → Review → Done
- **Live agent strip** — See which agents are working and elapsed time per task
- **Activity feed** — Real-time task events via WebSocket
- **Auto-retry** — Failed spawns retry up to 3 times, then move to Blocked
- **Sequential spawn queue** — Reliable spawning with configurable delays between agents
- **Local-first** — All data in JSON files, no cloud required

## Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) v20+
- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- [OpenClaw](https://github.com/openclaw/openclaw) installed and running

### 1. Clone and install
```bash
git clone https://github.com/lpappas98/Claw-Control-Center.git
cd Claw-Control-Center
npm install
```

### 2. Configure gateway connection

Copy the example config:
```bash
cp .clawhub/config.example.json .clawhub/config.json
```

Edit `.clawhub/config.json` with your OpenClaw gateway details:
```json
{
  "gatewayToken": "YOUR_OPENCLAW_GATEWAY_TOKEN",
  "gatewayUrl": "http://YOUR_HOST_IP:18789"
}
```

To find your gateway token:
```bash
openclaw gateway token
```

To find the right gateway URL from inside Docker:
- Use your host's IP on the Docker bridge network (typically `172.18.0.1`)
- Default OpenClaw gateway port is `18789`

### 3. Configure OpenClaw agents

Add sub-agent permissions to your `openclaw.json`:
```json
{
  "agents": {
    "list": [
      {
        "id": "main",
        "subagents": {
          "allowAgents": ["forge", "patch", "blueprint", "sentinel"]
        }
      }
    ]
  }
}
```

### 4. Start with Docker Compose
```bash
docker-compose up -d
```

This starts:
- **claw-bridge** (port 8787) — API + TaskRouter
- **claw-ui** (port 5173) — React dashboard

### 5. Open the dashboard
```
http://localhost:5173
```

### 6. Create a task and watch it go
```bash
curl -X POST http://localhost:8787/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "test-task1",
    "lane": "queued",
    "priority": "P1",
    "owner": "forge",
    "problem": "Test the sub-agent system"
  }'
```

The TaskRouter will claim it, spawn a sub-agent, and you'll see it move through the board.

## Agents

| Agent | ID | Role | Specialization |
|-------|-----|------|----------------|
| Forge | forge | Developer | Backend, infrastructure |
| Patch | patch | Developer | Frontend, UI |
| Sentinel | sentinel | QA | Testing, verification |
| Blueprint | blueprint | Architect | Design, architecture |

Agent definitions are in `bridge/server.mjs` (`AGENT_DEFINITIONS`). Sub-agents are spawned as isolated OpenClaw sessions — they inherit your workspace and tools automatically.

## Task Workflow

```
Proposed → Queued → Development → Review → Done
                       ↑               ↓
                       └── (QA fails) ──┘
```

- **Proposed** — Ideas, not ready for work
- **Queued** — Ready to pick up. TaskRouter auto-claims tasks with an assigned owner.
- **Development** — Sub-agent is actively working
- **Review** — Agent finished, awaiting QA or human review
- **Done** — Verified complete

### Auto-assignment
Tasks with an `owner` field matching an agent ID are auto-claimed. Tasks can also be auto-assigned by tag:
- `backend` → forge
- `frontend` → patch  
- `architecture` → blueprint
- `qa` → sentinel

## Configuration

### TaskRouter settings (in `bridge/taskRouter.mjs`)
| Setting | Default | Description |
|---------|---------|-------------|
| `MAX_CONCURRENT` | 4 | Maximum parallel sub-agents |
| `MAX_RETRIES` | 3 | Spawn retry attempts before blocking |
| `SPAWN_DELAY_MS` | 3000 | Delay between sequential spawns |

### Sub-agent model (in `bridge/initializeTaskRouter.mjs`)
```javascript
model: 'anthropic/claude-sonnet-4-5'  // Change to your preferred model
```

## Documentation

- [Setup Guide](docs/SETUP.md) — Detailed installation and configuration
- [Sub-Agent Architecture](docs/SUB-AGENT-ARCHITECTURE.md) — How the push-based system works
- [API Reference](docs/API.md) — All bridge endpoints
- [Docker Deployment](docs/DEPLOYMENT.md) — Production deployment guide
- [Troubleshooting](docs/TROUBLESHOOTING.md) — Common issues and fixes

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + shadcn/ui
- **Backend**: Node.js + Express (ESM)
- **Storage**: JSON files (`.clawhub/`)
- **Deployment**: Docker + Docker Compose + Nginx
- **Agent Runtime**: OpenClaw gateway (`sessions_spawn`)

## License

MIT
