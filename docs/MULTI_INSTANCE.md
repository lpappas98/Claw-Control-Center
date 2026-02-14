# Multi-Instance Setup Guide

How to set up multiple OpenClaw instances running on different machines, coordinated via a central bridge using Tailscale for networking.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│           Central Bridge Server                  │
│  (Primary coordination point)                    │
│  - http://bridge.internal:8787                  │
│  - Aggregates tasks & agents from all instances │
│  - Manages notifications                        │
│  - Tracks instance health                       │
└─────────────────────────────────────────────────┘
         ↑           ↑           ↑
    [Tailscale]  [Tailscale]  [Tailscale]
         ↑           ↑           ↑
    ┌────────┐  ┌────────┐  ┌────────┐
    │Instance│  │Instance│  │Instance│
    │ Mac    │  │ Linux  │  │Docker  │
    │        │  │        │  │        │
    │ 5 ages │  │ 3 ages │  │ 4 ages │
    └────────┘  └────────┘  └────────┘
```

---

## Prerequisites

### 1. Tailscale Account

Create a free account at [tailscale.com](https://tailscale.com)

- Sign up (GitHub, Google, or email)
- Create organization/tailnet
- Generate auth keys (required for automated setup)

### 2. Install Tailscale

**macOS:**
```bash
brew install tailscale
brew services start tailscale
```

**Linux (Ubuntu/Debian):**
```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo systemctl start tailscale
```

**Linux (RHEL/CentOS):**
```bash
sudo yum install tailscale
sudo systemctl start tailscale
```

**Docker:**
```dockerfile
FROM node:22

RUN curl -fsSL https://tailscale.com/install.sh | sh

# ... rest of Dockerfile
```

### 3. Connect to Tailscale

**Interactive (local machine):**
```bash
sudo tailscale up

# Open browser URL to authenticate
# You'll be added to your tailnet with an IP like 100.x.x.x
```

**Automated (for servers):**
```bash
# Generate auth key in Tailscale admin panel
# Settings → Auth Keys → Generate

AUTH_KEY="tskey-..."  # From admin panel
sudo tailscale up --authkey=$AUTH_KEY --hostname=openclaw-server
```

**Docker:**
```bash
docker run -d \
  --name=tailscale \
  -e TAILSCALE_AUTHKEY=$AUTH_KEY \
  -e TAILSCALE_HOSTNAME=openclaw-docker \
  ghcr.io/tailscale/tailscale:latest

# Get Tailscale IP
docker exec tailscale tailscale ip -4
```

### 4. Verify Connectivity

```bash
# Get your IP
tailscale ip -4
# Output: 100.x.x.x

# Ping another machine on tailnet
ping 100.y.y.y  # Another machine's Tailscale IP

# Should work even behind NAT/firewalls!
```

---

## Instance Setup

### Single Machine (Bridge + Agents)

**Machine 1: Mac (Bridge + 2 Agents)**

```bash
# 1. Clone and install
cd /home/user/projects
git clone <repo> claw-control-center
cd claw-control-center
npm install
cd projects/tars-operator-hub && npm install

# 2. Connect to Tailscale
sudo tailscale up

# 3. Get your Tailscale IP
TAILSCALE_IP=$(tailscale ip -4)
echo $TAILSCALE_IP  # e.g., 100.64.xxx.xxx

# 4. Start bridge
npm run bridge &

# 5. Register agents
node scripts/register-agent.mjs \
  --agent macbook-dev-1 \
  --roles backend-dev,api \
  --emoji 🔧 \
  --bridge http://localhost:8787  # Still localhost on same machine

node scripts/register-agent.mjs \
  --agent macbook-qa \
  --roles qa,testing \
  --emoji 🧪

# 6. Setup heartbeats
node scripts/setup-heartbeats.mjs --setup
```

**Machine 2: Linux Server (Bridge + 3 Agents)**

```bash
# 1. Clone and install
cd /opt
sudo git clone <repo> claw-control-center
cd claw-control-center
sudo npm install
cd projects/tars-operator-hub && sudo npm install

# 2. Connect to Tailscale
sudo tailscale up --authkey=$AUTH_KEY --hostname=openclaw-server

# 3. Get Tailscale IP
TAILSCALE_IP=$(tailscale ip -4)
echo $TAILSCALE_IP  # e.g., 100.65.xxx.xxx

# 4. Start bridge (listen on Tailscale IP)
BRIDGE_HOST=$TAILSCALE_IP npm run bridge &

# 5. Register agents
node scripts/register-agent.mjs \
  --agent server-dev-1 \
  --roles backend-dev,devops \
  --bridge http://localhost:8787

