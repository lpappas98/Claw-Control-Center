# Claw Control Center - Full Implementation Plan

## 🎯 Goal
Build a production-ready multi-agent task management system that coordinates OpenClaw instances across machines, similar to Clawe but with enhanced features.

## 📊 Current State Assessment

### ✅ Already Implemented
- Basic task storage (tasks.json, load/save functions)
- Task API endpoints (GET/POST/PUT /api/tasks)
- Worker system (workers.mjs, heartbeats)
- Project management (pmProjectsStore.mjs)
- Activity feed (activityStore.mjs)
- Bridge API server (server.mjs on port 8787)
- UI (React + Vite + Tailwind)
- OpenClaw integration patterns

### 🚧 Needs Enhancement
- Agent management (registration, capabilities, workload)
- Task assignment logic (auto-assign based on role)
- Agent-to-agent communication
- Notification delivery system
- Kanban board UI
- Agent CLI (`claw` command)
- Time tracking
- Dependencies & blocking
- Templates
- Recurring tasks (routines)

### 🆕 New Features to Build
- Multi-instance coordination (Tailscale networking)
- Conversational task creation via AI
- Workload balancing
- Priority intelligence
- Progress reporting & dashboards
- External integrations (GitHub, Slack, etc.)
- Context preservation
- Rollup views

---

## 🏗️ Implementation Phases

### Phase 1: Core Agent System (Week 1)
**Goal:** Multi-agent infrastructure with proper task assignment

#### 1.1 Agent Data Model & Store
- [ ] Create `bridge/agentsStore.mjs`
  - Schema: `{id, name, emoji, role[], capabilities[], model, workspace, status, instanceId, tailscaleIP}`
  - Methods: `loadAgents()`, `saveAgents()`, `getAgent(id)`, `updateAgent(id, patch)`
  - Persist to `.clawhub/agents.json`

- [ ] Agent registration API
  - `POST /api/agents/register` - Instance registers agents on startup
  - `PUT /api/agents/:id/status` - Heartbeat status updates
  - `GET /api/agents` - List all registered agents
  - `GET /api/agents/:id` - Get agent details

#### 1.2 Enhanced Task Model
- [ ] Update task schema in `tasks.mjs`:
  ```javascript
  {
    id, title, description,
    lane, // queued | development | review | blocked | done
    priority, // P0 | P1 | P2 | P3
    assignedTo, // agent id
    createdBy, // user or agent id
    parentId, // for subtasks
    projectId, // link to project
    tags: [],
    estimatedHours,
    actualHours,
    timeEntries: [{agentId, start, end, hours}],
    dependsOn: [taskId],
    blocks: [taskId],
    statusHistory: [{at, from, to, note}],
    comments: [{at, from, text}],
    createdAt,
    updatedAt
  }
  ```

- [ ] Task update endpoints:
  - `POST /api/tasks/:id/assign` - Assign to agent
  - `POST /api/tasks/:id/comment` - Add comment
  - `POST /api/tasks/:id/time` - Log time entry
  - `GET /api/tasks/:id/subtasks` - Get child tasks
  - `PUT /api/tasks/:id/dependencies` - Update dependencies

#### 1.3 Auto-Assignment Logic
- [ ] Create `bridge/taskAssignment.mjs`
  - Role-based matching (keywords → agent role)
  - Workload balancing (prefer less-loaded agents)
  - Availability check (agent status)
  - Smart patterns:
    - "design|ui|mockup" → designer
    - "documentation|readme|content" → content editor
    - "backend|api|database" → backend dev
    - "frontend|react|ui" → frontend dev
    - "test|qa|e2e" → qa
    - Default → pm/architect

- [ ] API endpoint:
  - `POST /api/tasks/:id/auto-assign` - Analyze task, assign to best agent

#### 1.4 Notification System
- [ ] Create `bridge/notificationsStore.mjs`
  - Schema: `{id, agentId, type, title, text, taskId?, projectId?, read, deliveredAt, createdAt}`
  - Persist to `.clawhub/notifications.json`
  - Methods: `createNotification()`, `getUndelivered()`, `markDelivered()`

- [ ] Notification API:
  - `GET /api/agents/:id/notifications` - Get notifications for agent
  - `POST /api/agents/:id/notifications` - Create notification
  - `PUT /api/notifications/:id/read` - Mark as read
  - `DELETE /api/notifications/:id` - Dismiss

