# Setup Guide

## Prerequisites

- **Node.js** v20+ ([download](https://nodejs.org/))
- **Docker** and Docker Compose ([download](https://docs.docker.com/get-docker/))
- **OpenClaw** installed and running ([install](https://github.com/openclaw/openclaw))

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/lpappas98/Claw-Control-Center.git
cd Claw-Control-Center
npm install
```

### 2. Configure the gateway connection

The bridge needs to communicate with your OpenClaw gateway to spawn sub-agents.

```bash
cp .clawhub/config.example.json .clawhub/config.json
```

Edit `.clawhub/config.json`:
```json
{
  "gatewayToken": "YOUR_TOKEN",
  "gatewayUrl": "http://172.18.0.1:18789"
}
```

**Finding your gateway token:**
```bash
openclaw gateway token
```

**Finding the gateway URL:**
- OpenClaw gateway runs on port `18789` by default
- From inside Docker, use the host IP on the bridge network (typically `172.18.0.1`)
- Verify: `docker network inspect claw-net | grep Gateway`
- If running without Docker, use `http://localhost:18789`

### 3. Configure OpenClaw for sub-agents

Add sub-agent permissions to your OpenClaw config (`~/.openclaw/openclaw.json` or your instance config):

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

This allows the main agent to spawn sub-agents with those IDs via `sessions_spawn`.

### 4. Deploy with Docker

```bash
docker-compose up -d
```

This starts two containers:
- **claw-bridge** (port 8787) — API server + TaskRouter
- **claw-ui** (port 5173) — React dashboard

**Important:** The bridge container mounts `.clawhub/` as a volume for persistent data:
```yaml
volumes:
  - ./.clawhub:/data/.clawhub
```

### 5. Verify

```bash
# Check bridge health
curl http://localhost:8787/api/status

# Check UI
open http://localhost:5173
```

## Development (without Docker)

For local development:

```bash
# Terminal 1: Start the bridge
cd bridge
node server.mjs

# Terminal 2: Start the UI dev server
npm run dev
```

The Vite dev server proxies `/api` requests to `localhost:8787` automatically.

## Agent Configuration

### Default agents

| Agent | ID | Role | Auto-assign tags |
|-------|-----|------|-----------------|
| Forge | forge | Developer | backend |
| Patch | patch | Developer | frontend |
| Blueprint | blueprint | Architect | architecture |
| Sentinel | sentinel | QA | qa |

### Customizing agents

Agent definitions are in `bridge/server.mjs` (`AGENT_DEFINITIONS` array):

```javascript
const AGENT_DEFINITIONS = [
  { id: 'forge', name: 'Forge', role: 'Dev', emoji: '🔨' },
  { id: 'patch', name: 'Patch', role: 'Dev', emoji: '🌟' },
  { id: 'blueprint', name: 'Blueprint', role: 'Architect', emoji: '🏗️' },
  { id: 'sentinel', name: 'Sentinel', role: 'QA', emoji: '🛡️' },
]
```

To add a new agent:
1. Add it to `AGENT_DEFINITIONS` in `bridge/server.mjs`
2. Add the ID to `allowAgents` in your OpenClaw config
3. Restart the bridge

### Tag-to-agent mapping

Auto-assignment maps task tags to agents. Configure in `bridge/taskRouter.mjs`:

```javascript
const TAG_AGENT_MAP = {
  backend: 'forge',
  frontend: 'patch',
  architecture: 'blueprint',
  qa: 'sentinel',
}
```

### Sub-agent model

The model used for sub-agents is configured in `bridge/initializeTaskRouter.mjs`:

```javascript
model: 'anthropic/claude-sonnet-4-5'
```

Change this to any model supported by your OpenClaw instance.

## TaskRouter Settings

In `bridge/taskRouter.mjs`:

| Setting | Default | Description |
|---------|---------|-------------|
| `MAX_CONCURRENT` | 4 | Maximum parallel sub-agents |
| `MAX_RETRIES` | 3 | Spawn attempts before moving task to blocked |
| `SPAWN_DELAY_MS` | 3000 | Delay between sequential spawns (ms) |

## Docker Networking

The bridge container needs to reach the OpenClaw gateway on the host machine:

```
┌─────────────────────────────────────────┐
│  Docker: claw-net bridge network        │
│                                         │
│  ┌──────────┐    ┌──────────┐          │
│  │ claw-ui  │    │  bridge  │──────┐   │
│  │ :3000    │    │  :8787   │      │   │
│  └──────────┘    └──────────┘      │   │
│                                     │   │
└─────────────────────────────────────│───┘
                                      │
                          ┌───────────▼───┐
                          │  Host machine  │
                          │  OpenClaw GW   │
                          │  :18789        │
                          └───────────────┘
```

- Host IP from inside Docker: typically `172.18.0.1` (check with `docker network inspect claw-net`)
- The UI container proxies `/api` to the bridge container via nginx

## Data Storage

All persistent data lives in `.clawhub/`:

| File | Description |
|------|-------------|
| `config.json` | Gateway token and URL |
| `tasks.json` | All tasks (kanban board state) |
| `sub-agent-registry.json` | Active sub-agent sessions |
| `agents.json` | Agent metadata |
| `activity.json` | Activity feed events |
| `projects.json` | Projects |
| `intakes.json` | Intake items |
| `rules.json` | PM rules |
| `notifications.json` | Notifications |
| `routines.json` | Routines |
| `taskTemplates.json` | Task templates |

This directory is `.gitignored` — your data stays local. Only `config.example.json` is committed.

## Troubleshooting

### Sub-agents not spawning
1. Check gateway config: `cat .clawhub/config.json`
2. Verify gateway is reachable: `curl http://172.18.0.1:18789/api/status` (from inside bridge container)
3. Check bridge logs: `docker logs claw-bridge`
4. Verify `allowAgents` includes your agent IDs in OpenClaw config

### Tasks stuck in queued
- TaskRouter only claims tasks with an `owner` field matching a known agent ID
- Check `AGENT_DEFINITIONS` in `bridge/server.mjs`
- Check bridge logs for spawn errors

### Gateway timeout on spawn
- The gateway has a ~10s internal timeout for `sessions_spawn`
- The sequential spawn queue (3-5s delay) prevents overwhelming the gateway
- If spawns still fail, increase `SPAWN_DELAY_MS` in `taskRouter.mjs`

### Docker API calls returning HTML
- The nginx config must proxy `/api` to the bridge container
- Check `docker/nginx.conf` has a `/api` location block
- Verify bridge container IP: `docker network inspect claw-net`