node scripts/register-agent.mjs \
  --agent server-dev-2 \
  --roles backend-dev,database

node scripts/register-agent.mjs \
  --agent server-infra \
  --roles devops,infrastructure
```

---

## Central Bridge Configuration

The **central bridge** is the single source of truth. All agents report to it.

### Option 1: Bridge on Dedicated Machine

**Recommended for production**

```bash
# Machine 3: Small VPS or always-on machine
# (Can be minimal spec: 1 CPU, 512 MB RAM)

# 1. Install dependencies
sudo apt-get update && sudo apt-get install -y nodejs npm

# 2. Clone repo
cd /opt && sudo git clone <repo> claw-center
cd claw-center

# 3. Install and setup
npm install
cd projects/tars-operator-hub && npm install

# 4. Connect to Tailscale
sudo tailscale up --authkey=$CENTRAL_AUTH_KEY --hostname=claw-bridge

# 5. Get Tailscale IP
BRIDGE_IP=$(tailscale ip -4)
echo "Bridge will be at: http://$BRIDGE_IP:8787"

# 6. Start bridge on port 8787 (listens on all interfaces)
npm run bridge

# Expected output:
# 🌉 Bridge running on http://0.0.0.0:8787
```

### Option 2: Bridge on Existing Machine

Use one of your existing machines as the bridge:

```bash
# On Machine 1 (macbook):
# In separate terminal
BRIDGE_PORT=8787 npm run bridge

# Agents on Machine 2 point here:
node scripts/register-agent.mjs \
  --agent server-dev-1 \
  --roles backend-dev \
  --bridge http://100.64.xxx.xxx:8787  # Machine 1's Tailscale IP
```

---

## Agent Registration (Multi-Instance)

When registering agents, specify the bridge URL:

```bash
# On any machine, register with central bridge
node scripts/register-agent.mjs \
  --agent macbook-dev-1 \
  --roles backend-dev \
  --emoji 🔧 \
  --bridge http://100.64.xxx.xxx:8787  # Central bridge Tailscale IP

# Agent information is stored on the bridge
curl http://100.64.xxx.xxx:8787/api/agents | jq .

# Returns agents from ALL machines:
# [
#   {id: "macbook-dev-1", instanceId: "macbook", ...},
#   {id: "server-dev-1", instanceId: "server", ...},
#   {id: "server-dev-2", instanceId: "server", ...}
# ]
```

---

## Instance Discovery

The system automatically discovers online/offline instances.

### How It Works

1. **Agent registration** - Agent's instance ID and Tailscale IP recorded
2. **Heartbeat** - Agent sends periodic heartbeat (every 15 min)
3. **Instance tracking** - Bridge records instance health
4. **Offline detection** - No heartbeat > 5 min = instance offline
5. **Task reassignment** - Offline instance's tasks reassigned

### View Instances

```bash
# From bridge machine (or any Tailscale machine)
curl http://100.64.xxx.xxx:8787/api/instances | jq .

# Output:
# [
#   {
#     "instanceId": "macbook",
#     "hostname": "macbook.local",
#     "tailscaleIP": "100.64.xxx.xxx",
#     "status": "online",
#     "agentCount": 2,
#     "lastHeartbeat": 1707900000000
#   },
#   {
#     "instanceId": "server",
#     "hostname": "server.internal",
#     "tailscaleIP": "100.65.xxx.xxx",
#     "status": "online",
#     "agentCount": 3,
#     "lastHeartbeat": 1707899900000
#   }
# ]
```

### Monitor Instance Health

```bash
# Get capacity metrics
curl http://bridge.ip:8787/api/instances/capacities | jq .

# Output:
# [
#   {
#     "instanceId": "macbook",
#     "agentCount": 2,
#     "taskCount": 5,
#     "availableCapacity": 3,
#     "healthScore": 92
#   },
#   {
#     "instanceId": "server",
#     "agentCount": 3,
#     "taskCount": 12,
#     "availableCapacity": 0,
#     "healthScore": 45
#   }
# ]
```

### Automatic Failover

If an instance goes offline:

```bash
# Bridge detects no heartbeat for 5 minutes
# Marks instance as offline
# Identifies unfinished tasks
# Reassigns tasks to healthiest online instance

# Agents on offline instance:
# - Receive reassignment notifications
# - Update their task assignments
# - Resume work
```

---

## Load Balancing

### Workload Distribution

The system automatically balances work:

```bash
# Task assignment prefers:
# 1. Matching role (backend-dev for backend tasks)
# 2. Lowest workload (fewest active tasks)
# 3. Best health score
# 4. Same instance if possible (reduce network traffic)
```

### Manual Load Balancing

If one instance is overloaded:

```bash
# 1. Check capacity
curl http://bridge:8787/api/instances/capacities | jq '.[] | {id: .instanceId, healthScore}'