- [ ] Notification delivery worker:
  - Polls for undelivered notifications (every 5s)
  - Calls OpenClaw agent via `/api/agents/:id/notify`
  - Marks as delivered

---

### Phase 2: Agent CLI & Workflows (Week 2)
**Goal:** Command-line interface for agents to interact with tasks

#### 2.1 Agent CLI (`claw` command)
- [ ] Create `cli/claw.mjs` (executable)
  - `claw auth` - Authenticate agent (save token)
  - `claw whoami` - Show current agent identity
  - `claw check` - Check for new notifications/tasks
  - `claw tasks` - List my tasks (with filters)
  - `claw task:view <id>` - Show task details
  - `claw task:start <id>` - Move to development, start timer
  - `claw task:stop <id>` - Stop timer
  - `claw task:status <id> <status>` - Update status
  - `claw task:comment <id> <text>` - Add comment
  - `claw task:done <id>` - Move to review
  - `claw project:view <id>` - Show project details

- [ ] Config file: `~/.claw/config.json`
  ```json
  {
    "bridgeUrl": "http://localhost:8787",
    "agentId": "dev-agent",
    "token": "..."
  }
  ```

- [ ] Install script:
  ```bash
  npm link  # Makes `claw` globally available
  ```

#### 2.2 Agent Heartbeat Integration
- [ ] Update `HEARTBEAT.md` template for agents:
  ```markdown
  # HEARTBEAT.md

  1. Check for new tasks assigned to you: `claw check`
  2. If tasks exist, read details: `claw task:view <id>`
  3. Start working: `claw task:start <id>`
  4. Update status when done: `claw task:done <id>`
  5. If nothing assigned, reply HEARTBEAT_OK
  ```

- [ ] Cron-based heartbeat polling (staggered per agent):
  - PM: every 15 min at :00, :15, :30, :45
  - Dev-1: every 15 min at :03, :18, :33, :48
  - Dev-2: every 15 min at :06, :21, :36, :51
  - Designer: every 15 min at :09, :24, :39, :54
  - QA: every 15 min at :12, :27, :42, :57

#### 2.3 Task Context Delivery
- [ ] API endpoint:
  - `GET /api/tasks/:id/context` - Full context for task execution
    ```json
    {
      "task": {...},
      "project": {...},
      "projectRules": [...],
      "relatedTasks": [...],
      "recentComments": [...],
      "uploadedFiles": [...],
      "dependencies": [...]
    }
    ```

---

### Phase 3: UI Enhancements (Week 3)
**Goal:** Kanban board, agent dashboard, activity feed

#### 3.1 Kanban Board
- [ ] Create `src/components/KanbanBoard.tsx`
  - Columns: Queued | Development | Review | Blocked | Done
  - Drag-and-drop (react-beautiful-dnd or dnd-kit)
  - Task cards show: title, assignee avatar, priority badge, tags
  - Filter by: assignee, priority, project, tags
  - Search bar

- [ ] Task card component:
  - Title, description (collapsed)
  - Assignee avatar + name
  - Priority badge (P0 red, P1 orange, P2 yellow, P3 gray)
  - Estimated/actual hours
  - Subtask count badge (if epic)
  - Comment count
  - Click → open task detail modal

#### 3.2 Agent Dashboard
- [ ] Create `src/pages/Agents.tsx`
  - Grid of agent tiles
  - Each tile shows:
    - Avatar/emoji, name, role
    - Status indicator (online/offline/busy)
    - Current task (if any)
    - Workload: X active tasks
    - Recent activity
  - Click agent → filter kanban to their tasks

#### 3.3 Activity Feed Enhancements
- [ ] Real-time updates via polling (every 10s)
- [ ] Activity types:
  - Task created
  - Task assigned
  - Task status changed
  - Comment added
  - Task completed
  - Agent joined/left
- [ ] Filters: by agent, by project, by type
- [ ] "Mark all as read" button

---

### Phase 4: Advanced Features (Week 4)
**Goal:** Dependencies, templates, time tracking, AI features

