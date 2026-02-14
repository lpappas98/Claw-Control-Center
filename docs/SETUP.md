# Claw Control Center - Setup Guide

## Prerequisites
- [Node.js](https://nodejs.org/) v20+
- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- [OpenClaw](https://github.com/openclaw/openclaw) installed and configured

## Quick Start

### 1. Clone the repo
```bash
git clone https://github.com/your-org/Claw-Control-Center.git
cd Claw-Control-Center
```

### 2. Install dependencies
```bash
npm install
```

### 3. Start with Docker Compose
```bash
docker-compose up -d
```

This starts:
- **claw-bridge** (port 8787) — API server + task management
- **claw-ui** (port 5173) — React frontend

### 4. Access the UI
Open http://localhost:5173 in your browser.

## Agent Setup

The Claw Control Center comes with 5 pre-configured agents:

| Agent | ID | Role | Description |
|-------|-----|------|-------------|
| TARS | pm | Project Manager | Creates tasks, coordinates agents |
| Forge | dev-1 | Developer | Primary dev, picks up queued tasks |
| Patch | dev-2 | Developer | Secondary dev, picks up queued tasks |
| Sentinel | qa | QA | Verifies implementations, runs Playwright tests |
| Blueprint | architect | Architect | System design and architecture |

### Connecting Agents to OpenClaw

Add agents to your `openclaw.json` config:

```json
{
  "agents": {
    "defaults": {
      "models": {
        "anthropic/claude-haiku-4-5": { "alias": "haiku" },
        "anthropic/claude-sonnet-4-5": { "alias": "sonnet" }
      }
    },
    "list": [
      {
        "id": "main",
        "subagents": {
          "allowAgents": ["haiku", "sonnet", "dev-1", "dev-2", "qa", "architect"]
        }
      },
      {
        "id": "dev-1",
        "name": "Forge",
        "workspace": "/path/to/Claw-Control-Center/agents/forge",
        "model": { "primary": "anthropic/claude-haiku-4-5" }
      },
      {
        "id": "dev-2",
        "name": "Patch",
        "workspace": "/path/to/Claw-Control-Center/agents/patch",
        "model": { "primary": "anthropic/claude-haiku-4-5" }
      },
      {
        "id": "qa",
        "name": "Sentinel",
        "workspace": "/path/to/Claw-Control-Center/agents/sentinel",
        "model": { "primary": "anthropic/claude-haiku-4-5" }
      },
      {
        "id": "architect",
        "name": "Blueprint",
        "workspace": "/path/to/Claw-Control-Center/agents/blueprint",
        "model": { "primary": "anthropic/claude-haiku-4-5" }
      }
    ]
  }
}
```

### Setting Up Agent Heartbeats (Cron Jobs)

Create cron jobs in OpenClaw for each agent to poll for tasks:

```bash
# Each agent checks for tasks every 60 seconds
openclaw cron add --schedule '{"kind":"every","everyMs":60000}' \
  --payload '{"kind":"agentTurn","message":"Check for tasks and execute if found.","model":"anthropic/claude-haiku-4-5"}' \
  --sessionTarget isolated
```

## Task Workflow

```
Proposed → Queued → Development → Review → Done
                      ↑                ↓
                      └── (QA fails) ──┘
```

1. **Proposed**: Ideas, not yet ready for work
2. **Queued**: Ready for an agent to pick up
3. **Development**: Agent is actively working on it
4. **Review**: Dev agent finished, waiting for Sentinel QA
5. **Done**: Sentinel verified, task complete

### Key Rules
- Dev agents (Forge, Patch) pick up from **queued**, work in **development**, move to **review**
- Only Sentinel (QA) moves tasks from **review** to **done**
- Failed QA sends tasks back to **development**

## API Endpoints

### Tasks
- `GET /api/tasks` — List all tasks (supports `?lane=` and `?owner=` filters)
- `POST /api/tasks` — Create a task
- `PUT /api/tasks/:id` — Update a task
- `DELETE /api/tasks/:id` — Delete a task

### Agents
- `GET /api/agents` — List all agents
- `POST /api/agents/:id/heartbeat` — Update agent heartbeat
- `PUT /api/agents/:id/status` — Update agent status

### Activity
- `GET /api/activity` — Recent activity events

### System
- `GET /api/status` — System health check

## Data Storage

All data is stored locally in `.clawhub/` (created on first run):
- `tasks.json` — All tasks
- `agents.json` — Agent status and heartbeats
- `activity.json` — Activity feed
- `projects/` — Project data

This directory is gitignored — your data stays on your machine.