# 2. Check agent workload
curl "http://bridge:8787/api/agents?instanceId=overloaded-instance" | jq '.[] | {id, activeTasks: .activeTasks | length}'

# 3. Reassign heavy tasks
curl -X PUT http://bridge:8787/api/tasks/task-123 \
  -H "Content-Type: application/json" \
  -d '{"assignedTo": "less-loaded-agent"}'

# 4. Monitor recovery
watch 'curl http://bridge:8787/api/instances/capacities | jq .'
```

---

## Configuration Management

### Environment Variables per Instance

**Machine 1 (Bridge):**
```bash
export BRIDGE_HOST=0.0.0.0
export BRIDGE_PORT=8787
export INSTANCE_ID=macbook
npm run bridge
```

**Machine 2 (Agents only):**
```bash
export BRIDGE_URL=http://100.64.xxx.xxx:8787
export INSTANCE_ID=server
npm run beats  # Start heartbeat scheduler
```

### Persistent Configuration

Create `.env` file per machine:

**Bridge Machine:**
```bash
cat > projects/tars-operator-hub/.env << 'EOF'
BRIDGE_HOST=0.0.0.0
BRIDGE_PORT=8787
BRIDGE_TOKEN=your-secret-token
INSTANCE_ID=claw-bridge-central

# Logging
DEBUG=bridge:*
LOG_LEVEL=info
EOF
```

**Agent Machine 1:**
```bash
cat > .env << 'EOF'
BRIDGE_URL=http://100.64.xxx.xxx:8787
BRIDGE_TOKEN=your-secret-token
INSTANCE_ID=macbook

# Heartbeat
HEARTBEAT_INTERVAL=900000  # 15 minutes
MAX_CONCURRENT_TASKS=3
EOF
```

---

## Network Configuration

### DNS Setup (Optional)

Instead of IP addresses, use DNS:

```bash
# Set Tailscale names in admin panel
# macbook → openclaw-macbook
# server → openclaw-server
# bridge → openclaw-bridge

# Then use names:
curl http://openclaw-bridge:8787/api/agents

# Or add to /etc/hosts for non-Tailscale DNS:
100.64.xxx.xxx openclaw-bridge bridge.internal
100.65.xxx.xxx openclaw-server server.internal
```

### ACLs (Access Control)

**Tailscale ACLs** (admin panel → Access controls):

```json
{
  "acls": [
    {
      "action": "accept",
      "src": ["tag:agent"],
      "dst": ["tag:bridge:8787"]
    },
    {
      "action": "accept",
      "src": ["tag:bridge"],
      "dst": ["tag:*:8787"]
    }
  ],
  "tagOwners": {
    "tag:agent": ["your-email"],
    "tag:bridge": ["your-email"]
  }
}
```

---

## Monitoring & Debugging

### Health Checks

```bash
# Bridge health
curl http://bridge:8787/health

# All agents
curl http://bridge:8787/api/agents | jq '.[] | {id, status, lastHeartbeat}'

# Specific instance
curl http://bridge:8787/api/instances | jq '.[] | select(.instanceId == "server")'
```

### Logs

**Bridge logs:**
```bash
# Real-time
tail -f projects/tars-operator-hub/bridge.log

# With debug
DEBUG=* npm run bridge 2>&1 | tee bridge.log
```

**Agent heartbeat logs:**
```bash
# On agent machine
tail -f ~/.openclaw/agents/agent-id/heartbeat.log

# Check Tailscale connectivity
ping 100.64.xxx.xxx  # Bridge IP
ping 100.65.xxx.xxx  # Other machine
```

### Troubleshooting Commands

```bash
# Check all agents can reach bridge
for AGENT in dev-1 dev-2 qa; do
  echo "Testing $AGENT..."
  curl -s http://bridge:8787/api/agents/$AGENT | jq '.status'
done

# Check instance discovery
curl http://bridge:8787/api/instances | jq '.[] | {id: .instanceId, status}'

# Check task distribution
curl "http://bridge:8787/api/tasks?limit=100" | \
  jq 'group_by(.assignedTo) | map({agent: .[0].assignedTo, count: length})'

