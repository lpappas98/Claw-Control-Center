# Changelog

All notable changes to Claw Control Center are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-02-14

### 🎉 Production Release

The first stable release of Claw Control Center - a complete, production-ready multi-agent task management system.

---

## Phase 1: Core Agent System

### [0.1.0] - 2026-01-08

**Multi-agent infrastructure with task assignment**

#### Added

- **Agent Data Model & Store** (`bridge/agentsStore.mjs`)
  - Agent registration with id, name, emoji, roles, capabilities
  - Agent status tracking (online, offline, busy)
  - Instance discovery and multi-machine support
  - Agent persistence in `.clawhub/agents.json`

- **Agent Registration API**
  - `POST /api/agents/register` - Register agent with roles
  - `PUT /api/agents/:id/status` - Update agent status
  - `GET /api/agents` - List all agents
  - `GET /api/agents/:id` - Get agent details
  - Agent heartbeat tracking

- **Enhanced Task Model** (`bridge/tasksStore.mjs`)
  - Extended task schema with:
    - Lane system (queued, development, review, blocked, done)
    - Priority levels (P0, P1, P2, P3)
    - Agent assignment
    - Time tracking (estimated/actual hours)
    - Dependencies and blockers
    - Status history and comments
    - Task persistence in `.clawhub/tasks.json`

- **Auto-Assignment Logic** (`bridge/taskAssignment.mjs`)
  - Role-based matching (keywords → agent roles)
  - Workload balancing (prefer less-loaded agents)
  - Availability checking
  - Smart patterns for common roles:
    - "design|ui|mockup" → designer
    - "documentation|readme|content" → content editor
    - "backend|api|database" → backend dev
    - "frontend|react|ui" → frontend dev
    - "test|qa|e2e" → qa engineer

- **Notification System** (`bridge/notificationsStore.mjs`)
  - Notification storage and delivery
  - Multiple notification types
  - Read/unread tracking
  - Notification persistence in `.clawhub/notifications.json`
  - Worker for periodic delivery

- **Instance Discovery** (`bridge/instanceDiscovery.mjs`)
  - Automatic online/offline detection
  - Heartbeat-based health monitoring
  - Instance capacity tracking
  - Support for Tailscale networking

#### Testing

- Unit tests for stores (via vitest)
- Agent registration tests
- Task assignment tests

#### Documentation

- Agent registration guide
- Task model specification
- Auto-assignment rules documentation

---

## Phase 2: Agent CLI & Workflows

### [0.2.0] - 2026-01-22

**Command-line interface for agents**

#### Added

- **Agent CLI** (`cli/claw.mjs`)
  - `claw auth` - Authenticate with bridge
  - `claw whoami` - Show agent identity
  - `claw check` - Check new assignments
  - `claw tasks` - List agent's tasks
  - `claw task:view <id>` - Show task details
  - `claw task:start <id>` - Start working (move to development)
  - `claw task:stop <id>` - Stop working
  - `claw task:status <id> <status>` - Update task status
  - `claw task:comment <id> <text>` - Add comment
  - `claw task:done <id>` - Mark complete (move to done)
  - `claw project:view <id>` - Show project details
  - CLI configuration via `~/.claw/config.json`

- **Agent Heartbeat Integration**
  - Heartbeat template (`templates/agent-heartbeat.md`)
  - Staggered heartbeat schedule (every 15 min)
  - Automatic task polling at heartbeat
  - Status reporting mechanism
  - Response types (HEARTBEAT_OK, HEARTBEAT_PICKED_TASK, etc.)

- **Heartbeat Scheduling** (`scripts/setup-heartbeats.mjs`)
  - Cron-based heartbeat setup
  - Staggered schedules per agent
  - List available schedules
  - Setup and removal of heartbeats

- **Task Context Delivery**
  - `GET /api/tasks/:id/context` endpoint
  - Full context for task execution
  - Related tasks, dependencies, comments
  - Project rules and context

#### APIs Added

- `GET /api/tasks/:id/context` - Task execution context
- Agent CLI endpoints for task operations

#### Testing

- CLI integration tests
- Heartbeat workflow tests
- Task context tests

#### Documentation

- CLI reference guide with all commands
- Heartbeat system documentation
- Task context specification

---

## Phase 3: UI Enhancements

### [0.3.0] - 2026-02-05

**Visual task management interface**

#### Added

- **Kanban Board** (`src/components/KanbanBoard.tsx`)
  - Drag-and-drop task management (dnd-kit)
  - Columns: Queued, Development, Review, Blocked, Done
  - Task cards with:
    - Title, description (collapsed)
    - Assignee avatar
    - Priority badges
    - Tags
    - Time estimates
    - Comment count
  - Real-time updates from API polling
  - Filters: assignee, priority, project, tags
  - Search functionality

- **Agent Dashboard** (`src/pages/Agents.tsx`)
  - Agent grid view
  - Agent tiles showing:
    - Avatar (emoji)
    - Name and role
    - Status indicator (online/offline/busy)
    - Current task display
    - Workload metrics
    - Recent activity
  - Click to filter tasks by agent
  - Status indicators

