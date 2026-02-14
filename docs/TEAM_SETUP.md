# Team Setup Guide - OpenClaw Control Center

Get a complete multi-agent team running in minutes with preconfigured templates.

## Quick Start (3 Commands)

```bash
# 1. Set up Team Alpha (recommended for first time)
./scripts/setup-team.sh alpha

# 2. Start the bridge (in one terminal)
openclaw bridge start

# 3. Start agents (in separate terminals)
openclaw --agent tars
openclaw --agent dev-agent
openclaw --agent designer
```

Done! Your team is now running.

## Available Teams

### Team Alpha - General Development
**Best for:** Building complete products with backend, frontend, and design

```
🤖 TARS        (PM/Architect)      - Project management, planning, coordination
💻 Dev Agent   (Backend/Frontend)  - Implementation, APIs, features
🎨 Designer    (UI/UX)             - User experience, visual design
```

**Set up:** `./scripts/setup-team.sh alpha`

### Team Beta - QA & Content
**Best for:** Quality assurance, documentation, research, and analysis

```
🧪 QA Agent      (Testing)         - Quality verification, test coverage
✍️  Content Agent (Documentation)  - Technical writing, guides, support
🔍 Scout Agent   (Research)        - User research, competitive analysis
```

**Set up:** `./scripts/setup-team.sh beta`

### Team Solo - Single PM
**Best for:** Lightweight projects, quick planning, small scope

```
🤖 TARS         (PM)              - Planning and coordination only
```

**Set up:** `./scripts/setup-team.sh solo`

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│           Bridge (Communication Hub)                 │
│          http://localhost:8787                       │
│                                                       │
│  Registers agents, routes messages, coordinates work │
└──────────────────┬──────────────────────────────────┘
                   │
        ┌──────────┼──────────┐
        │          │          │
        ▼          ▼          ▼
    ┌─────────┬──────────┬──────────┐
    │  TARS   │   Dev    │ Designer │
    │ (PM)    │  Agent   │          │
    └─────────┴──────────┴──────────┘
   Agent 1  Agent 2    Agent 3
  ~/.openclaw/agents/...
```

### Components

**Bridge:** Central coordination server (runs once per workspace)
- Tracks agent status
- Routes messages between agents
- Provides REST API for monitoring

**Agents:** Individual AI workers (one per role)
- Local workspace at `~/.openclaw/agents/<agent-id>/`
- Runs independently but coordinates via Bridge
- Maintains SOUL.md (identity/responsibilities)
- Stores memory and state locally

## Setup Details

### What the Setup Script Does

```bash
./scripts/setup-team.sh alpha
```

1. **Creates workspace directories** at `~/.openclaw/agents/<agent-id>/`
2. **Copies SOUL.md templates** (agent identity/responsibilities)
3. **Creates HEARTBEAT.md** (periodic task checklist)
4. **Creates .claw/config.json** (agent configuration)
5. **Validates everything** (checks dependencies, validates JSON)
6. **Prints startup instructions**

The script is **idempotent** — safe to run multiple times without issues.

### Directory Structure After Setup

```
~/.openclaw/agents/
├── tars/
│   ├── SOUL.md                (Agent identity)
│   ├── HEARTBEAT.md           (Periodic tasks)
│   ├── .claw/
│   │   └── config.json        (Agent configuration)
│   ├── memory/
│   │   ├── 2026-02-14.md      (Daily notes)
│   │   └── YYYY-MM-DD.md      (Previous sessions)
│   └── projects/              (Workspace files)
│
├── dev-agent/
│   ├── SOUL.md
│   ├── HEARTBEAT.md
│   ├── .claw/config.json
│   └── ...
│
└── designer/
    └── ...
```

## Running Your Team

### 1. Start the Bridge

```bash
openclaw bridge start
```

This starts the central coordination hub on `http://localhost:8787`

### 2. Start Each Agent (in separate terminals)

```bash
# Terminal 1: TARS (PM)
openclaw --agent tars

# Terminal 2: Dev Agent
openclaw --agent dev-agent

# Terminal 3: Designer
openclaw --agent designer
```