#### 4.1 Dependencies & Blocking
- [ ] Update task model with `dependsOn` and `blocks` arrays
- [ ] API:
  - `PUT /api/tasks/:id/dependencies` - Update dependencies
  - `GET /api/tasks/:id/blockers` - Get tasks blocking this one
  - `GET /api/tasks/:id/blocked` - Get tasks this one blocks

- [ ] Auto-unblock logic:
  - When task moves to "done", check `blocks` array
  - For each blocked task, remove this task from `dependsOn`
  - If blocked task has no more dependencies, notify assignee
  - Optionally auto-move to "queued"

- [ ] UI:
  - Dependency graph visualization (react-flow or similar)
  - Show blockers on task card
  - "Add dependency" button in task detail

#### 4.2 Task Templates
- [ ] Create `bridge/taskTemplates.mjs`
  - Schema:
    ```javascript
    {
      id: "new-feature",
      name: "New Feature",
      tasks: [
        {title: "Design mockup", role: "designer"},
        {title: "Implement backend", role: "backend-dev", dependsOn: ["design"]},
        {title: "Implement frontend", role: "frontend-dev", dependsOn: ["backend"]},
        {title: "Write tests", role: "qa"},
        {title: "Documentation", role: "content"}
      ]
    }
    ```

- [ ] API:
  - `GET /api/templates` - List templates
  - `POST /api/templates` - Create template
  - `POST /api/tasks/from-template` - Create tasks from template

- [ ] UI:
  - "Use template" button in new task modal
  - Template picker

#### 4.3 Time Tracking
- [ ] `claw task:start <id>` - Start timer (records timestamp)
- [ ] `claw task:stop <id>` - Stop timer (calculates hours, adds to `timeEntries`)
- [ ] `claw task:log <id> <hours>` - Manually log time

- [ ] UI:
  - Show estimated vs actual hours on task card
  - Time entries list in task detail
  - Burndown chart per project

#### 4.4 Conversational Task Creation
- [ ] API endpoint:
  - `POST /api/ai/tasks/generate` - AI breaks down user request into tasks
    ```json
    {
      "request": "Build user profiles feature",
      "projectId": "proj-123",
      "context": {...}
    }
    ```
  - Returns: `{tasks: [{title, description, role, estimatedHours}]}`

- [ ] Logic (in `bridge/aiTaskGeneration.mjs`):
  - Call OpenClaw agent with PM role
  - Provide project context (tech stack, existing features)
  - AI generates task breakdown
  - Auto-assign based on role
  - Link to project

- [ ] UI:
  - "AI Task Generator" button
  - Modal: "Describe what you want built..."
  - Shows generated tasks for review
  - "Create all" or edit individually

#### 4.5 Recurring Tasks (Routines)
- [ ] Create `bridge/routines.mjs`
  - Schema:
    ```javascript
    {
      id, name, schedule, // cron expression
      taskTemplate: {title, description, assignedTo, checklist},
      enabled, lastRun, nextRun
    }
    ```

- [ ] Routine executor (cron-based):
  - Polls routines every minute
  - Creates task from template if `nextRun` is past
  - Updates `lastRun`, calculates `nextRun`

- [ ] API:
  - `GET /api/routines` - List routines
  - `POST /api/routines` - Create routine
  - `PUT /api/routines/:id` - Update routine
  - `DELETE /api/routines/:id` - Delete routine

---

### Phase 5: Multi-Instance & Integrations (Week 5)
**Goal:** Distributed agents across machines, external integrations

#### 5.1 Multi-Instance Coordination
- [ ] Agent registration includes `instanceId` and `tailscaleIP`
- [ ] Bridge routes task notifications to correct instance
  - Check agent's `tailscaleIP`
  - POST notification to `http://{tailscaleIP}:18789/api/agents/{agentId}/notify`

- [ ] Instance discovery:
  - Each OpenClaw instance registers on startup
  - Heartbeat keeps instance alive
  - Timeout removes instance

- [ ] Load balancing:
  - When assigning tasks, prefer agents with:
    - Matching role
    - Fewest active tasks
    - Instance with available capacity

#### 5.2 GitHub Integration
- [ ] Link tasks to GitHub issues:
  - `task.githubIssue = {repo, number, url}`
  - When task created → create GitHub issue
  - When PR merged → auto-move task to done

- [ ] Commit linking:
  - Parse commit messages for task IDs: `fix: auth bug (#task-123)`
  - Link commits to tasks
  - Show commits in task detail

