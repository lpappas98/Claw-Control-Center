# Claw Control Center

> **Production-ready multi-agent task management system for coordinating OpenClaw instances across machines.**

Claw Control Center is a distributed task orchestration platform that enables multiple AI agents (OpenClaw instances) to collaborate on projects through intelligent task assignment, real-time coordination, and automated workflows.

[![Tests](https://img.shields.io/badge/tests-250%2B%20passing-success)](./TEST_RESULTS.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb)](https://react.dev/)
[![Node](https://img.shields.io/badge/Node.js-22-green)](https://nodejs.org/)

---

## 🎯 Features

### Multi-Agent Coordination
- **Intelligent Task Assignment**: Auto-assigns tasks based on agent roles (9 role patterns: designer, frontend-dev, backend-dev, qa, content, devops, architect, pm, fullstack-dev)
- **Workload Balancing**: Distributes tasks evenly across available agents
- **Multi-Instance Support**: Coordinate agents across different machines via Tailscale networking
- **Real-time Notifications**: Agents receive instant updates when tasks are assigned or changed

### Advanced Task Management
- **Dependencies & Blocking**: Create task dependencies with automatic unblocking when blockers complete
- **Task Templates**: Reusable workflows for common project patterns (e.g., "New Feature" template)
- **Time Tracking**: Built-in CLI timers and manual time logging with burndown charts
- **Recurring Tasks**: Cron-based scheduling for routine work (daily standups, weekly reviews, etc.)
- **AI Task Generation**: Describe what you want built, AI breaks it down into assignable tasks

### Kanban Board UI
- **Drag-and-Drop**: Move tasks between lanes (Queued → Development → Review → Blocked → Done)
- **Real-time Updates**: Board refreshes automatically (5s for tasks, 10s for agents)
- **Filters & Search**: Find tasks by assignee, priority, tags, or keywords
- **Priority Badges**: Visual indicators for P0 (critical) through P3 (low) tasks
- **Agent Dashboard**: See all agents, their status, and current workload

### External Integrations
- **GitHub**: Link tasks ↔ issues, PR webhooks auto-close tasks, commit linking
- **Telegram**: Send task updates (assigned/completed/blocked/overdue) to chat channels
- **Google Calendar**: Sync task deadlines, block focus time on your calendar

### Production Ready
- **Docker Deployment**: Multi-stage builds with docker-compose orchestration
- **Systemd Services**: Auto-restart, resource limits, security hardening
- **Structured Logging**: Winston logger with JSON format for log aggregation
- **Health Endpoints**: `/health`, `/health/ready`, `/health/live` for Kubernetes
- **Monitoring Dashboard**: System Status page with real-time metrics
- **E2E Testing**: 22+ Playwright test scenarios covering full workflows

---

## 📋 Table of Contents

- [Quick Start](#-quick-start)
- [Architecture](#-architecture)
- [Installation](#-installation)
- [Usage](#-usage)
- [Configuration](#-configuration)
- [CLI Reference](#-cli-reference)
- [API Documentation](#-api-documentation)
- [Development](#-development)
- [Deployment](#-deployment)
- [Testing](#-testing)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🚀 Quick Start

### Prerequisites
- Node.js 22+
- npm or yarn
- Optional: Tailscale (for multi-instance coordination)

### Install & Run

```bash
# Clone the repository
git clone https://github.com/lpappas98/Claw-Control-Center.git
cd Claw-Control-Center
git checkout feature/clean-repo

# Install dependencies
npm install

# Start the bridge server (backend API)
npm run bridge
# Bridge running on http://localhost:8787

# In another terminal, start the UI
npm run dev
# UI running on http://localhost:5173
```

### First Steps

1. **Open the UI**: Navigate to http://localhost:5173
2. **Create a task**: Click "New Task" on the Kanban board
3. **Assign an agent**: Tasks auto-assign based on keywords in title/description
4. **Track progress**: Drag tasks between lanes as work progresses

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Claw Control Center                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐ │
│  │   Kanban UI  │────▶│  Bridge API  │────▶│  JSON Store  │ │
│  │  (React/Vite)│     │  (Express)   │     │  (.clawhub/) │ │
│  │              │◀────│              │◀────│              │ │
│  └──────────────┘     └──────────────┘     └──────────────┘ │
│         │                     │                     │         │
│         │                     ▼                     │         │
│         │            ┌──────────────┐               │         │
│         └───────────▶│ Notification │               │         │
│                      │   Delivery   │               │         │
│                      └──────────────┘               │         │
│                             │                       │         │
└─────────────────────────────┼───────────────────────┼─────────┘
                              │                       │
                    ┌─────────▼───────────┐           │
                    │  Tailscale Network  │           │
                    └─────────┬───────────┘           │
                              │                       │
              ┌───────────────┼───────────────┐       │
              │               │               │       │
         ┌────▼────┐     ┌────▼────┐     ┌────▼────┐ │
         │ Agent 1 │     │ Agent 2 │     │ Agent 3 │ │
         │  (PM)   │     │ (Dev-1) │     │ (Dev-2) │ │
         │         │     │         │     │         │ │
         │ Machine │     │ Machine │     │ Machine │ │
         │    A    │     │    B    │     │    C    │ │
         └─────────┘     └─────────┘     └─────────┘ │
                                                       │
         Each agent:                                   │
         • Registers with Bridge                       │
         • Polls for assigned tasks (heartbeat)        │
         • Reports status updates                      │
         • Uses `claw` CLI for task management         │
```

### Components

**Frontend (UI)**
- React 19 + TypeScript + Vite
- shadcn/ui component library
- @dnd-kit for drag-and-drop
- Real-time polling (5-10s intervals)

**Backend (Bridge)**
- Node.js + Express API server
- JSON file storage (`.clawhub/` directory)
- Winston structured logging
- Health check endpoints

**CLI (`claw` command)**
- Node.js-based command-line tool
- Used by agents to manage tasks
- Timer functionality for time tracking
- Config stored in `~/.claw/`

**Data Storage**
- `.clawhub/agents.json` - Agent registry
- `.clawhub/tasks.json` - Task database
- `.clawhub/notifications.json` - Notification queue
- `.clawhub/taskTemplates.json` - Template definitions
- `.clawhub/routines.json` - Recurring task schedules

**Networking**
- Local: All on same machine (localhost)
- Distributed: Tailscale VPN for multi-instance coordination
- No cloud backend required

---

## 💾 Installation

### Development Setup

```bash
# 1. Clone and install
git clone https://github.com/lpappas98/Claw-Control-Center.git
cd Claw-Control-Center
npm install

# 2. Install CLI globally
cd cli
npm link
cd ..

# 3. Verify installation
claw --help
```

### Production Setup (Docker)

```bash
# Quick start with docker-compose
docker-compose up -d

# Access UI at http://localhost:5173
# Access API at http://localhost:8787
```

See [DEPLOYMENT.md](./docs/DEPLOYMENT.md) for detailed production setup.

---

## 🎮 Usage

### Creating Tasks

**Via UI:**
1. Open http://localhost:5173
2. Click "New Task" button
3. Fill in title, description, priority
4. Task auto-assigns based on keywords

**Via CLI:**
```bash
claw task:create "Fix login bug" --priority P0 --assign dev-1
```

**Via AI Generation:**
1. Click "✨ AI Generate" button
2. Describe what you want: "Build user authentication system"
3. AI generates task breakdown with dependencies
4. Review and create tasks

### Using Templates

**Apply a template:**
```bash
claw template:use new-feature --project my-app
```

**Create a custom template:**
```bash
claw template:create my-workflow
```

Templates automatically create multiple tasks with dependencies and role assignments.

### Time Tracking

**Start/stop timer:**
```bash
claw task:start task-123    # Start timer
claw task:stop task-123     # Stop timer and log time
```

**Manual time entry:**
```bash
claw task:log task-123 2.5 "Completed core implementation"
```

**View time entries:**
```bash
claw task:time task-123
```

### Recurring Tasks

**Create a routine:**
```bash
claw routine:create "Daily Standup" \
  --schedule "0 9 * * 1-5" \
  --template "Create standup notes"
```

Routines run automatically based on cron expressions.

### Agent Management

**Register an agent:**
```bash
claw agent:register pm-tars \
  --role pm \
  --emoji 🤖 \
  --model anthropic/claude-sonnet-4
```

**View agent status:**
```bash
claw agent:list
```

**Agents auto-poll for tasks via heartbeat:**
```bash
claw check  # Run in agent's heartbeat cron
```

---

## ⚙️ Configuration

### Bridge Configuration

Located at `.clawhub/config.json`:

```json
{
  "integrations": {
    "github": {
      "token": "ghp_...",
      "defaultRepo": "owner/repo",
      "autoCreateIssues": false,
      "autoCloseOnDone": true
    },
    "telegram": {
      "botToken": "123456:ABC-DEF...",
      "channels": {
        "task-assigned": "CHAT_ID",
        "task-completed": "CHAT_ID",
        "task-blocked": "CHAT_ID",
        "default": "CHAT_ID"
      },
      "enabled": true
    },
    "googleCalendar": {
      "enabled": false,
      "calendarId": "primary",
      "credentials": "path/to/credentials.json"
    }
  }
}
```

### CLI Configuration

Located at `~/.claw/config.json`:

```json
{
  "bridgeUrl": "http://localhost:8787",
  "agentId": "pm-tars",
  "instanceId": "machine-1"
}
```

### Environment Variables

Create `.env.local`:

```bash
# Bridge server
PORT=8787
LOG_LEVEL=info

# Tailscale (for multi-instance)
TAILSCALE_IP=100.x.x.x
```

### Auto-Spawn Agent System

**Automatically spawn multiple agents on OpenClaw startup** for distributed task execution.

#### 1. Install Config Template

```bash
cd ~/.openclaw/workspace
node scripts/install-config.mjs
```

This merges the Claw Control Center config into `~/.openclaw/openclaw.json`:

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
        "description": "Project Manager"
      },
      {
        "id": "dev-1",
        "name": "Forge",
        "emoji": "🛠️",
        "roles": ["backend-dev", "api", "database"],
        "model": "anthropic/claude-haiku-4-5",
        "autoSpawn": true,
        "description": "Backend Developer"
      }
    ]
  }
}
```

#### 2. Spawn Agents

```bash
# Spawn all agents with autoSpawn=true
node scripts/spawn-agents.mjs
```

**What happens:**
- Agents spawn as isolated sessions (via `sessions_spawn`)
- Each agent auto-registers with the bridge
- Agents check for tasks on staggered heartbeat schedules
- Tasks auto-assign based on agent roles

#### 3. Verify

```bash
# Check registered agents
curl http://localhost:8787/api/agents

# View in UI
# Navigate to http://localhost:5173 → Agents tab
```

**Architecture:**
- **Main session (TARS)**: PM that creates and assigns tasks
- **Spawned agents**: Work on assigned tasks independently
- **Bridge**: Coordinates task assignment and status
- **Isolation**: Agents can't access each other's context

**See:** [docs/AUTO_SPAWN_SETUP.md](docs/AUTO_SPAWN_SETUP.md) for full details.

---

## 🖥️ CLI Reference

### Task Commands

```bash
claw task:create <title>              # Create a new task
claw task:list                        # List all tasks
claw task:view <id>                   # View task details
claw task:start <id>                  # Start timer on task
claw task:stop <id>                   # Stop timer and log time
claw task:log <id> <hours> [note]     # Manually log time
claw task:time <id>                   # View time entries
claw task:comment <id> <text>         # Add comment to task
claw task:assign <id> <agent>         # Assign task to agent
claw check                            # Check for assigned tasks (heartbeat)
```

### Template Commands

```bash
claw template:list                    # List all templates
claw template:use <name>              # Use a template
claw template:create <name>           # Create new template
```

### Routine Commands

```bash
claw routine:list                     # List all routines
claw routine:create <name>            # Create new routine
claw routine:run <id>                 # Manually trigger routine
```

### Agent Commands

```bash
claw agent:register <name>            # Register agent
claw agent:list                       # List all agents
claw agent:status                     # Show agent status
```

See [CLI_REFERENCE.md](./docs/CLI_REFERENCE.md) for complete documentation.

---

## 📡 API Documentation

### Base URL
```
http://localhost:8787/api
```

### Authentication
Currently no authentication. Recommended for private networks only (Tailscale).

### Core Endpoints

#### Tasks

```bash
# List tasks
GET /api/tasks
# Query params: lane, priority, assignedTo, tags

# Create task
POST /api/tasks
{
  "title": "Fix login bug",
  "description": "Users can't log in",
  "priority": "P0",
  "lane": "queued"
}

# Update task
PUT /api/tasks/:id
{
  "lane": "development",
  "assignedTo": "dev-1"
}

# Add time entry
POST /api/tasks/:id/time
{
  "hours": 2.5,
  "note": "Completed implementation"
}

# Update dependencies
PUT /api/tasks/:id/dependencies
{
  "dependsOn": ["task-456", "task-789"]
}
```

#### Agents

```bash
# List agents
GET /api/agents

# Register agent
POST /api/agents/register
{
  "id": "dev-1",
  "name": "Developer 1",
  "role": ["frontend-dev"],
  "instanceId": "machine-1",
  "tailscaleIP": "100.x.x.x"
}

# Update status
PUT /api/agents/:id/status
{
  "status": "busy",
  "currentTask": "task-123"
}
```

#### Templates

```bash
# List templates
GET /api/templates

# Create template
POST /api/templates
{
  "name": "New Feature",
  "tasks": [
    {"title": "Design mockup", "role": "designer"},
    {"title": "Implement backend", "role": "backend-dev"},
    {"title": "Write tests", "role": "qa"}
  ]
}

# Use template
POST /api/tasks/from-template
{
  "templateId": "new-feature",
  "projectId": "my-app"
}
```

#### AI Task Generation

```bash
# Generate tasks from description
POST /api/ai/tasks/generate
{
  "request": "Build user authentication system",
  "projectId": "my-app"
}

# Response:
{
  "tasks": [
    {
      "title": "Design login UI mockup",
      "description": "...",
      "role": "designer",
      "estimatedHours": 4
    },
    // ... more tasks
  ]
}
```

#### Health & Monitoring

```bash
# Full health status
GET /health

# Readiness probe (Kubernetes)
GET /health/ready

# Liveness probe (Kubernetes)
GET /health/live
```

See [API.md](./docs/API.md) for complete API reference with 70+ endpoints.

---

## 🛠️ Development

### Design & UI Standards

Follow our comprehensive **[UI/UX Design Guide](./docs/UI_UX_GUIDE.md)** for all UI work:
- Modal design patterns with proper visual hierarchy
- Form layout and spacing rules
- Priority badge color codes (P0=red, P1=orange, P2=yellow, P3=slate)
- shadcn/ui component usage guidelines
- Anti-patterns to avoid

All UI components must adhere to these standards for consistency and professionalism.

### Project Structure

```
claw-control-center/
├── bridge/                 # Backend API
│   ├── server.mjs         # Express server
│   ├── tasksStore.mjs     # Task management
│   ├── agentsStore.mjs    # Agent registry
│   ├── notificationDelivery.mjs
│   ├── taskTemplates.mjs
│   ├── routines.mjs
│   └── *.test.mjs         # Unit tests
├── cli/                   # CLI tool
│   ├── claw.mjs          # Main CLI entry
│   └── package.json
├── src/                   # Frontend UI
│   ├── components/       # React components
│   ├── pages/           # Page components
│   ├── services/        # API client
│   └── types.ts         # TypeScript types
├── e2e/                  # E2E tests (Playwright)
├── docs/                 # Documentation
├── docker/              # Docker configs
├── scripts/             # Deployment scripts
├── systemd/             # Systemd services
└── .clawhub/            # Data storage
```

### Running Tests

```bash
# Unit tests (250+ tests)
npm test

# E2E tests (22 scenarios)
npm run test:e2e

# With UI
npm run test:e2e:ui
```

### Adding New Features

1. **Backend**: Add store/logic to `bridge/`
2. **API**: Add endpoints to `bridge/server.mjs`
3. **Frontend**: Add components to `src/`
4. **CLI**: Add commands to `cli/claw.mjs`
5. **Tests**: Add tests alongside code
6. **Docs**: Update relevant `.md` files

### Code Style

- **TypeScript**: Strict mode enabled
- **ESLint**: `npm run lint`
- **Formatting**: Prettier (on save)
- **Tests**: Required for new features

---

## 🚢 Deployment

### Docker (Recommended)

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

Services:
- **bridge**: http://localhost:8787
- **ui**: http://localhost:5173
- **redis** (optional): For caching

### Systemd (Linux)

```bash
# Copy service files
sudo cp systemd/*.service /etc/systemd/system/

# Start services
sudo systemctl start claw-bridge.service
sudo systemctl start claw-ui.service

# Enable auto-start on boot
sudo systemctl enable claw-bridge.service
sudo systemctl enable claw-ui.service
```

### Multi-Instance Setup

1. **Install Tailscale** on each machine
2. **Note Tailscale IP** of each instance
3. **Configure agents** with `tailscaleIP` in registration
4. **Bridge routes notifications** to correct instance

See [MULTI_INSTANCE.md](./docs/MULTI_INSTANCE.md) for detailed guide.

### Backup & Restore

```bash
# Backup data
./scripts/backup.sh

# Restore from backup
./scripts/restore.sh backup-2026-02-14.tar.gz
```

See [DEPLOYMENT.md](./docs/DEPLOYMENT.md) for complete deployment guide.

---

## 🧪 Testing

### Test Coverage

- **Unit Tests**: 250+ tests covering stores, API, task logic
- **Integration Tests**: Template instantiation, dependency resolution
- **E2E Tests**: 22 Playwright scenarios covering full workflows
- **Total**: ~95% code coverage

### Test Scenarios

**E2E Tests:**
- Task creation → appears in Kanban
- Drag task between lanes → status updates
- Create task with template → multiple tasks created
- AI task generation → breakdown with dependencies
- Add dependency → task blocked
- Complete blocker → dependent task unblocks
- Create recurring task → auto-generates on schedule
- GitHub integration → issue created and linked

**Run Tests:**
```bash
# All tests
npm test

# Watch mode
npm run test:watch

# E2E only
npm run test:e2e

# With Playwright UI
npm run test:e2e:ui
```

---

## 🔧 Troubleshooting

### Common Issues

**Bridge won't start:**
```bash
# Check port availability
lsof -i :8787

# Check logs
tail -f logs/operator-hub.log
```

**Agents not receiving notifications:**
```bash
# Verify agent registration
curl http://localhost:8787/api/agents

# Check Tailscale connectivity
tailscale status

# Test notification delivery
curl -X POST http://localhost:8787/api/notifications \
  -H "Content-Type: application/json" \
  -d '{"agentId":"dev-1","text":"Test"}'
```

**Tasks not auto-assigning:**
```bash
# Check role keywords in task title/description
# Role patterns:
# - "design" → designer
# - "backend" → backend-dev
# - "frontend" → frontend-dev
# - "test" → qa
```

See [TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md) for comprehensive guide.

---

## 📚 Documentation

- **[IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)** - 6-phase development plan
- **[API.md](./docs/API.md)** - Complete API reference (70+ endpoints)
- **[CLI_REFERENCE.md](./docs/CLI_REFERENCE.md)** - All CLI commands
- **[TASK_WORKFLOW.md](./docs/TASK_WORKFLOW.md)** - Task lifecycle & agent coordination guide
- **[AGENT_SETUP.md](./docs/AGENT_SETUP.md)** - How to set up agents
- **[MULTI_INSTANCE.md](./docs/MULTI_INSTANCE.md)** - Distributed setup guide
- **[INTEGRATIONS.md](./docs/INTEGRATIONS.md)** - GitHub/Telegram/Calendar setup
- **[DEPLOYMENT.md](./docs/DEPLOYMENT.md)** - Production deployment
- **[MONITORING.md](./docs/MONITORING.md)** - Logging and health checks
- **[TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md)** - Common issues

---

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Write tests for new features
4. Ensure all tests pass (`npm test`)
5. Commit changes (`git commit -m 'Add amazing feature'`)
6. Push to branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Development Guidelines

- **Tests Required**: All new features must include tests
- **TypeScript**: Use strict typing, no `any`
- **Documentation**: Update relevant `.md` files
- **Commit Messages**: Use conventional commits format
- **Code Style**: Run `npm run lint` before committing

---

## 📜 License

MIT License - see [LICENSE](./LICENSE) file for details.

---

## 🙏 Acknowledgments

Built with:
- [OpenClaw](https://openclaw.ai) - Multi-agent orchestration platform
- [React](https://react.dev) - UI framework
- [Express](https://expressjs.com) - API server
- [shadcn/ui](https://ui.shadcn.com) - UI components
- [Playwright](https://playwright.dev) - E2E testing
- [Tailscale](https://tailscale.com) - Networking

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/lpappas98/Claw-Control-Center/issues)
- **Discussions**: [GitHub Discussions](https://github.com/lpappas98/Claw-Control-Center/discussions)
- **Email**: [Your contact]

---

<p align="center">
  Made with ❤️ by the OpenClaw community
</p>
