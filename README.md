# 🎯 Claw Control Center - Multi-Agent Task Management System

A production-ready, distributed task management system that orchestrates multiple AI agents across machines. Claw Control Center coordinates complex workflows, auto-assigns work based on agent capabilities, tracks progress in real-time, and integrates with external services.

**Version:** 1.0.0  
**Status:** Production Ready  
**License:** MIT

---

## 🚀 Quick Start (5 minutes)

### 1. Install Dependencies
```bash
npm install
cd projects/tars-operator-hub && npm install
```

### 2. Start the Bridge API Server
```bash
cd projects/tars-operator-hub
npm run bridge

# Expected output:
# 🌉 Bridge running on http://localhost:8787
# ✅ API ready
```

### 3. Register Your First Agent
```bash
node scripts/register-agent.mjs \
  --agent dev-1 \
  --roles backend-dev,api \
  --emoji 🔧
```

### 4. Create a Task
```bash
curl -X POST http://localhost:8787/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Implement user authentication",
    "description": "Add OAuth2 support to the API",
    "priority": "P1",
    "assignedTo": "dev-1"
  }'
```

### 5. View Your Tasks
```bash
curl http://localhost:8787/api/agents/dev-1/tasks | jq .
```

**That's it!** Your agent is ready to work.

---

## 📋 Features

### ✅ Core Multi-Agent System
- **Agent Registration** - Register agents with roles, capabilities, and workspaces
- **Task Management** - Create, assign, and track tasks across agents
- **Auto-Assignment** - Intelligent task routing based on agent roles and workload
- **Real-Time Status** - Track task progress, blockers, and completion
- **Instance Discovery** - Automatic detection of online/offline instances
- **Heartbeat System** - Periodic task polling with staggered schedules

### ✅ Advanced Workflow Features
- **Task Dependencies** - Define task blocking relationships
- **Task Templates** - Reusable templates for common workflows
- **Recurring Tasks** - Automated routine task creation
- **Time Tracking** - Log actual hours spent on tasks
- **Activity Feed** - Real-time feed of all system events
- **Kanban Board** - Visual drag-and-drop task management

### ✅ External Integrations
- **GitHub** - Link tasks to issues, track PR merges
- **Telegram** - Task notifications and status updates
- **Google Calendar** - Sync task deadlines to calendar
- **Slack/Discord** - Event notifications (extensible)

### ✅ Production Ready
- **Multi-Instance Support** - Run agents on multiple machines via Tailscale
- **Load Balancing** - Automatic workload distribution
- **Error Recovery** - Graceful failover for offline instances
- **Comprehensive Logging** - Debug complex workflows
- **API Documentation** - Complete REST API reference
- **CLI Tools** - Command-line interface for agents and admins

---

## 🏗️ Architecture

### System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      Claw Control Center                     │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              React UI / Dashboard                      │  │
│  │  • Kanban Board (drag-drop tasks)                     │  │
│  │  • Agent Grid (status, workload)                      │  │
│  │  • Activity Feed (real-time updates)                  │  │
│  │  • Project Management                                 │  │
│  └──────────────────────────────────────────────────────┘  │
│                         ↓ (HTTP)                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           Bridge API Server (Express)                 │  │
│  │  • /api/tasks - CRUD operations                       │  │
│  │  • /api/agents - Registration, status                 │  │
│  │  • /api/notifications - Task delivery                 │  │
│  │  • /api/instances - Discovery, health                 │  │
│  │  • /api/integrations - External services              │  │
│  └──────────────────────────────────────────────────────┘  │
│      ↓ (persist)          ↓ (poll)          ↓ (notify)     │
│   ┌──────────┐       ┌──────────┐       ┌──────────┐      │
│   │  Tasks   │       │ Agents & │       │ Notif.   │      │
│   │   JSON   │       │  Status  │       │  Store   │      │
│   └──────────┘       └──────────┘       └──────────┘      │
└─────────────────────────────────────────────────────────────┘
         ↑                    ↑                    ↑
     [Tailscale]         [Heartbeats]        [Webhooks]
         ↑                    ↑                    ↑
  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
  │  Instance 1 │    │  Instance 2 │    │ External    │
  │  (5 agents) │    │  (3 agents) │    │ Services    │
  │             │    │             │    │             │
  │ ┌─────────┐ │    │ ┌─────────┐ │    │ ┌─────────┐ │
  │ │ agent-1 │ │    │ │ agent-6 │ │    │ │ GitHub  │ │
  │ │ agent-2 │ │    │ │ agent-7 │ │    │ │ Telegram│ │
  │ │ agent-3 │ │    │ │ agent-8 │ │    │ │Calendar │ │
  │ │ agent-4 │ │    │ └─────────┘ │    │ └─────────┘ │
  │ │ agent-5 │ │    │             │    │             │
  │ └─────────┘ │    │             │    │             │
  └─────────────┘    └─────────────┘    └─────────────┘
