# API Reference

Base URL: `http://localhost:8787`

All endpoints return JSON. Request bodies use `Content-Type: application/json`.

---

## System

### `GET /api/status`
Health check and system info.

### `GET /api/live`
Live snapshot of all data (tasks, agents, activity) for initial UI load.

### `GET /health`
Docker health check endpoint.

---

## Tasks

### `GET /api/tasks`
List all tasks.

**Query params:**
- `lane` — Filter by lane (`proposed`, `queued`, `development`, `review`, `done`, `blocked`)
- `owner` — Filter by agent ID

### `POST /api/tasks`
Create a task. If `lane` is `queued` and `owner` matches a known agent, the TaskRouter will auto-claim and spawn a sub-agent.

**Body:**
```json
{
  "title": "Implement feature X",
  "lane": "queued",
  "priority": "P0",
  "owner": "forge",
  "problem": "Description of the problem",
  "scope": "What needs to be done",
  "acceptanceCriteria": "How to verify it's done",
  "tags": ["backend", "Epic"]
}
```

### `PUT /api/tasks/:id`
Update a task. Used by sub-agents to move tasks between lanes.

**Body:** Any subset of task fields:
```json
{
  "lane": "review",
  "title": "Updated title"
}
```

### `DELETE /api/tasks/:id`
Delete a task.

### `POST /api/tasks/:id/comment`
Add a comment to a task.

**Body:**
```json
{
  "text": "Comment text",
  "author": "forge"
}
```

### `POST /api/tasks/:id/assign`
Assign a task to an agent.

**Body:**
```json
{
  "owner": "forge"
}
```

### `POST /api/tasks/:id/auto-assign`
Auto-assign a task based on its tags using the tag-to-agent map.

### `POST /api/tasks/:id/complete`
Mark a task as complete (moves to `done` lane).

### `POST /api/tasks/:id/time`
Log time spent on a task.

### `GET /api/tasks/:id/time`
Get time entries for a task.

### `GET /api/tasks/:id/context`
Get task context (related tasks, blockers, comments).

### `PUT /api/tasks/:id/dependencies`
Update task dependencies.

### `GET /api/tasks/:id/blockers`
Get blockers for a task.

### `GET /api/tasks/:id/blocked`
Get tasks blocked by this task.

---

## Agents (Sub-Agent System)

### `GET /api/agents/status`
**Primary endpoint for UI.** Returns all agents with live sub-agent status.

**Response:**
```json
{
  "agents": [
    {
      "id": "forge",
      "name": "Forge",
      "role": "Dev",
      "emoji": "🔨",
      "status": "active",
      "currentTask": {
        "id": "task-abc123",
        "title": "Implement feature X",
        "priority": "P1",
        "tag": "backend",
        "startedAt": 1708012345000,
        "runningFor": 34000,
        "sessionKey": "agent:main:subagent:uuid",
        "tokenUsage": null
      }
    },
    {
      "id": "patch",
      "name": "Patch",
      "role": "Dev",
      "emoji": "🌟",
      "status": "idle",
      "currentTask": null
    }
  ]
}
```

### `GET /api/agents/active`
Returns only agents currently working on tasks.

### `GET /api/agents/:id/history`
Spawn history for a specific agent (from SubAgentRegistry).

### `GET /api/agents`
List all registered agents (legacy endpoint, includes heartbeat data).

### `GET /api/agents/:id`
Get a single agent by ID.

### `POST /api/agents/register`
Register a new agent.

### `POST /api/agents/:id/heartbeat`
Update agent heartbeat (legacy — sub-agent system uses SubAgentTracker instead).

### `PUT /api/agents/:id/status`
Update agent status manually.

### `GET /api/agents/:id/tasks`
Get tasks assigned to an agent.

### `GET /api/agents/:id/notifications`
Get notifications for an agent.

---

## Activity

### `GET /api/activity`
Recent activity events.

**Query params:**
- `limit` — Number of events (default 50)