- **Activity Feed Enhancements**
  - Real-time updates (10s polling)
  - Activity types:
    - Task created
    - Task assigned
    - Task status changed
    - Comment added
    - Task completed
    - Agent joined/left
  - Filter by agent, project, type
  - "Mark all as read" function
  - Timeline view

- **Task Detail Modal** (`src/components/TaskDetail.tsx`)
  - Full task information display
  - Edit capabilities
  - Comments section
  - Time tracking display
  - Dependency visualization
  - Action buttons (assign, start, comment, etc.)

- **Frontend Framework**
  - React 19 setup
  - Vite build optimization
  - Tailwind CSS styling
  - TypeScript support
  - Radix UI components

#### APIs Added

- Real-time task status updates
- Activity feed API with polling
- Updated task detail endpoints

#### Testing

- React component tests
- E2E tests for drag-and-drop
- UI integration tests

#### Documentation

- UI component guide
- Kanban board usage
- Dashboard documentation

---

## Phase 4: Advanced Features

### [0.4.0] - 2026-02-09

**Dependencies, templates, time tracking, AI features**

#### Added

- **Dependencies & Blocking** (`bridge/blockers.mjs`)
  - `dependsOn` and `blocks` arrays for tasks
  - Automatic unblock when dependencies complete
  - Dependency graph visualization
  - Block validation
  - `PUT /api/tasks/:id/dependencies` endpoint
  - UI visualization of blockers

- **Task Templates** (`bridge/taskTemplates.mjs`)
  - Template storage for common workflows
  - Template schema with task sequences
  - Role-based task assignment in templates
  - Dependency chaining in templates
  - `GET /api/templates` - List templates
  - `POST /api/tasks/from-template` - Create tasks from template
  - `POST /api/templates` - Create template
  - Template management UI

- **Time Tracking**
  - `claw task:start <id>` - Start timer
  - `claw task:stop <id>` - Stop timer with time entry
  - `claw task:log-time <id> <hours>` - Manual time logging
  - Time entry history
  - Estimated vs actual hours display
  - Burndown charts per project
  - Time entry APIs

- **Conversational Task Generation**
  - AI-powered task breakdown
  - `POST /api/ai/tasks/generate` endpoint
  - Context-aware generation
  - Role matching for auto-assignment
  - UI modal for AI task generation
  - Task review before creation

- **Recurring Tasks (Routines)** (`bridge/routines.mjs`, `bridge/routineExecutor.mjs`)
  - Cron-based routine scheduling
  - Routine storage in `.clawhub/routines.json`
  - Routine executor (scheduled task creation)
  - `GET /api/routines` - List routines
  - `POST /api/routines` - Create routine
  - `PUT /api/routines/:id` - Update routine
  - `DELETE /api/routines/:id` - Delete routine
  - Automatic task generation from routines

#### APIs Added

- `PUT /api/tasks/:id/dependencies` - Update dependencies
- `GET /api/tasks/:id/blockers` - Get blocking tasks
- `GET /api/templates` - List templates
- `POST /api/tasks/from-template` - Create from template
- `POST /api/ai/tasks/generate` - Generate tasks from request
- `GET /api/routines` - List routines
- `POST /api/routines` - Create routine
- `POST /api/tasks/:id/time` - Log time

#### Testing

- Dependency tests
- Template integration tests
- Time tracking tests
- Routine executor tests
- AI generation tests

#### Documentation

- Dependency system guide
- Template usage documentation
- Time tracking guide
- Routine setup documentation

---

## Phase 5: Multi-Instance & Integrations

### [0.5.0] - 2026-02-11

**Distributed agents, external service integrations**

#### Added

- **Multi-Instance Coordination**
  - Agent registration includes instanceId and tailscaleIP
  - Instance-aware task routing
  - `GET /api/instances` - List instances
  - `GET /api/instances/stats` - Instance statistics
  - `GET /api/instances/capacities` - Capacity metrics
  - Load balancing across instances
  - Automatic failover for offline instances

- **Tailscale Networking** (`docs/MULTI_INSTANCE.md`)
  - Multi-machine setup guide
  - Tailscale configuration
  - Instance discovery via Tailscale
  - Network ACLs
  - Mesh networking support

- **GitHub Integration** (`bridge/integrations/github.mjs`)
  - Task ↔ Issue linking
  - Auto-create tasks from issues
  - PR linking to tasks
  - Auto-close on merge
  - Webhook support for issue events
  - Commit message parsing
  - `POST /api/integrations/github/configure` - Setup
  - `POST /api/integrations/github/sync-issues` - Sync issues

- **Telegram Integration** (`bridge/integrations/telegram.mjs`)
  - Task notifications via Telegram bot
  - Customizable message formats
  - Event-based messages (assigned, blocked, completed)
  - Webhook support
  - `POST /api/integrations/telegram/configure` - Setup
  - `POST /api/integrations/telegram/test` - Test connection
  - `POST /api/integrations/telegram/send` - Send message