# Monitor in real-time
watch -n 5 'curl -s http://bridge:8787/api/instances/capacities | jq .'
```

---

## Production Checklist

### Before Going Live

- [ ] **Tailscale Setup**
  - [ ] All machines connected to same tailnet
  - [ ] Ping between machines works
  - [ ] ACLs configured (if using)

- [ ] **Bridge Server**
  - [ ] Running on stable machine (or HA setup)
  - [ ] Data directory backed up (.clawhub/)
  - [ ] BRIDGE_TOKEN set (for security)
  - [ ] Listening on correct port (8787)

- [ ] **Agents**
  - [ ] All registered with bridge
  - [ ] Heartbeats configured and running
  - [ ] Can reach bridge (test curl)
  - [ ] Workspace directories exist

- [ ] **Monitoring**
  - [ ] Health checks configured
  - [ ] Logs being collected
  - [ ] Alerts for offline instances
  - [ ] Backup strategy for .clawhub/

- [ ] **Documentation**
  - [ ] Tailscale IPs documented
  - [ ] Bridge URL documented
  - [ ] Agent registry documented
  - [ ] Runbooks for common tasks

---

## High Availability (Advanced)

### Redundant Bridges

For mission-critical systems:

```bash
# Setup 2 bridges in primary/secondary config
# Both replicate agent/task data
# DNS/load balancer routes to primary
# If primary fails, switch to secondary

# Requires:
# 1. Shared database (not file-based)
# 2. Health checks + failover script
# 3. Data replication/sync
```

### Docker Orchestration

Use Docker Swarm or Kubernetes:

```bash
# Single bridge service
docker service create \
  --name claw-bridge \
  --publish 8787:8787 \
  claw-operator-hub:latest

# Agents in containers
docker run -d \
  -e BRIDGE_URL=http://claw-bridge:8787 \
  claw-agent:latest \
  --agent dev-1 --roles backend-dev
```

---

## Troubleshooting

### "Bridge connection refused"

```bash
# Check bridge is running
curl http://100.64.xxx.xxx:8787/health

# Check port
lsof -i :8787  # On bridge machine

# Check Tailscale IP
tailscale ip -4  # On bridge machine
```

### "Agent not found on bridge"

```bash
# Re-register with correct bridge URL
node scripts/register-agent.mjs \
  --agent test-agent \
  --roles qa \
  --bridge http://100.64.xxx.xxx:8787  # Full Tailscale URL

# Verify registration
curl http://100.64.xxx.xxx:8787/api/agents/test-agent | jq .
```

### "Heartbeat not running"

```bash
# Check Tailscale connectivity
ping 100.64.xxx.xxx  # Bridge IP

# Check cron job
crontab -l | grep heartbeat

# Run manually
cd ~/.openclaw/agents/dev-1
node run-agent-heartbeat.mjs --agent dev-1
```

### "Tasks not syncing between instances"

```bash
# All instances should talk to same bridge
# Verify bridge URL matches across all agents
curl http://bridge:8787/api/agents | jq '.[].id'  # Should list all agents

# Check instance discovery
curl http://bridge:8787/api/instances | jq '.[] | {id: .instanceId, status}'

# Force sync
curl -X POST http://bridge:8787/api/sync
```

---

## Performance Tips

1. **Network**
   - Keep bridge on machine with good uptime
   - Use Tailscale for all communication
   - Monitor latency between instances

2. **Load**
   - Distribute agents across machines
   - Keep agent-to-task ratio ~3:1
   - Use task priority to guide assignment

3. **Storage**
   - Regular backups of .clawhub/
   - Archive old tasks monthly
   - Monitor disk space

---

## Examples

### Example 1: 3-Machine Setup

**Machine 1 (macbook):**
```bash
sudo tailscale up
npm run bridge &  # Listens on localhost:8787

node scripts/register-agent.mjs --agent macbook-pm --roles pm
node scripts/register-agent.mjs --agent macbook-dev --roles backend-dev
node scripts/setup-heartbeats.mjs --setup
```

**Machine 2 (linux-server):**
```bash
sudo tailscale up --authkey=$KEY --hostname=server

# Get macbook's Tailscale IP
BRIDGE_IP=100.64.xxx.xxx

node scripts/register-agent.mjs \
  --agent server-dev --roles backend-dev \
  --bridge http://$BRIDGE_IP:8787

node scripts/setup-heartbeats.mjs --agent server-dev
```

**Machine 3 (vps-central):**
```bash
sudo tailscale up --authkey=$KEY --hostname=bridge
cd /opt/claw && npm run bridge &

# All agents point here
# Create DNS: openclaw-bridge
```

---

**Last updated:** 2026-02-14

For agent setup, see [AGENT_SETUP.md](AGENT_SETUP.md)  
For CLI help, see [CLI_REFERENCE.md](CLI_REFERENCE.md)