#### 5.3 Slack/Discord Notifications
- [ ] Config:
  ```json
  {
    "integrations": {
      "slack": {
        "webhook": "https://hooks.slack.com/...",
        "channels": {
          "task-assigned": "#dev-alerts",
          "task-completed": "#wins",
          "task-blocked": "#blockers"
        }
      }
    }
  }
  ```

- [ ] Events:
  - Task assigned → notify in channel
  - Task completed → celebrate
  - Task blocked → alert

#### 5.4 Calendar Integration
- [ ] Sync task deadlines to Google Calendar
- [ ] `claw cal:sync` - Sync all tasks with deadlines
- [ ] `claw cal:block <taskId> <hours>` - Block time on calendar

---

### Phase 6: Polish & Production (Week 6)
**Goal:** Testing, documentation, deployment

#### 6.1 Testing
- [ ] Unit tests for all stores (vitest)
- [ ] API integration tests
- [ ] E2E tests for UI (Playwright)
- [ ] Load testing (simulate 10+ agents)

#### 6.2 Documentation
- [ ] README with setup instructions
- [ ] API documentation (OpenAPI/Swagger)
- [ ] Agent setup guide
- [ ] Multi-instance setup guide
- [ ] CLI reference

#### 6.3 Deployment
- [ ] Docker Compose setup (bridge + UI)
- [ ] Systemd service files
- [ ] Backup/restore scripts
- [ ] Monitoring (health checks, logs)

---

## 🚀 Quick Wins (Do First)

These can be done in parallel to show immediate progress:

1. **Agent registration** - Get multiple agents showing in UI
2. **Task assignment via CLI** - Agents can pick up tasks
3. **Kanban board** - Visual task board
4. **Notification delivery** - Agents get notified of new tasks
5. **AI task generation** - Logan asks for feature, AI creates tasks

---

## 📝 Implementation Notes

### Data Flow Example: Logan Creates Feature

```
Logan: "Build user profiles feature for the web app"
  ↓
TARS (PM agent) receives message
  ↓
TARS calls: claw ai:generate-tasks "Build user profiles"
  ↓
CLI hits: POST /api/ai/tasks/generate
  ↓
Bridge calls OpenClaw AI with PM persona
  ↓
AI returns: [
  {title: "Design profile UI", role: "designer"},
  {title: "Build profile API", role: "backend-dev"},
  {title: "Implement profile page", role: "frontend-dev"},
  {title: "Add tests", role: "qa"},
  {title: "Update docs", role: "content"}
]
  ↓
Bridge creates 5 tasks, auto-assigns based on role
  ↓
Notifications created for each agent
  ↓
Notification worker delivers to agents
  ↓
Pixel (designer) gets notification: "New task assigned"
  ↓
On next heartbeat, Pixel runs: claw check
  ↓
Pixel sees: "Task: Design profile UI (P0)"
  ↓
Pixel: claw task:start task-123
  ↓
Pixel works, updates status when done
  ↓
Dashboard updates in real-time
```

---

## 🎯 Success Criteria

✅ **Week 1:** Multiple agents registered, tasks auto-assigned
✅ **Week 2:** Agents can work via CLI, heartbeats poll for work
✅ **Week 3:** Kanban UI shows all tasks, drag-and-drop works
✅ **Week 4:** AI generates tasks from Logan's requests
✅ **Week 5:** Multi-instance works (agents on different machines)
✅ **Week 6:** Production-ready, documented, tested

---

## 📚 Tech Stack

**Backend:**
- Node.js + Express (bridge API)
- JSON file storage (.clawhub/*.json)
- OpenClaw SDK (agent communication)

**Frontend:**
- React 18
- Vite
- Tailwind CSS
- React Router
- dnd-kit (drag-and-drop)
- react-flow (dependency graphs)

**CLI:**
- Node.js (claw command)
- Commander.js (arg parsing)
- Chalk (colors)

**Deployment:**
- Systemd (Linux services)
- Docker Compose (containerized)
- Tailscale (networking)

---

## 🎬 Let's Start!

Next steps:
1. Review this plan with Logan
2. Create feature branch: `feature/multi-agent-system`
3. Start with Phase 1.1: Agent Data Model & Store

Ready to begin?
