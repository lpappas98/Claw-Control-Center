# Agent Setup Guide

Complete guide to setting up and managing agents in the Claw Control Center multi-agent system.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Agent Registration](#agent-registration)
3. [Workspace Setup](#workspace-setup)
4. [Heartbeat System](#heartbeat-system)
5. [Cron Configuration](#cron-configuration)
6. [Multi-Instance Setup](#multi-instance-setup)
7. [Troubleshooting](#troubleshooting)

## Quick Start

### 1. Register an Agent (30 seconds)

```bash
cd /home/openclaw/.openclaw/workspace

# Register backend developer agent
node scripts/register-agent.mjs \
  --agent dev-1 \
  --roles backend-dev,api \
  --emoji 🔧
```

**Expected output:**
```
📡 Registering agent: dev-1 (🔧)
   Roles: backend-dev, api
   Bridge: http://localhost:8787
✅ Registration successful!
   ID: dev-1
   Status: online
   Instance: openclaw-macbook
   IP: 100.0.0.1
   Workspace: /home/openclaw/.openclaw/workspace
```

### 2. Setup Agent Workspace (1 minute)

```bash
# Create workspace with all necessary files
./scripts/setup-agent-workspace.sh dev-1 "🔧" "backend-dev,api"
```

**Creates:**
- `~/.openclaw/agents/dev-1/HEARTBEAT.md` - Task workflow template
- `~/.openclaw/agents/dev-1/SOUL.md` - Agent identity
- `~/.openclaw/agents/dev-1/.claw/config.json` - Bridge configuration

### 3. Start Heartbeat (2 minutes)

```bash
# List available schedules
node scripts/setup-heartbeats.mjs --list

# Setup heartbeat for agent
node scripts/setup-heartbeats.mjs --agent dev-1
```

**Heartbeat schedule:** Every 15 minutes (staggered to :03, :18, :33, :48)

### 4. Verify Setup (1 minute)

```bash
# Check agents list
curl http://localhost:8787/api/agents | jq .

# List agent's assigned tasks
curl http://localhost:8787/api/agents/dev-1/tasks | jq .

# Check instance status
curl http://localhost:8787/api/instances | jq .
```

**Done!** Agent is ready to pick up tasks.

---

## Agent Registration

### What Gets Registered

When you register an agent, the following information is stored in the bridge:

```json
{
  "id": "dev-1",
  "name": "Backend Developer",
  "emoji": "🔧",
  "roles": ["backend-dev", "api"],
  "model": "anthropic/claude-haiku-4-5",
  "workspace": "/home/openclaw/.openclaw/workspace",
  "status": "online",
  "instanceId": "openclaw-macbook",
  "tailscaleIP": "100.0.0.1",
  "activeTasks": [],
  "lastHeartbeat": 1707813620000,
  "createdAt": 1707813600000,
  "updatedAt": 1707813620000
}
```

### Registration Fields

| Field | Required | Description | Example |
|-------|----------|-------------|---------|
| `id` | ✅ | Unique agent identifier | `dev-1`, `pixel`, `qa-lead` |
| `name` | ⚠️ | Display name (defaults to id) | `Backend Developer` |
| `emoji` | ⚠️ | Avatar emoji (defaults to 🤖) | `🔧`, `🎬`, `🎨` |
| `roles` | ✅ | Capabilities (comma-separated) | `backend-dev,api,devops` |
| `model` | ⚠️ | AI model (defaults to haiku) | `anthropic/claude-opus` |
| `workspace` | ⚠️ | Workspace path | `/home/user/.openclaw/workspace` |

### Registration Scripts

#### Using `register-agent.mjs`

```bash
# Basic registration
node scripts/register-agent.mjs --agent dev-1 --roles backend-dev,api

# Full options
node scripts/register-agent.mjs \
  --agent dev-1 \
  --name "Backend Developer 1" \
  --roles backend-dev,api,devops \
  --emoji 🔧 \
  --model anthropic/claude-opus \
  --workspace /custom/workspace \
  --bridge http://192.168.1.100:8787

# Show help
node scripts/register-agent.mjs --help
```

### Idempotent Registration

Registration is **idempotent** - safe to run multiple times:
- If agent exists: updates existing record
- If agent is new: creates new record
- Same result: always upsert to latest values

**Use case:** Run in startup scripts for automatic agent recovery.

---

## Workspace Setup

### What Gets Created

Each agent needs a workspace with three key files:

```
~/.openclaw/agents/dev-1/
├── HEARTBEAT.md              # Task workflow template
├── SOUL.md                   # Agent identity
├── .claw/
│   ├── config.json           # Bridge configuration
│   ├── agent-id.txt          # Agent ID (quick reference)
│   └── logs/                 # Agent logs directory
└── .gitignore                # Git ignore rules
```

### Manual Workspace Setup

```bash
# Create directories
mkdir -p ~/.openclaw/agents/dev-1/.claw

# Copy heartbeat template
cp templates/agent-heartbeat.md ~/.openclaw/agents/dev-1/HEARTBEAT.md

# Create SOUL.md with agent identity
cat > ~/.openclaw/agents/dev-1/SOUL.md << 'EOF'
# 🔧 Backend Developer - Agent Identity

**Agent ID:** `dev-1`
**Name:** Backend Developer
**Roles:** backend-dev, api

## Personality
I'm a focused backend engineer. I:
- Pick high-priority tasks matching my skills
- Log time accurately
- Communicate blockers immediately
- Complete what I start

## Daily Routine
Every 15 minutes:
1. Check for new tasks
2. Pick highest priority task
3. Work until done
4. Report status
EOF

# Create .claw/config.json
cat > ~/.openclaw/agents/dev-1/.claw/config.json << 'EOF'
{
  "agentId": "dev-1",
  "name": "Backend Developer",
  "emoji": "🔧",
  "roles": ["backend-dev", "api"],
  "bridgeUrl": "http://localhost:8787",
  "workspace": "/home/openclaw/.openclaw/agents/dev-1",
  "heartbeatInterval": 900000,
  "maxConcurrentTasks": 3
}
EOF
```

### Using Setup Script

**Much easier:** Use the automated setup script:

```bash
./scripts/setup-agent-workspace.sh dev-1 "🔧" "backend-dev,api"

# With options
./scripts/setup-agent-workspace.sh dev-1 "🔧" "backend-dev,api" \
  --bridge http://192.168.1.100:8787 \
  --workspace /custom/agents \
  --name "Backend Dev #1"
```

**Output:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Agent Workspace Setup
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Workspace setup complete!

📌 Next Steps:
1. Register the agent with the bridge:
   node scripts/register-agent.mjs --agent dev-1 --roles "backend-dev,api" --emoji 🔧
2. Start using the workspace:
   cd /home/openclaw/.openclaw/agents/dev-1
3. Setup cron for automatic heartbeats:
   node scripts/setup-heartbeats.mjs --agent dev-1
```

---

## Heartbeat System

### What is a Heartbeat?

A **heartbeat** is a periodic task where an agent:
1. Checks for new tasks in the queue
2. Picks the highest-priority unblocked task
3. Works on it
4. Reports progress or completion

**Runs:** Every 15 minutes (staggered across agents)
**Timeout:** Agent marked offline after 5 minutes without heartbeat

### Heartbeat Workflow

```
Every 15 minutes (agent's scheduled time):
  ↓
1. Read HEARTBEAT.md
  ↓
2. claw check        # Check for new tasks
  ↓
3. claw tasks --status queued    # List available tasks
  ↓
4. claw task:start <id>         # Pick one
  ↓
5. Work on task (update status, log time)
  ↓
6. claw task:done <id>          # Mark complete
  ↓
7. Loop back to step 2 or reply HEARTBEAT_OK
```

### Heartbeat Template

Located at: `templates/agent-heartbeat.md`

**Key sections:**
- **Heartbeat Sequence** - Step-by-step task pickup
- **Task Pickup Strategy** - Priority ordering, blocking, workload
- **Heartbeat States** - HEARTBEAT_OK, HEARTBEAT_PICKED_TASK, etc.
- **Monitoring** - How to stay healthy
- **Quick Reference** - Common commands

### Heartbeat Execution

**Manual (for testing):**
```bash
cd ~/.openclaw/agents/dev-1
cat HEARTBEAT.md
# Follow the workflow manually
```

**Automatic (via cron):**
```bash
# Setup cron job
node scripts/setup-heartbeats.mjs --agent dev-1

# Check registered jobs (depends on cron system)
crontab -l | grep dev-1
```

### Heartbeat Response Types

| Response | Meaning | Example |
|----------|---------|---------|
| `HEARTBEAT_OK` | No tasks available, all complete | `✅ All done, standing by` |
| `HEARTBEAT_PICKED_TASK` | Started working on a task | `🎯 Picked: task-123 - Implement API` |
| `HEARTBEAT_WORKING` | Still working on task | `⏳ Working on task-456 (50% done)` |
| `HEARTBEAT_ERROR` | Something went wrong | `❌ Bridge connection failed` |
| `HEARTBEAT_BLOCKED` | Task blocked by dependency | `⛔ Blocked by task-789` |

---

## Cron Configuration

### Heartbeat Schedules (Staggered)

Each agent heartbeats at **different minutes** to spread load:

```
PM:       0,15,30,45 * * * * (every 15 min, :00)
Dev-1:    3,18,33,48 * * * * (every 15 min, :03)
Dev-2:    6,21,36,51 * * * * (every 15 min, :06)
Designer: 9,24,39,54 * * * * (every 15 min, :09)
QA:      12,27,42,57 * * * * (every 15 min, :12)
```

**Why staggered?** Prevents "thundering herd" problem where all agents heartbeat at once.

### Setup Cron Jobs

#### List Available Schedules
```bash
node scripts/setup-heartbeats.mjs --list

# Output:
# 📋 Heartbeat Schedules:
#
#   pm              → 0,15,30,45 * * * * (every 15 min, :00)
#   dev-1           → 3,18,33,48 * * * * (every 15 min, :03)
#   dev-2           → 6,21,36,51 * * * * (every 15 min, :06)
#   designer        → 9,24,39,54 * * * * (every 15 min, :09)
#   qa              → 12,27,42,57 * * * * (every 15 min, :12)
```

#### Setup All Agents
```bash
node scripts/setup-heartbeats.mjs --setup

# 📡 Fetching agents from bridge: http://localhost:8787
# ✅ Found 5 agents. Setting up heartbeats...
#
# ⏰ pm (👔) → 0,15,30,45 * * * *
# ⏰ dev-1 (🔧) → 3,18,33,48 * * * *
# ⏰ dev-2 (💻) → 6,21,36,51 * * * *
# ⏰ designer (🎨) → 9,24,39,54 * * * *
# ⏰ qa (🧪) → 12,27,42,57 * * * *
```

#### Setup Single Agent
```bash
node scripts/setup-heartbeats.mjs --agent dev-1

# With custom schedule:
node scripts/setup-heartbeats.mjs --agent custom-agent --schedule "*/5 * * * *"
```

#### Remove Heartbeat
```bash
node scripts/setup-heartbeats.mjs --remove dev-1
```

### Cron Format

Standard cron format: `minute hour day month day-of-week`

**Examples:**
```bash
*/5 * * * *       # Every 5 minutes
*/15 * * * *      # Every 15 minutes
0 * * * *         # Every hour at :00
0,30 * * * *      # Every 30 minutes
0 9 * * 1-5       # 9 AM on weekdays (Mon-Fri)
0 0 * * 0         # Midnight every Sunday
```

### Integration with OpenClaw

The setup script uses OpenClaw's cron API to register jobs:
```bash
curl -X POST http://localhost:8787/api/cron/register \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "dev-1",
    "schedule": "3,18,33,48 * * * *",
    "command": "cd /workspace && node run-agent-heartbeat.mjs --agent dev-1"
  }'
```

---

## Multi-Instance Setup

### Instance Discovery

The system tracks which OpenClaw instances are online:

```json
{
  "instanceId": "openclaw-macbook",
  "hostname": "macbook.local",
  "tailscaleIP": "100.0.0.1",
  "agentCount": 5,
  "status": "online",
  "lastHeartbeat": 1707813620000,
  "taskCount": 12
}
```

### Instance Health Monitoring

**Heartbeat timeout:** 5 minutes

- Agent sends heartbeat
- Instance's `lastHeartbeat` updated
- After 5 min of silence: instance marked `offline`
- Tasks on offline instances get reassigned

### API Endpoints

#### Get All Instances
```bash
curl http://localhost:8787/api/instances | jq .

# Response:
# [
#   {
#     "instanceId": "openclaw-macbook",
#     "hostname": "macbook.local",
#     "status": "online",
#     "agentCount": 5,
#     "taskCount": 12
#   },
#   {
#     "instanceId": "openclaw-server",
#     "hostname": "server.local",
#     "status": "offline",
#     "agentCount": 3,
#     "taskCount": 0
#   }
# ]
```

#### Get Instance Statistics
```bash
curl http://localhost:8787/api/instances/stats | jq .

# Response:
# {
#   "totalInstances": 2,
#   "onlineInstances": 1,
#   "offlineInstances": 1,
#   "totalAgents": 8,
#   "totalTasks": 12,
#   "avgTasksPerInstance": 6
# }
```

#### Get Instance Capacities
```bash
curl http://localhost:8787/api/instances/capacities | jq .

# Response:
# [
#   {
#     "instanceId": "openclaw-macbook",
#     "agentCount": 5,
#     "taskCount": 12,
#     "capacity": 3,
#     "healthScore": 85
#   }
# ]
```

### Failover and Rerouting

If an instance goes offline:

1. **Detection:** No heartbeat for 5 minutes
2. **Reassignment:** System identifies unfinished tasks
3. **Routing:** Tasks sent to healthiest online instance
4. **Notification:** Affected agents notified of reassignment

---

## Troubleshooting

### Agent Registration Issues

#### Bridge Connection Refused
```
❌ Failed to register with bridge: Error: ECONNREFUSED 127.0.0.1:8787
```

**Fix:**
```bash
# Check bridge is running
npm run bridge

# Check port
lsof -i :8787

# Verify URL
curl http://localhost:8787/api/agents
```

#### Missing Required Arguments
```
❌ Error: --agent is required
❌ Error: --roles is required
```

**Fix:**
```bash
node scripts/register-agent.mjs --agent myagent --roles role1,role2
```

#### Invalid Emoji
```
❌ Validation errors:
  - --emoji must be a single character or emoji
```

**Fix:** Use single emoji (1-2 chars):
```bash
--emoji 🔧  # ✅ OK
--emoji 🎨  # ✅ OK
--emoji ABC # ❌ Too long
```

### Workspace Setup Issues

#### Script Not Found
```
./scripts/setup-agent-workspace.sh: No such file or directory
```

**Fix:**
```bash
cd /home/openclaw/.openclaw/workspace
./scripts/setup-agent-workspace.sh dev-1 "🔧" "backend-dev"
```

#### Permission Denied
```
./scripts/setup-agent-workspace.sh: Permission denied
```

**Fix:**
```bash
chmod +x scripts/setup-agent-workspace.sh
```

#### Workspace Already Exists
Script creates new workspace without error. Existing files won't be overwritten.

**To reset:**
```bash
rm -rf ~/.openclaw/agents/dev-1
./scripts/setup-agent-workspace.sh dev-1 "🔧" "backend-dev"
```

### Heartbeat Issues

#### Cron Job Not Running
```bash
# Check registered jobs
crontab -l | grep dev-1

# Manual test
cd ~/.openclaw/agents/dev-1
cat HEARTBEAT.md
# Follow workflow manually
```

#### Agent Marked Offline
**Cause:** No heartbeat for > 5 minutes

**Fix:**
- Check heartbeat is scheduled: `crontab -l`
- Run manually: `node scripts/setup-heartbeats.mjs --agent dev-1`
- Verify bridge is running: `curl http://localhost:8787/api/agents`

#### Heartbeat Command Not Found
```
claw: command not found
```

**Fix:**
- Ensure you're in workspace directory
- Install CLI: `npm install` in workspace
- Check node_modules: `ls node_modules`

### Instance Discovery Issues

#### Instances Not Showing Up
```bash
curl http://localhost:8787/api/instances
# Returns: []
```

**Fix:** Register agents with heartbeats:
```bash
node scripts/register-agent.mjs --agent test --roles qa
node scripts/setup-heartbeats.mjs --agent test
# Wait for next heartbeat cycle
```

#### Health Score Too Low
Instance has low capacity or high task load.

**Monitoring:**
```bash
curl http://localhost:8787/api/instances/capacities | jq '.[].healthScore'
```

**Fix:** Load balance or offload tasks to other instances.

---

## Monitoring and Debugging

### Check Agent Status
```bash
# List all agents
curl http://localhost:8787/api/agents | jq '.[] | {id, status, lastHeartbeat}'

# Get specific agent
curl http://localhost:8787/api/agents/dev-1 | jq .
```

### Check Tasks
```bash
# Queued tasks
curl http://localhost:8787/api/tasks?lane=queued | jq .

# Agent's tasks
curl http://localhost:8787/api/agents/dev-1/tasks | jq .

# Task details
curl http://localhost:8787/api/tasks/task-abc123 | jq .
```

### Check Notifications
```bash
# Agent's notifications
curl http://localhost:8787/api/agents/dev-1/notifications | jq .

# Unread only
curl 'http://localhost:8787/api/agents/dev-1/notifications?unread=true' | jq .
```

### Bridge Logs
```bash
# Check bridge server logs
tail -f bridge.log

# Or with npm
npm run bridge 2>&1 | tee bridge.log
```

---

## Time Tracking (Phase 4)

### Overview

Track time spent on tasks for accurate project planning and billing.

### Start/Stop Timer

```bash
# Start working on task
claw task:start task-123

# Stop working and log time
claw task:stop task-123

# Stop with specific hours
claw task:stop task-123 4 "Implemented auth endpoints"
```

### Manual Time Logging

```bash
# Log time retroactively
claw task:log-time task-123 2 "Morning implementation"
claw task:log-time task-123 2 "Afternoon debugging"

# Check total
claw task:view task-123
# Shows: Logged: 4 hours / 8 hours estimated
```

### View Time Entries

```bash
curl http://localhost:8787/api/tasks/task-123 | jq '.timeEntries'

# Response:
# [
#   {"entryId": "time-1", "hours": 2, "note": "Morning work", "at": 1707813620000},
#   {"entryId": "time-2", "hours": 2, "note": "Afternoon work", "at": 1707813700000}
# ]
```

### Burndown Reports

```bash
# Per project
curl http://localhost:8787/api/projects/proj-1/burndown | jq .

# Per agent
curl http://localhost:8787/api/agents/dev-1/burndown | jq .
```

---

## Task Templates (Phase 4)

### Overview

Reusable task templates for common workflows (e.g., "New Feature", "Bug Fix").

### Using a Template

```bash
# List available templates
curl http://localhost:8787/api/templates | jq '.[] | {id, name}'

# Create tasks from template
curl -X POST http://localhost:8787/api/tasks/from-template \
  -H "Content-Type: application/json" \
  -d '{
    "templateId": "new-feature",
    "projectId": "proj-1",
    "overrides": {
      "title": "Build user profiles feature"
    }
  }' | jq .

# Response: Creates multiple related tasks
# [
#   {"id": "task-1", "title": "Design user profiles UI", "role": "designer"},
#   {"id": "task-2", "title": "Build profile API", "role": "backend-dev", "dependsOn": ["task-1"]},
#   {"id": "task-3", "title": "Implement profile page", "role": "frontend-dev", "dependsOn": ["task-2"]},
#   {"id": "task-4", "title": "Add tests", "role": "qa"},
#   {"id": "task-5", "title": "Update docs", "role": "content"}
# ]
```

### Common Templates

**new-feature**: Design → Backend → Frontend → Tests → Docs  
**bug-fix**: Reproduce → Fix → Tests → Deploy  
**release**: QA → Staging → Production → Monitor  
**documentation**: Write → Review → Publish  

---

## Recurring Tasks / Routines (Phase 4)

### Overview

Automatically create recurring tasks based on schedule (daily, weekly, monthly).

### Create a Routine

```bash
# Setup daily standup
curl -X POST http://localhost:8787/api/routines \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Daily Standup",
    "schedule": "0 9 * * 1-5",
    "taskTemplate": {
      "title": "Team Standup",
      "description": "Daily sync with the team",
      "assignedTo": "pm",
      "estimatedHours": 0.5
    },
    "enabled": true
  }' | jq .

# Response:
# {
#   "id": "routine-1",
#   "name": "Daily Standup",
#   "schedule": "0 9 * * 1-5",
#   "nextRun": 1707900000000,
#   "createdAt": 1707813620000
# }
```

### Schedule Format (Cron)

```
Minute Hour Day Month DayOfWeek
  0-59  0-23 1-31  1-12   0-6 (0=Sun, 6=Sat)

Examples:
0 9 * * 1-5         # 9 AM Mon-Fri
0 0 * * 0           # Midnight every Sunday
*/30 * * * *        # Every 30 minutes
0 0 1 * *           # 1st day of month at midnight
0 9,14 * * *        # 9 AM and 2 PM daily
```

### List Routines

```bash
curl http://localhost:8787/api/routines | jq '.[] | {name, schedule, nextRun}'
```

### Disable/Enable Routine

```bash
# Disable
curl -X PUT http://localhost:8787/api/routines/routine-1 \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}'

# Enable
curl -X PUT http://localhost:8787/api/routines/routine-1 \
  -H "Content-Type: application/json" \
  -d '{"enabled": true}'
```

---

## Integration Setup (Phase 5)

### GitHub Integration

Link tasks to GitHub issues and PRs:

```bash
# Configure GitHub
curl -X POST http://localhost:8787/api/integrations/github/configure \
  -H "Content-Type: application/json" \
  -d '{
    "token": "ghp_your_token",
    "repo": "org/repo",
    "autoLink": true,
    "autoClose": true
  }'

# When you open a GitHub issue, it auto-syncs to Claw
# When you merge a PR, the task auto-closes
```

**See:** [docs/INTEGRATIONS.md#github](INTEGRATIONS.md#github)

### Telegram Notifications

Get task notifications on Telegram:

```bash
# Create bot: Talk to @BotFather
# Get token: (from @BotFather)
# Get chat ID: (forward msg from @userinfobot)

curl -X POST http://localhost:8787/api/integrations/telegram/configure \
  -H "Content-Type: application/json" \
  -d '{
    "botToken": "123456:ABC...",
    "chatId": "-1001234567890",
    "enabled": true
  }'

# Now receive notifications:
# 🎯 New Task Assigned: Implement auth (P0)
# ⛔ Task Blocked: Waiting for API spec
# 🎉 Task Completed: Your task is done!
```

**See:** [docs/INTEGRATIONS.md#telegram](INTEGRATIONS.md#telegram)

### Google Calendar Sync

Sync task deadlines to your calendar:

```bash
# Download credentials.json from Google Cloud Console
# (See docs/INTEGRATIONS.md for detailed setup)

curl -X POST http://localhost:8787/api/integrations/calendar/configure \
  -H "Content-Type: application/json" \
  -d '{
    "credentialsPath": "/path/to/credentials.json",
    "calendarId": "primary",
    "enabled": true
  }'

# Sync tasks with deadlines
curl -X POST http://localhost:8787/api/integrations/calendar/sync

# Block time on calendar for a task
curl -X POST http://localhost:8787/api/integrations/calendar/block-time \
  -H "Content-Type: application/json" \
  -d '{"taskId": "task-123", "hours": 4, "date": "2026-02-15"}'
```

**See:** [docs/INTEGRATIONS.md#google-calendar](INTEGRATIONS.md#google-calendar)

---

## Advanced Features (Phase 5)

### Task Dependencies

Block tasks on other tasks:

```bash
# Task A depends on Task B
curl -X PUT http://localhost:8787/api/tasks/task-123/dependencies \
  -H "Content-Type: application/json" \
  -d '{
    "dependsOn": ["task-100"],
    "blocks": ["task-200"]
  }'

# When task-100 is done, task-123 is auto-notified
# Task-200 remains blocked until task-123 is done
```

### Multi-Instance Agents

Run agents on multiple machines:

```bash
# Machine 1 - Register agent
node scripts/register-agent.mjs \
  --agent macbook-dev \
  --roles backend-dev \
  --bridge http://bridge-ip:8787

# Machine 2 - Register agent
node scripts/register-agent.mjs \
  --agent server-dev \
  --roles backend-dev \
  --bridge http://bridge-ip:8787

# All agents report to same bridge
# Tasks auto-balance across machines
# See: docs/MULTI_INSTANCE.md for full setup
```

---

## Best Practices

1. **Register agents early** - Don't wait for tasks to appear
2. **Stagger heartbeats** - Don't all heartbeat at :00
3. **Use meaningful IDs** - `dev-1` is better than `a`
4. **Set realistic workload** - 2-3 concurrent tasks max
5. **Monitor health** - Check instance stats regularly
6. **Log time accurately** - Track actual hours spent
7. **Update status promptly** - Don't stay "busy" when done
8. **Handle blockers** - Report immediately, don't wait

---

## Related Files

- `scripts/register-agent.mjs` - Agent registration
- `scripts/setup-agent-workspace.sh` - Workspace setup
- `scripts/setup-heartbeats.mjs` - Cron configuration
- `templates/agent-heartbeat.md` - Heartbeat workflow template
- `projects/tars-operator-hub/bridge/instanceDiscovery.mjs` - Instance tracking
- `projects/tars-operator-hub/bridge/agentsStore.mjs` - Agent data storage
- `projects/tars-operator-hub/bridge/tasksStore.mjs` - Task management

---

## Support

For issues or questions:
1. Check this guide
2. Review script output and error messages
3. Check bridge logs: `tail -f bridge.log`
4. Verify bridge API: `curl http://localhost:8787/api/agents`
5. Test manually: Follow heartbeat steps by hand

---

*Last updated: 2026-02-14*