Events include task creation, lane changes, agent spawns, completions, and failures.

**WebSocket:** Connect to `ws://localhost:8787` for real-time activity events.

---

## Projects

### `GET /api/projects`
### `POST /api/projects`
### `GET /api/projects/:id`
### `PUT /api/projects/:id`
### `DELETE /api/projects/:id`

CRUD for projects.

---

## PM Projects (Full Project Management)

### `GET /api/pm/projects`
### `POST /api/pm/projects`
### `GET /api/pm/projects/:id`
### `PUT /api/pm/projects/:id`
### `DELETE /api/pm/projects/:id`
### `GET /api/pm/projects/:id/export.json`
### `GET /api/pm/projects/:id/export.md`
### `GET /api/pm/projects/:id/tree`
### `POST /api/pm/projects/:id/tree/nodes`

Full project management with tree structure, exports, and node management.

---

## Intakes

### `GET /api/intakes`
### `GET /api/intakes/:id`
### `POST /api/intakes`
### `PUT /api/intakes/:id`
### `DELETE /api/intakes/:id`
### `POST /api/analyze-intake`

Intake channel system for feeding data into the task pipeline.

---

## Intake Projects

### `GET /api/intake/projects`
### `GET /api/intake/projects/:id`
### `POST /api/intake/projects`
### `PUT /api/intake/projects/:id`
### `POST /api/intake/projects/:id/generate-questions`
### `POST /api/intake/projects/:id/generate-scope`
### `GET /api/intake/projects/:id/export.md`

Project intake with AI-powered question generation and scope creation.

---

## Templates

### `GET /api/templates`
### `GET /api/templates/:id`
### `POST /api/templates`
### `PUT /api/templates/:id`
### `DELETE /api/templates/:id`
### `POST /api/tasks/from-template`

Task templates for repeatable workflows.

---

## Routines

### `GET /api/routines`
### `GET /api/routines/:id`
### `POST /api/routines`
### `PUT /api/routines/:id`
### `DELETE /api/routines/:id`
### `POST /api/routines/:id/run`

Recurring task routines.

---

## Rules

### `GET /api/rules`
### `POST /api/rules`
### `PUT /api/rules/:id`
### `DELETE /api/rules/:id`
### `POST /api/rules/:id/toggle`
### `GET /api/rules/history`

PM rules engine for automated task management.

---

## Notifications

### `GET /api/notifications`
### `PUT /api/notifications/:id/read`
### `DELETE /api/notifications/:id`

---

## AI

### `POST /api/ai/tasks/generate`
Generate tasks from a description using AI.

**Body:**
```json
{
  "prompt": "Build a user authentication system",
  "projectId": "optional-project-id"
}
```

---

## Integrations

### GitHub
- `POST /api/tasks/:id/github` — Create GitHub issue from task
- `GET /api/tasks/:id/commits` — Get linked commits
- `POST /api/tasks/:id/link-commit` — Link a commit to a task
- `POST /api/github/webhook` — GitHub webhook receiver

### Calendar
- `POST /api/calendar/sync` — Sync tasks with calendar
- `POST /api/tasks/:id/calendar` — Add task to calendar
- `POST /api/tasks/:id/calendar/block` — Block time for task
- `DELETE /api/tasks/:id/calendar` — Remove from calendar
- `POST /api/calendar/setup` — Configure calendar integration

### Telegram
- `POST /api/integrations/telegram/notify` — Send Telegram notification

---

## Models

### `GET /api/models`
List available AI models.

### `POST /api/models/set`
Set the active model.

---

## Workers (Legacy)

### `GET /api/workers`
Legacy worker status endpoint. Use `GET /api/agents/status` instead.

### `GET /api/blockers`
List all blocked tasks and their blockers.

---

## Aspects

### `GET /api/aspects`
### `POST /api/aspects`
### `GET /api/aspects/:id`
### `PUT /api/aspects/:id`
### `DELETE /api/aspects/:id`

Project aspects/categories.