Each agent:
- Reads its SOUL.md to understand its role
- Connects to the bridge
- Registers with its configuration
- Begins accepting tasks/messages

### 3. Verify Setup

```bash
# Check bridge is running
curl http://localhost:8787/api/agents

# Check agent status
curl http://localhost:8787/api/agents/tars
```

Response:
```json
{
  "id": "tars",
  "name": "TARS",
  "status": "online",
  "roles": ["pm", "architect", "coordination"],
  "workspace": "/home/user/.openclaw/agents/tars"
}
```

## Customization

### Change Bridge URL

By default, the bridge runs on `http://localhost:8787`. To use a different URL:

```bash
# During setup
./scripts/setup-team.sh alpha --bridge http://192.168.1.100:8787

# Or set environment variable
export BRIDGE_URL=http://192.168.1.100:8787
./scripts/setup-team.sh alpha
```

### Customize Agent Configuration

Edit `~/.openclaw/agents/<agent-id>/.claw/config.json`:

```json
{
  "id": "tars",
  "name": "TARS",
  "model": "anthropic/claude-sonnet-4-5",
  "heartbeatIntervalMs": 30000,
  "roles": ["pm", "architect"]
}
```

**Common settings:**
- `model` - Change AI model (claude-sonnet-4-5, claude-haiku-4-5, etc.)
- `heartbeatIntervalMs` - How often agent checks in (30000 = 30 seconds)
- `roles` - What the agent can do (from SOUL.md)

### Modify Agent Identity

Edit `~/.openclaw/agents/<agent-id>/SOUL.md` to customize:
- Agent personality
- Responsibilities
- Working style
- Collaboration approach

The agent reads this on startup, so changes take effect next session.

## Multi-Node Setup (Distributed Teams)

Run team agents on different machines with Tailscale:

### 1. Install Tailscale

```bash
# On each machine
curl -fsSL https://tailscale.com/install.sh | sh

# Authenticate
sudo tailscale up
```

### 2. Set Bridge URL to Reachable Address

```bash
# On bridge machine, find Tailscale IP
ip addr show tailscale0

# Run setup with bridge URL
./scripts/setup-team.sh alpha --bridge http://100.x.x.x:8787
```

### 3. Start Bridge on First Machine

```bash
openclaw bridge start --bridge http://0.0.0.0:8787
```

### 4. Start Agents on Different Machines

Each machine has agents that connect to the bridge via Tailscale:

```bash
# Machine A (has bridge)
openclaw --agent tars

# Machine B
openclaw --agent dev-agent

# Machine C  
openclaw --agent designer
```

All agents communicate through Tailscale VPN.

### Why Tailscale?

- **Secure** - VPN between machines
- **Zero-config** - Automatic IP discovery
- **Works everywhere** - Home, office, cloud, mobile
- **Fast** - Direct connection when possible

## Troubleshooting

### "OpenClaw CLI not found"

Install OpenClaw:
```bash
npm install -g @anthropic/openclaw
```

### "Bridge connection refused"

1. Check bridge is running:
   ```bash
   curl http://localhost:8787/api/agents
   ```

2. If not running, start it:
   ```bash
   openclaw bridge start
   ```

3. Check bridge URL in agent config:
   ```bash
   cat ~/.openclaw/agents/tars/.claw/config.json
   ```

### "Invalid JSON in team config"

Validate the JSON:
```bash
jq empty templates/teams/team-alpha.json

# If error, check syntax
jq . templates/teams/team-alpha.json
```

### Agent not registering

1. Check agent has valid SOUL.md:
   ```bash
   ls ~/.openclaw/agents/tars/SOUL.md
   ```

2. Check agent config:
   ```bash
   jq . ~/.openclaw/agents/tars/.claw/config.json
   ```

3. Check agent logs:
   ```bash
   # Look for registration messages
   openclaw --agent tars 2>&1 | grep -i register
   ```

### Memory/Persistence Issues

Each agent stores memory at `~/.openclaw/agents/<agent-id>/memory/`:
- `YYYY-MM-DD.md` - Daily logs (auto-created)
- `MEMORY.md` - Long-term memory (manual)