```

### Data Flow: Task Assignment

```
User/AI creates task
        ↓
POST /api/tasks
        ↓
Task stored in tasks.json
        ↓
Auto-assignment logic analyzes task
        ↓
Matching agent selected (by role, workload)
        ↓
Task assigned to agent
        ↓
Notification created
        ↓
Notification delivered to agent's instance
        ↓
Agent receives notification in next heartbeat
        ↓
Agent starts working on task
        ↓
Status updates flow back to dashboard
        ↓
Activity feed updates in real-time
```

---

## 🛠️ Tech Stack

### Backend
- **Runtime:** Node.js 22+
- **Framework:** Express.js 5
- **Storage:** JSON files (.clawhub/*.json)
- **CLI:** Commander.js + Chalk

### Frontend
- **Framework:** React 19
- **Build:** Vite 7
- **Styling:** Tailwind CSS 4
- **UI Components:** Radix UI
- **Drag-and-Drop:** dnd-kit
- **Icons:** Lucide React, Hero Icons

### DevOps & Deployment
- **Networking:** Tailscale (VPN mesh)
- **Testing:** Vitest, @testing-library/react, @playwright/test
- **Package Manager:** npm/pnpm
- **Version Control:** Git

---

## 📁 Project Structure

```
.
├── README.md                          # This file
├── CHANGELOG.md                       # Release notes
├── package.json                       # Root dependencies
├── docs/                              # Documentation
│   ├── API.md                         # REST API reference
│   ├── CLI_REFERENCE.md               # Command-line tools
│   ├── AGENT_SETUP.md                 # Agent configuration guide
│   ├── MULTI_INSTANCE.md              # Multi-machine setup
│   ├── INTEGRATIONS.md                # External service setup
│   └── TROUBLESHOOTING.md             # Common issues
├── projects/
│   └── tars-operator-hub/             # Main application
│       ├── bridge/                    # API server + storage
│       │   ├── server.mjs             # Express server
│       │   ├── agentsStore.mjs        # Agent data
│       │   ├── tasksStore.mjs         # Task data
│       │   ├── tasksStore.test.mjs    # Task tests
│       │   ├── taskAssignment.mjs     # Auto-assignment logic
│       │   ├── notificationsStore.mjs # Notification delivery
│       │   ├── activityStore.mjs      # Activity feed
│       │   ├── instanceDiscovery.mjs  # Multi-instance tracking
│       │   ├── slot-heartbeats.mjs    # Heartbeat scheduler
│       │   ├── taskTemplates.mjs      # Template system
│       │   ├── routines.mjs           # Recurring tasks
│       │   ├── routineExecutor.mjs    # Routine executor
│       │   ├── integrations/          # External integrations
│       │   │   ├── github.mjs         # GitHub API
│       │   │   ├── telegram.mjs       # Telegram API
│       │   │   └── calendar.mjs       # Google Calendar
│       │   └── rules.mjs              # Workflow rules
│       ├── src/                       # React frontend
│       │   ├── components/
│       │   │   ├── KanbanBoard.tsx    # Kanban board
│       │   │   ├── AgentGrid.tsx      # Agent dashboard
│       │   │   ├── ActivityFeed.tsx   # Activity timeline
│       │   │   └── TaskDetail.tsx     # Task modal
│       │   ├── pages/                 # Route pages
│       │   ├── services/              # API client
│       │   └── App.tsx                # Root component
│       ├── package.json
│       ├── vite.config.ts             # Vite build config
│       ├── tsconfig.json              # TypeScript config
│       └── dist/                      # Built frontend
├── cli/                               # CLI tools
│   └── claw.mjs                       # Agent CLI (claw command)
├── scripts/                           # Setup & utility scripts
│   ├── register-agent.mjs             # Register agent
│   ├── setup-agent-workspace.sh       # Setup agent workspace
│   └── setup-heartbeats.mjs           # Configure cron jobs
├── docker/                            # Docker configs
│   ├── Dockerfile                     # Container image
│   ├── docker-compose.yml             # Multi-container setup
│   └── nginx.conf                     # Reverse proxy
└── .clawhub/                          # Runtime data (generated)
    ├── agents.json                    # Registered agents
    ├── tasks.json                     # All tasks
    ├── notifications.json             # Notification queue
    └── instances.json                 # Online instances
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 22+ ([download](https://nodejs.org))
- npm or pnpm
- Tailscale (for multi-instance) - optional

### Local Development Setup

1. **Clone and install:**
   ```bash
   git clone <repo>
   cd /home/openclaw/.openclaw/workspace
   npm install
   cd projects/tars-operator-hub && npm install
   ```

2. **Start the bridge:**
   ```bash
   npm run bridge
   # Bridge running on http://localhost:8787
   ```

3. **In another terminal, start the UI:**
   ```bash
   npm run dev
   # UI running on http://localhost:5173
   ```

4. **In yet another terminal, setup agents:**
   ```bash
   # Register agent
   node scripts/register-agent.mjs \
     --agent pm \
     --name "Project Manager" \
     --roles pm,product-owner \
     --emoji 👔

   # Register developer
   node scripts/register-agent.mjs \
     --agent dev-1 \
     --name "Backend Dev" \
     --roles backend-dev,api \
     --emoji 🔧

   # Setup heartbeats
   node scripts/setup-heartbeats.mjs --setup
   ```

5. **Verify everything works:**
   ```bash
   # List agents
   curl http://localhost:8787/api/agents | jq .

   # Create a task
   curl -X POST http://localhost:8787/api/tasks \
     -H "Content-Type: application/json" \
     -d '{
       "title": "Test task",
       "priority": "P1"
     }'

   # View dashboard
   open http://localhost:5173
   ```

### First Task Workflow

1. **Open dashboard:** http://localhost:5173
2. **Create task:** Click "New Task" button
3. **Fill details:** Title, description, priority
4. **Click create:** Task appears in "Queued" lane
5. **Assign task:** Drag to dev-1 or click "Auto-assign"
6. **View notification:** Agent receives notification at next heartbeat
7. **Agent starts:** `claw task:start <id>`
8. **Completion:** Agent marks `claw task:done <id>`
9. **Celebration:** Task moves to "Done" lane ✨

---

## 📖 Documentation Guide

| Document | Purpose | Audience |
|----------|---------|----------|
| **README.md** | Overview, quick start | Everyone |
| **docs/API.md** | REST API endpoints, examples | Developers, integrators |
| **docs/CLI_REFERENCE.md** | Command-line tools | Agents, admins |
| **docs/AGENT_SETUP.md** | Agent registration, heartbeats | DevOps, team leads |
| **docs/MULTI_INSTANCE.md** | Distributed setup, Tailscale | DevOps engineers |
| **docs/INTEGRATIONS.md** | GitHub, Telegram, Calendar | Integrations engineers |
| **docs/TROUBLESHOOTING.md** | Common issues, debugging | Support, developers |
| **CHANGELOG.md** | Release notes, version history | Project managers |

---

## 🧪 Testing

### Run All Tests
```bash
cd projects/tars-operator-hub
npm test
```

### Test Coverage
```bash
# Unit tests for stores
npm test

# E2E tests (Playwright)
npm run test:e2e

# Load testing
npm run test:load
```

### Test Categories
- **Unit Tests** - Individual functions (tasks, agents, assignments)
- **Integration Tests** - APIs and data flow
- **E2E Tests** - Full user workflows (UI + API)
- **Load Tests** - 10+ concurrent agents

---

## 🔧 Development

### Adding a New Endpoint

**Example: Create GET /api/stats**

1. **Add handler in bridge/server.mjs:**
```javascript
app.get('/api/stats', (req, res) => {
  const agents = loadAgents();
  const tasks = loadTasks();
  res.json({
    agents: agents.length,
    tasks: tasks.length,
    completed: tasks.filter(t => t.lane === 'done').length
  });
});
```

2. **Add test in bridge/server.test.mjs:**
```javascript
test('GET /api/stats returns statistics', async (t) => {
  const res = await request(app).get('/api/stats');
  assert.equal(res.status, 200);
  assert.ok(res.body.agents >= 0);
});
```

3. **Document in docs/API.md:**
```markdown
### Get System Statistics

**Endpoint:** `GET /api/stats`

**Response:**
```json
{
  "agents": 5,
  "tasks": 23,
  "completed": 8
}
```
```

### Adding a New Integration

1. Create `bridge/integrations/myservice.mjs`
2. Implement webhook handler
3. Add config validation
4. Document in `docs/INTEGRATIONS.md`
5. Add tests in `.test.mjs`
6. Wire up in `server.mjs`

---

## 🚀 Deployment

### Docker Compose (Recommended)

```bash
cd docker
docker-compose up -d

# Check services
docker-compose ps

# View logs
docker-compose logs -f bridge
```

### Systemd Service

```bash
sudo cp docker/systemd/claw-bridge.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl start claw-bridge
sudo systemctl enable claw-bridge  # Start on boot

# Check status
sudo systemctl status claw-bridge
```

### Tailscale Multi-Instance

```bash
# Install Tailscale on each machine
curl -fsSL https://tailscale.com/install.sh | sh

# Connect to VPN
sudo tailscale up

# Start bridge on each machine
npm run bridge

# Discover instances
curl http://localhost:8787/api/instances | jq .

# Tasks automatically route to best agent
```

---

## 🔐 Security

### API Authentication
- Token-based (Bearer token)
- Default: None (local development)
- Production: Set `BRIDGE_TOKEN` env var

```bash
# Require token
export BRIDGE_TOKEN=your-secret-token

# Client must send
Authorization: Bearer your-secret-token
```

### Data Protection
- All data stored in `.clawhub/` (local)
- No data leaves your machine
- Integrations use OAuth/tokens
- Webhook validation enabled

### Multi-Instance Security
- Tailscale provides encrypted mesh network
- Instance discovery validates peers
- Task routing authenticated

---

## 📊 Monitoring

### Health Checks

```bash
# Bridge is alive
curl http://localhost:8787/health

# Instance status
curl http://localhost:8787/api/instances | jq .

# Agent heartbeats
curl http://localhost:8787/api/agents | \
  jq '.[] | {id, lastHeartbeat}'
```

### Logging

```bash
# Bridge logs
tail -f bridge.log

# Full debug logs
DEBUG=* npm run bridge

# Agent heartbeat logs
tail -f ~/.openclaw/agents/dev-1/heartbeat.log
```

### Metrics

```bash
# System statistics
curl http://localhost:8787/api/stats | jq .

# Response:
# {
#   "agents": 5,
#   "online": 4,
#   "tasks": 23,
#   "completed": 8,
#   "activeAssignments": 7,
#   "avgTaskDuration": 120
# }
```

---

## 🆘 Troubleshooting

### Bridge won't start

```bash
# Check port is available
lsof -i :8787

# Kill process using port
kill -9 <PID>

# Check logs
npm run bridge 2>&1 | tee bridge.log

# Verify data files exist
ls -la .clawhub/
```

### Agent not receiving tasks

```bash
# Check agent is registered
curl http://localhost:8787/api/agents | jq '.[] | {id, status}'

# Check notifications pending
curl http://localhost:8787/api/agents/dev-1/notifications | jq .

# Check heartbeat is running
crontab -l | grep dev-1

# Manual heartbeat test
cd ~/.openclaw/agents/dev-1
node run-agent-heartbeat.mjs
```

### Tasks not assigning to right agent

```bash
# Check task auto-assignment logic
curl -X POST http://localhost:8787/api/tasks/123/auto-assign | jq .

# Verify agent roles
curl http://localhost:8787/api/agents/dev-1 | jq '.roles'

# Check assignment rules
curl http://localhost:8787/api/config/assignment-rules | jq .
```

See [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) for more solutions.

---

## 📚 Examples

### Example 1: Create Feature Request Task

```bash
curl -X POST http://localhost:8787/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Add dark mode",
    "description": "Implement dark theme for web dashboard",
    "priority": "P2",
    "projectId": "proj-1",
    "estimatedHours": 8,
    "tags": ["feature", "ui"]
  }'
```

### Example 2: Assign with Dependencies

```bash
curl -X PUT http://localhost:8787/api/tasks/task-1 \
  -H "Content-Type: application/json" \
  -d '{
    "assignedTo": "dev-1",
    "dependsOn": ["task-2"],
    "blocks": ["task-3"]
  }'
```

### Example 3: Create from Template

```bash
# List templates
curl http://localhost:8787/api/templates | jq .

# Use template
curl -X POST http://localhost:8787/api/tasks/from-template \
  -H "Content-Type: application/json" \
  -d '{
    "templateId": "new-feature",
    "projectId": "proj-1",
    "overrides": {
      "title": "Build user profiles feature"
    }
  }'
```

### Example 4: Setup GitHub Integration

```bash
curl -X POST http://localhost:8787/api/integrations/github/configure \
  -H "Content-Type: application/json" \
  -d '{
    "token": "ghp_...",
    "repo": "myorg/myrepo",
    "autoLink": true,
    "autoClose": true
  }'
```

---

## 🤝 Contributing

We welcome contributions! Here's how:

### Development Workflow

1. **Create feature branch:**
   ```bash
   git checkout -b feature/my-feature
   ```

2. **Make changes and test:**
   ```bash
   npm run test
   npm run lint
   ```

3. **Commit with conventional messages:**
   ```bash
   git commit -m "feat: add new notification type"
   git commit -m "fix: handle offline instance gracefully"
   git commit -m "docs: update API reference"
   ```

4. **Push and create PR:**
   ```bash
   git push origin feature/my-feature
   ```

### Code Standards

- **TypeScript:** For React components and type safety
- **ESLint:** All code must pass linting
- **Tests:** New features must have tests
- **Documentation:** Update docs for new features
- **Commits:** Use conventional commit format

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:** feat, fix, docs, style, refactor, test, chore  
**Scopes:** api, ui, cli, integrations, etc.

**Examples:**
- `feat(api): add bulk task assignment endpoint`
- `fix(ui): kanban board scroll issue`
- `docs(setup): clarify tailscale configuration`

---

## 📄 License

MIT License - see LICENSE file for details

---

## 🎯 Roadmap

### Version 1.1 (Q2 2026)
- [ ] Advanced filtering and search
- [ ] Task commenting and discussions
- [ ] Mobile app (React Native)
- [ ] Audit logging
- [ ] Role-based access control (RBAC)

### Version 1.2 (Q3 2026)
- [ ] Machine learning task prioritization
- [ ] Workflow builder UI
- [ ] Cost tracking and reporting
- [ ] Jira/Linear integration
- [ ] Slack/Discord threading

### Version 2.0 (Q4 2026)
- [ ] Distributed tracing
- [ ] Federated instances (multiple bridges)
- [ ] Real-time collaboration
- [ ] Enterprise features (SSO, audit logs)
- [ ] Advanced analytics dashboard

---

## 💬 Support

### Getting Help

- **Documentation:** See [docs/](docs/) folder
- **Issues:** Report bugs on GitHub
- **Discussions:** Ask questions in Discussions
- **Email:** support@clawcontrol.dev

### Common Questions

**Q: Can I run multiple bridges?**  
A: Yes! Use Tailscale for networking and instance discovery. See [docs/MULTI_INSTANCE.md](docs/MULTI_INSTANCE.md).

**Q: How do I scale to 100+ agents?**  
A: Use load balancing and multiple bridge instances. Each instance can handle 20-50 agents. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

**Q: Is my data private?**  
A: Yes! All data stays in `.clawhub/` on your machine. No cloud required.

**Q: Can I use this without Tailscale?**  
A: Yes, for single machine setup. For multi-instance, you need some networking (VPN, etc).

---

## 🙏 Acknowledgments

Built with love by the Claw team using:
- Node.js and Express
- React and Vite
- Radix UI and Tailwind CSS
- OpenClaw for agent orchestration

---

**Ready to get started?** → [Quick Start](#-quick-start) | **Need help?** → [Troubleshooting](docs/TROUBLESHOOTING.md) | **Want to contribute?** → [Contributing](#-contributing)

---

*Last updated: 2026-02-14 | Made with ❤️ for distributed teams*
