# Claw Control Center - Agent System

**Clawe-style multi-agent architecture** where agents are pre-configured as part of the system.

## Architecture

```
agents/
├── config.json          # Agent registry
├── tars/               # Project Manager (that's me!)
│   ├── IDENTITY.md
│   ├── SOUL.md
│   └── HEARTBEAT.md
├── forge/              # Backend Developer (dev-1)
│   ├── IDENTITY.md
│   ├── SOUL.md
│   └── HEARTBEAT.md
├── patch/              # Frontend Developer (dev-2)
│   ├── IDENTITY.md
│   ├── SOUL.md
│   └── HEARTBEAT.md
├── sentinel/           # QA Engineer (qa)
│   ├── IDENTITY.md
│   ├── SOUL.md
│   └── HEARTBEAT.md
└── blueprint/          # System Architect (architect)
    ├── IDENTITY.md
    ├── SOUL.md
    └── HEARTBEAT.md
```

## How It Works

### 1. Agent Identity

Each agent has:
- **IDENTITY.md** - Name, emoji, role, specializations
- **SOUL.md** - Personality, working style, values
- **HEARTBEAT.md** - Task checking workflow

### 2. Auto-Registration

On first heartbeat, each agent registers with the bridge:
- Sends their ID, name, emoji, roles, model
- Bridge stores agent in registry
- Agent shows up in UI

### 3. Task Assignment

Tasks auto-assign based on keywords:
- **"api", "database", "backend"** → Forge (dev-1)
- **"ui", "react", "frontend"** → Patch (dev-2)
- **"test", "qa", "review"** → Sentinel (qa)
- **"architecture", "design", "plan"** → Blueprint (architect)

### 4. Coordination

TARS (PM) coordinates:
- Breaks down projects into tasks
- Assigns work to specialized agents
- Tracks progress
- Unblocks agents

## Usage

### Start All Agents

```bash
cd /home/openclaw/.openclaw/workspace
./scripts/start-agents.sh
```

### Manual Agent Registration

If an agent isn't registered, it will auto-register on first heartbeat by running the command in its `HEARTBEAT.md`.

Example (Forge):
```bash
curl -X POST http://localhost:8787/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "id": "dev-1",
    "name": "Forge",
    "emoji": "🛠️",
    "roles": ["backend-dev", "api", "database"],
    "model": "ollama/llama3.1:8b@http://192.168.1.21:11434",
    "workspace": "/home/openclaw/.openclaw/workspace"
  }'
```

### View Agents

```bash
# CLI
curl http://localhost:8787/api/agents

# UI
http://localhost:5173 → Agents tab
```

### Create Tasks

```bash
# CLI
curl -X POST http://localhost:8787/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Build user authentication API",
    "description": "Need backend API for user login/signup",
    "priority": "P1",
    "assignedTo": "dev-1"
  }'

# UI
http://localhost:5173 → Kanban → New Task
```

## Agent Roles

### TARS (tars) - Project Manager
- Coordinates all agents
- Breaks down projects
- Assigns tasks
- Tracks delivery

### Forge (dev-1) - Backend Developer
- Node.js / Express APIs
- Database design
- Server-side logic
- Backend testing

### Patch (dev-2) - Frontend Developer
- React / TypeScript
- UI components
- Styling / UX
- Frontend testing

### Sentinel (qa) - QA Engineer
- Testing (E2E, integration, unit)
- Code review
- Quality assurance
- Bug validation

### Blueprint (architect) - System Architect
- System design
- Architecture decisions
- API contracts
- Performance planning

## Configuration

Edit `agents/config.json` to:
- Add/remove agents
- Change models
- Adjust heartbeat intervals
- Modify roles

## Comparison to Clawe

Like Clawe, we have:
- ✅ Pre-configured agents with identities
- ✅ Agent workspaces with IDENTITY/SOUL/HEARTBEAT
- ✅ Auto-registration with central coordinator
- ✅ Role-based task assignment
- ✅ Persistent agent system (not ephemeral spawns)

Unlike Clawe:
- We use a bridge API instead of file-based coordination
- We have a web UI (Claw Control Center)
- We support Ollama for local models
- We're designed for task management, not general assistance

## Troubleshooting

### Agent not showing in UI

1. Check bridge is running: `curl http://localhost:8787/api/status`
2. Check agent registered: `curl http://localhost:8787/api/agents`
3. Manually register agent (see HEARTBEAT.md in agent's folder)

### Tasks not being picked up

1. Check task has correct `assignedTo` field matching agent ID
2. Check agent's HEARTBEAT.md is running
3. Check task status is "assigned" not "queued"

### Agent appears offline

1. Agent heartbeat hasn't run yet (wait 15 min)
2. Agent workspace path incorrect
3. Check agent's HEARTBEAT.md file exists and is readable