Clear memory:
```bash
rm ~/.openclaw/agents/tars/memory/*.md

# But keep SOUL.md!
ls ~/.openclaw/agents/tars/SOUL.md  # Should still exist
```

## Project Workflow

### Starting a Project

1. **TARS reads the brief** - Understands what's being built
2. **TARS breaks down work** - Creates tasks for each agent
3. **Dev Agent starts building** - Implements features
4. **Designer creates specs** - UI/UX, flows, components
5. **QA Agent verifies** - Tests, edge cases, quality
6. **Content Agent documents** - Guides, help, explanations
7. **Scout Agent researches** - User needs, competitive analysis

### Daily Coordination

1. **Morning sync** - TARS checks in with each agent
2. **During day** - Agents work on tasks, unblock each other
3. **Blockers surface** - When stuck, agent flags TARS
4. **TARS coordinates** - Connects dependencies, makes decisions
5. **Evening summary** - Update memory, plan tomorrow

### Shipping

1. **Feature complete** - Dev finishes implementation
2. **QA verifies** - Tests thoroughly
3. **Content ready** - Documentation in place
4. **Designer approves** - Visual polish done
5. **TARS coordinates launch** - Ensures everyone ready
6. **Deploy** - Push to production
7. **Monitor & iterate** - Gather feedback, improve

## Team Communication

### Message Types

Agents can message each other via the Bridge:

```bash
# TARS to Dev Agent (unblock)
tars: "@dev-agent Our users need this faster. What's the bottleneck?"

# Dev Agent to Designer (clarification)
dev-agent: "@designer The login flow is unclear. Can we simplify?"

# QA to TARS (priority)
qa-agent: "@tars Found critical bug in payments. Need dev to fix before launch."
```

### Memory & Context

Each agent maintains two memory files:

**Daily Memory** (`memory/YYYY-MM-DD.md`):
- Raw notes from today
- Tasks completed
- Blockers encountered
- Messages exchanged

**Long-term Memory** (`memory/MEMORY.md`):
- Curated important context
- Decisions made
- Team patterns
- Lessons learned

Agents read both at startup to understand context.

## Advanced Configuration

### Custom Models

Change which AI model an agent uses:

```bash
# Edit agent config
nano ~/.openclaw/agents/tars/.claw/config.json

# Change model
{
  "model": "anthropic/claude-sonnet-4-5"  # For complex tasks
}
```

**Model recommendations:**
- **TARS (PM)** - Sonnet (strategic thinking)
- **Dev Agent** - Haiku (fast iteration)
- **Designer** - Sonnet (creative)
- **QA Agent** - Haiku (focused testing)
- **Content Agent** - Haiku (writing)
- **Scout Agent** - Sonnet (analysis)

### Custom Roles

Add roles to SOUL.md to expand what an agent can do:

```markdown
## Your Core Responsibility

You own:
- Feature A
- Feature B
- **Your custom role here**
```

Then reference in config:
```json
{
  "roles": ["pm", "architect", "custom-role"]
}
```

## Performance Tips

### Reduce Network Latency

If agents are on different machines, optimize networking:

```bash
# Monitor Tailscale performance
tailscale status

# Use faster model for agents (Haiku is faster than Sonnet)
# Edit .claw/config.json to use faster model
```

### Reduce Heartbeat Overhead

Heartbeat checks happen every 30 seconds by default. To reduce:

```json
{
  "heartbeatIntervalMs": 60000  // Every 60 seconds instead of 30
}
```

### Scale to Larger Teams

For teams beyond 3-4 agents:

1. Split into multiple teams (Team Alpha + Team Beta)
2. Designate TARS as coordinator between teams
3. Use Bridge API to route messages intelligently

## Next Steps

- **Modify SOUL.md** - Customize agent personalities for your team
- **Create agents** - Add more agents for specific roles
- **Set up projects** - Use your team to build things
- **Monitor performance** - Track agent productivity and quality
- **Iterate** - Improve team workflows based on experience

---

**Ready to start?**

```bash
./scripts/setup-team.sh alpha
```

Then follow the startup instructions printed at the end.