- **Google Calendar Integration** (`bridge/integrations/calendar.mjs`)
  - Sync task deadlines to calendar
  - Block time for tasks
  - Reminder integration
  - Auto-sync on deadline changes
  - `POST /api/integrations/calendar/configure` - Setup
  - `POST /api/integrations/calendar/sync` - Sync tasks
  - `POST /api/integrations/calendar/block-time` - Block time

- **Integration Framework**
  - Extensible integration architecture
  - Configuration management per integration
  - Health checks and status monitoring
  - Error handling and retry logic
  - Webhook validation

#### APIs Added

- `GET /api/instances` - List instances
- `GET /api/instances/stats` - Instance statistics
- `GET /api/instances/capacities` - Capacity metrics
- `POST /api/integrations/github/configure` - GitHub setup
- `POST /api/integrations/telegram/configure` - Telegram setup
- `POST /api/integrations/calendar/configure` - Calendar setup
- Integration status and test endpoints

#### Features

- Instance health monitoring
- Automatic task reassignment on instance failure
- Integration configuration persistence
- Integration status dashboard
- Webhook management

#### Testing

- Multi-instance tests
- Integration tests for GitHub, Telegram, Calendar
- Failover tests
- Load balancing tests

#### Documentation

- Multi-instance setup guide
- Tailscale configuration
- GitHub integration guide
- Telegram integration guide
- Google Calendar integration guide

---

## Phase 6: Polish & Production

### [0.6.0] - 2026-02-14

**Complete documentation, testing, and deployment**

#### Added

- **Comprehensive Documentation**
  - Complete README.md with quick start
  - API reference (docs/API.md)
  - CLI reference (docs/CLI_REFERENCE.md)
  - Agent setup guide (docs/AGENT_SETUP.md) - enhanced
  - Multi-instance guide (docs/MULTI_INSTANCE.md)
  - Integrations guide (docs/INTEGRATIONS.md)
  - CHANGELOG.md (this file)
  - Architecture diagrams and examples
  - Screenshots and visual guides

- **Testing Suite**
  - Unit tests for all stores
  - Integration tests for APIs
  - E2E tests for UI workflows
  - Load testing for 10+ agents
  - Test coverage reporting
  - `npm test` runs all tests

- **Deployment Configuration**
  - Docker setup (docker/Dockerfile)
  - Docker Compose (docker/docker-compose.yml)
  - Nginx reverse proxy (docker/nginx.conf)
  - Systemd service files
  - Environment configuration templates
  - Backup/restore scripts

- **Production Hardening**
  - Error handling improvements
  - Graceful shutdown
  - Health check endpoints
  - Monitoring integration
  - Security best practices
  - Data validation on all inputs

- **Developer Experience**
  - ESLint configuration
  - TypeScript strict mode
  - Pre-commit hooks
  - Debug logging
  - Development setup guide
  - Contributing guidelines

- **Examples & Templates**
  - Example workflows
  - Configuration templates
  - Integration examples
  - Deployment examples
  - Common task templates

#### Features

- Full API documentation with curl examples
- Complete CLI command reference
- Setup guides for all major features
- Troubleshooting guide
- Performance tuning guide
- Security hardening guide

#### Documentation

- Complete project documentation (README.md + 5 docs/ files)
- API specification with all endpoints
- CLI reference with examples
- Setup and deployment guides
- Integration guides
- Troubleshooting guide

#### Testing

- Comprehensive test coverage
- E2E test suite
- Load testing
- Security testing

#### Version

**1.0.0** - First stable release

---

## [Unreleased]

### Planned for 1.1

- Advanced filtering and search
- Task discussions/comments threading
- Mobile app (React Native)
- Audit logging
- Role-based access control (RBAC)
- Notification preferences

### Planned for 1.2

- Machine learning task prioritization
- Workflow builder UI (no-code)
- Cost tracking and reporting
- Jira/Linear integration
- Slack/Discord threaded conversations
- Performance analytics

### Planned for 2.0

- Distributed tracing
- Federated instances (multiple bridges)
- Real-time collaboration
- Enterprise features (SSO, audit logs)
- Advanced analytics dashboard
- Custom workflow rules

---

## How to Report Issues

Found a bug? Have a feature request?

1. Check existing issues first
2. Create detailed issue report
3. Include reproduction steps
4. Provide examples where possible

## Contributing

We welcome contributions! See [README.md](README.md#-contributing) for guidelines.

---

## Semantics

This project uses Semantic Versioning:

- **MAJOR** (0.x.0) - Major phase completion
- **MINOR** (x.1.0) - Feature additions
- **PATCH** (x.x.1) - Bug fixes and improvements

---

## Release Schedule

- **Phase** = 1 week of development
- **Minor** = 4-week cycle
- **Major** = Quarterly review and planning

---

**Last updated:** 2026-02-14

For more info, see [README.md](README.md) and [docs/](docs/)
