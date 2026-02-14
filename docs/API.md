# REST API Reference - Claw Control Center

Complete API documentation for the Claw Control Center Bridge Server.

**Base URL:** `http://localhost:8787` (default)  
**Content-Type:** `application/json`

---

## Table of Contents

1. [Authentication](#authentication)
2. [Tasks](#tasks)
3. [Agents](#agents)
4. [Instances](#instances)
5. [Notifications](#notifications)
6. [Projects](#projects)
7. [Templates](#templates)
8. [Routines](#routines)
9. [Integrations](#integrations)
10. [Error Handling](#error-handling)

---

## Authentication

### Bearer Token

All endpoints (except health) accept optional Bearer token authentication:

```bash
Authorization: Bearer YOUR_TOKEN
```

**Environment variable:**
```bash
export BRIDGE_TOKEN=your-secret-token
npm run bridge
```

**Client usage:**
```bash
curl -H "Authorization: Bearer $BRIDGE_TOKEN" \
  http://localhost:8787/api/agents
```

### Health Check (No Auth Required)

```bash
GET /health

# Response: 200 OK
# {"status": "ok", "bridge": "1.0.0"}
```

---

## Tasks

Task CRUD operations and management.

### List Tasks

```
GET /api/tasks
```

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `lane` | string | Filter by lane: queued, development, review, blocked, done |
| `priority` | string | Filter by priority: P0, P1, P2, P3 |
| `assignedTo` | string | Filter by agent ID |
| `projectId` | string | Filter by project |
| `tags` | string | Comma-separated tags to filter |
| `limit` | number | Max results (default: 100) |
| `offset` | number | Skip results (for pagination) |

**Example:**
```bash
curl "http://localhost:8787/api/tasks?lane=development&priority=P0" | jq .

# Response: 200 OK
# [
#   {
#     "id": "task-1",
#     "title": "Implement auth",
#     "lane": "development",
#     "priority": "P0",
#     "assignedTo": "dev-1",
#     "createdAt": 1707813620000,
#     "updatedAt": 1707813620000
#   }
# ]
```

---

### Get Task Details

```
GET /api/tasks/:id
```

**Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `id` | string | Task ID |

**Example:**
```bash
curl http://localhost:8787/api/tasks/task-123 | jq .

# Response: 200 OK
# {
#   "id": "task-123",
#   "title": "Implement user authentication",
#   "description": "Add OAuth2 support to API",
#   "lane": "development",
#   "priority": "P0",
#   "assignedTo": "dev-1",
#   "projectId": "proj-1",
#   "tags": ["backend", "security"],
#   "estimatedHours": 8,
#   "actualHours": 0,
#   "dependsOn": ["task-100", "task-101"],
#   "blocks": ["task-200"],
#   "statusHistory": [
#     {"at": 1707813620000, "from": "queued", "to": "development", "note": "Started work"}
#   ],
#   "comments": [
#     {"at": 1707813700000, "from": "dev-1", "text": "In progress"}
#   ],
#   "timeEntries": [],
#   "createdAt": 1707813620000,
#   "updatedAt": 1707813620000,
#   "createdBy": "pm"
# }
```

---

### Create Task

```
POST /api/tasks
```

**Request Body:**
```json
{
  "title": "Required - Task title",
  "description": "Optional - Full description",
  "priority": "P0|P1|P2|P3 (default: P2)",
  "lane": "queued|development|review|blocked|done (default: queued)",
  "assignedTo": "Optional - Agent ID",
  "projectId": "Optional - Project ID",
  "parentId": "Optional - Parent task ID (for subtasks)",
  "tags": ["Optional", "tag", "array"],
  "estimatedHours": "Optional - number",
  "dependsOn": ["task-id-1", "task-id-2"],
  "blocks": ["task-id-3"]
}
```

**Example:**
```bash
curl -X POST http://localhost:8787/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Implement user authentication",
    "description": "Add OAuth2 support to API",
    "priority": "P1",
    "projectId": "proj-1",
    "estimatedHours": 8,
    "tags": ["backend", "security"]
  }' | jq .

# Response: 201 Created
# {
#   "id": "task-789",
#   "title": "Implement user authentication",
#   "lane": "queued",
#   "priority": "P1",
#   "assignedTo": null,
#   "createdAt": 1707813620000,
#   "updatedAt": 1707813620000
# }
```

---

### Update Task

```
PUT /api/tasks/:id
```

**Request Body:** (all fields optional)
```json
{
  "title": "Updated title",
  "description": "Updated description",
  "priority": "P0",
  "lane": "review",
  "assignedTo": "dev-2",
  "tags": ["updated"],
  "estimatedHours": 10
}
```

**Example:**
```bash
curl -X PUT http://localhost:8787/api/tasks/task-123 \
  -H "Content-Type: application/json" \
  -d '{
    "lane": "development",
    "assignedTo": "dev-1"
  }' | jq .

# Response: 200 OK
# {"id": "task-123", "lane": "development", "assignedTo": "dev-1", ...}
```

---

### Delete Task

```
DELETE /api/tasks/:id
```

**Example:**
```bash
curl -X DELETE http://localhost:8787/api/tasks/task-123

# Response: 204 No Content
```

---

### Auto-Assign Task

Analyze task and assign to best matching agent.

```
POST /api/tasks/:id/auto-assign
```

**Response:**
```json
{
  "id": "task-123",
  "assignedTo": "dev-1",
  "reason": "Matched 'backend-dev' role, lowest workload"
}
```

**Example:**
```bash
curl -X POST http://localhost:8787/api/tasks/task-123/auto-assign | jq .

# Response: 200 OK
# {
#   "id": "task-123",
#   "assignedTo": "dev-1",
#   "reason": "Matched 'backend-dev' role, lowest workload"
# }
```

---

### Add Task Comment

```
POST /api/tasks/:id/comment
```

**Request Body:**
```json
{
  "text": "Required - Comment text"
}
```

**Example:**
```bash
curl -X POST http://localhost:8787/api/tasks/task-123/comment \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Fixed the authentication issue"
  }' | jq .

# Response: 200 OK
# {
#   "id": "comment-456",
#   "text": "Fixed the authentication issue",
#   "from": "dev-1",
#   "at": 1707813900000
# }
```

---

### Log Time Entry

```
POST /api/tasks/:id/time
```

**Request Body:**
```json
{
  "hours": "Required - number",
  "note": "Optional - what was done"
}
```

**Example:**
```bash
curl -X POST http://localhost:8787/api/tasks/task-123/time \
  -H "Content-Type: application/json" \
  -d '{
    "hours": 4,
    "note": "Implemented OAuth2 flow"
  }' | jq .

# Response: 200 OK
# {
#   "entryId": "time-789",
#   "hours": 4,
#   "totalHours": 4
# }
```

---

### Update Dependencies

```
PUT /api/tasks/:id/dependencies
```

**Request Body:**
```json
{
  "dependsOn": ["task-100", "task-101"],
  "blocks": ["task-200"]
}
```

**Example:**
```bash
curl -X PUT http://localhost:8787/api/tasks/task-123/dependencies \
  -H "Content-Type: application/json" \
  -d '{
    "dependsOn": ["task-100"]
  }' | jq .

# Response: 200 OK
# {
#   "id": "task-123",
#   "dependsOn": ["task-100"],
#   "blocks": ["task-200"]
# }
```

---

### Get Task Context

Full context for task execution including related tasks, rules, etc.

```
GET /api/tasks/:id/context
```

**Response:**
```json
{
  "task": {...},
  "project": {...},
  "projectRules": [...],
  "dependencies": [...],
  "blocks": [...],
  "comments": [...],
  "timeEntries": [...],
  "relatedTasks": [...]
}
```

**Example:**
```bash
curl http://localhost:8787/api/tasks/task-123/context | jq .

# Response: 200 OK
# {
#   "task": {...},
#   "project": {"id": "proj-1", "name": "Web App", ...},
#   "dependencies": [{"id": "task-100", "status": "done"}],
#   ...
# }
```

---

## Agents

Agent registration and status management.

### List Agents

```
GET /api/agents
```

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `status` | string | Filter: online, offline, busy |
| `roles` | string | Comma-separated roles to filter |
| `instanceId` | string | Filter by instance |

**Example:**
```bash
curl http://localhost:8787/api/agents | jq .

# Response: 200 OK
# [
#   {
#     "id": "dev-1",
#     "name": "Backend Developer",
#     "emoji": "🔧",
#     "roles": ["backend-dev", "api"],
#     "status": "online",
#     "instanceId": "openclaw-macbook",
#     "tailscaleIP": "100.0.0.1",
#     "activeTasks": ["task-123", "task-456"],
#     "lastHeartbeat": 1707813900000,
#     "createdAt": 1707813620000
#   }
# ]
```

---

### Get Agent Details

```
GET /api/agents/:id
```

**Example:**
```bash
curl http://localhost:8787/api/agents/dev-1 | jq .

# Response: 200 OK
# {
#   "id": "dev-1",
#   "name": "Backend Developer",
#   "emoji": "🔧",
#   "roles": ["backend-dev", "api"],
#   "status": "online",
#   "instanceId": "openclaw-macbook",
#   "tailscaleIP": "100.0.0.1",
#   "activeTasks": ["task-123"],
#   "completedCount": 24,
#   "lastHeartbeat": 1707813900000,
#   "createdAt": 1707813620000
# }
```

---

### Register Agent

```
POST /api/agents/register
```

**Request Body:**
```json
{
  "id": "Required - Unique agent ID",
  "name": "Optional - Display name",
  "emoji": "Optional - Avatar emoji",
  "roles": ["Required - Array of roles"],
  "model": "Optional - AI model (default: haiku)",
  "workspace": "Optional - Workspace path",
  "instanceId": "Optional - Instance ID"
}
```

**Example:**
```bash
curl -X POST http://localhost:8787/api/agents/register \
  -H "Content-Type: application/json" \
  -d '{
    "id": "dev-1",
    "name": "Backend Developer",
    "emoji": "🔧",
    "roles": ["backend-dev", "api"]
  }' | jq .

# Response: 201 Created
# {
#   "id": "dev-1",
#   "status": "online",
#   "createdAt": 1707813620000
# }
```

---

### Update Agent Status

```
PUT /api/agents/:id/status
```

**Request Body:**
```json
{
  "status": "online|offline|busy",
  "lastHeartbeat": "Optional - timestamp"
}
```

**Example:**
```bash
curl -X PUT http://localhost:8787/api/agents/dev-1/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "busy",
    "lastHeartbeat": 1707813900000
  }' | jq .

# Response: 200 OK
```

---

### Get Agent's Tasks

```
GET /api/agents/:id/tasks
```

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `status` | string | Filter by lane: queued, development, done |
| `limit` | number | Max results (default: 50) |

**Example:**
```bash
curl "http://localhost:8787/api/agents/dev-1/tasks?status=development" | jq .

# Response: 200 OK
# [
#   {"id": "task-123", "title": "...", "lane": "development"},
#   {"id": "task-456", "title": "...", "lane": "development"}
# ]
```

---

### Get Agent Notifications

```
GET /api/agents/:id/notifications
```

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `unread` | boolean | Filter unread only |
| `limit` | number | Max results |

**Example:**
```bash
curl "http://localhost:8787/api/agents/dev-1/notifications" | jq .

# Response: 200 OK
# [
#   {
#     "id": "notif-789",
#     "type": "task-assigned",
#     "title": "New task assigned",
#     "taskId": "task-123",
#     "read": false,
#     "createdAt": 1707813900000
#   }
# ]
```

---

## Instances

Multi-instance tracking and health monitoring.

### List Instances

```
GET /api/instances
```

**Response:**
```json
[
  {
    "instanceId": "openclaw-macbook",
    "hostname": "macbook.local",
    "status": "online|offline",
    "agentCount": 5,
    "taskCount": 12,
    "lastHeartbeat": 1707813900000
  }
]
```

**Example:**
```bash
curl http://localhost:8787/api/instances | jq .

# Response: 200 OK
# [
#   {
#     "instanceId": "openclaw-macbook",
#     "status": "online",
#     "agentCount": 5,
#     "taskCount": 12
#   },
#   {
#     "instanceId": "openclaw-server",
#     "status": "offline",
#     "agentCount": 3,
#     "taskCount": 0
#   }
# ]
```

---

### Get Instance Statistics

```
GET /api/instances/stats
```

**Response:**
```json
{
  "totalInstances": 2,
  "onlineInstances": 1,
  "offlineInstances": 1,
  "totalAgents": 8,
  "totalTasks": 12,
  "avgTasksPerInstance": 6,
  "avgTaskDuration": 120
}
```

**Example:**
```bash
curl http://localhost:8787/api/instances/stats | jq .
```

---

### Get Instance Capacities

```
GET /api/instances/capacities
```

**Response:**
```json
[
  {
    "instanceId": "openclaw-macbook",
    "agentCount": 5,
    "maxCapacity": 10,
    "currentLoad": 7,
    "availableCapacity": 3,
    "healthScore": 85
  }
]
```

**Example:**
```bash
curl http://localhost:8787/api/instances/capacities | jq .

# Response: 200 OK
# [
#   {
#     "instanceId": "openclaw-macbook",
#     "currentLoad": 7,
#     "availableCapacity": 3,
#     "healthScore": 85
#   }
# ]
```

---

## Notifications

Notification delivery and management.

### Create Notification

```
POST /api/notifications
```

**Request Body:**
```json
{
  "agentId": "Required - Target agent",
  "type": "task-assigned|task-completed|task-blocked|...",
  "title": "Required - Notification title",
  "text": "Optional - Details",
  "taskId": "Optional - Related task",
  "projectId": "Optional - Related project",
  "actionUrl": "Optional - Link to action"
}
```

**Example:**
```bash
curl -X POST http://localhost:8787/api/notifications \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "dev-1",
    "type": "task-assigned",
    "title": "New task assigned",
    "taskId": "task-123"
  }' | jq .

# Response: 201 Created
# {
#   "id": "notif-789",
#   "agentId": "dev-1",
#   "type": "task-assigned",
#   "read": false,
#   "createdAt": 1707813900000
# }
```

---

### Mark Notification as Read

```
PUT /api/notifications/:id/read
```

**Example:**
```bash
curl -X PUT http://localhost:8787/api/notifications/notif-789/read

# Response: 200 OK
```

---

### Delete Notification

```
DELETE /api/notifications/:id
```

**Example:**
```bash
curl -X DELETE http://localhost:8787/api/notifications/notif-789

# Response: 204 No Content
```

---

## Projects

Project management and organization.

### List Projects

```
GET /api/projects
```

**Example:**
```bash
curl http://localhost:8787/api/projects | jq .

# Response: 200 OK
# [
#   {
#     "id": "proj-1",
#     "name": "Web Dashboard",
#     "description": "Main web application",
#     "status": "active",
#     "taskCount": 23,
#     "completedCount": 8
#   }
# ]
```

---

### Create Project

```
POST /api/projects
```

**Request Body:**
```json
{
  "name": "Required - Project name",
  "description": "Optional - Project description",
  "rules": ["Optional", "rules"],
  "members": ["agent-id-1", "agent-id-2"]
}
```

**Example:**
```bash
curl -X POST http://localhost:8787/api/projects \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Web Dashboard",
    "description": "Main web application",
    "members": ["dev-1", "dev-2", "pixel"]
  }' | jq .

# Response: 201 Created
# {
#   "id": "proj-2",
#   "name": "Web Dashboard",
#   "createdAt": 1707813900000
# }
```

---

### Get Project Details

```
GET /api/projects/:id
```

**Example:**
```bash
curl http://localhost:8787/api/projects/proj-1 | jq .

# Response: 200 OK
# {
#   "id": "proj-1",
#   "name": "Web Dashboard",
#   "taskCount": 23,
#   "tasks": [...]
# }
```

---

## Templates

Task templates for consistent workflows.

### List Templates

```
GET /api/templates
```

**Example:**
```bash
curl http://localhost:8787/api/templates | jq .

# Response: 200 OK
# [
#   {
#     "id": "new-feature",
#     "name": "New Feature Workflow",
#     "description": "Standard feature implementation",
#     "taskCount": 5
#   }
# ]
```

---

### Create Task from Template

```
POST /api/tasks/from-template
```

**Request Body:**
```json
{
  "templateId": "Required - Template ID",
  "projectId": "Optional - Project ID",
  "overrides": {
    "title": "Optional - Override template title",
    "assignedTo": "Optional - Override assignee"
  }
}
```

**Example:**
```bash
curl -X POST http://localhost:8787/api/tasks/from-template \
  -H "Content-Type: application/json" \
  -d '{
    "templateId": "new-feature",
    "projectId": "proj-1",
    "overrides": {"title": "Implement user profiles"}
  }' | jq .

# Response: 201 Created
# [
#   {"id": "task-1", "title": "Design user profile UI", ...},
#   {"id": "task-2", "title": "Build profile API", ...},
#   {"id": "task-3", "title": "Implement profile page", ...}
# ]
```

---

## Routines

Recurring tasks and automation.

### List Routines

```
GET /api/routines
```

**Example:**
```bash
curl http://localhost:8787/api/routines | jq .

# Response: 200 OK
# [
#   {
#     "id": "daily-standup",
#     "name": "Daily Standup",
#     "schedule": "0 9 * * 1-5",
#     "enabled": true
#   }
# ]
```

---

### Create Routine

```
POST /api/routines
```

**Request Body:**
```json
{
  "name": "Required - Routine name",
  "schedule": "Required - Cron expression",
  "taskTemplate": {
    "title": "Task title",
    "description": "Task description",
    "assignedTo": "Agent ID"
  },
  "enabled": true
}
```

**Example:**
```bash
curl -X POST http://localhost:8787/api/routines \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Daily Standup",
    "schedule": "0 9 * * 1-5",
    "taskTemplate": {
      "title": "Team Standup",
      "assignedTo": "pm"
    }
  }' | jq .

# Response: 201 Created
# {
#   "id": "routine-1",
#   "name": "Daily Standup",
#   "nextRun": 1707900000000
# }
```

---

## Integrations

External service integrations.

### Configure GitHub Integration

```
POST /api/integrations/github/configure
```

**Request Body:**
```json
{
  "token": "Required - GitHub PAT",
  "repo": "Required - owner/repo",
  "autoLink": true,
  "autoClose": true
}
```

**Example:**
```bash
curl -X POST http://localhost:8787/api/integrations/github/configure \
  -H "Content-Type: application/json" \
  -d '{
    "token": "ghp_...",
    "repo": "myorg/myrepo",
    "autoLink": true
  }' | jq .

# Response: 200 OK
# {
#   "status": "configured",
#   "repo": "myorg/myrepo"
# }
```

---

### Configure Telegram Integration

```
POST /api/integrations/telegram/configure
```

**Request Body:**
```json
{
  "botToken": "Required - Telegram bot token",
  "chatId": "Required - Chat or channel ID",
  "enabled": true
}
```

**Example:**
```bash
curl -X POST http://localhost:8787/api/integrations/telegram/configure \
  -H "Content-Type: application/json" \
  -d '{
    "botToken": "123456:ABC...",
    "chatId": "-1001234567890",
    "enabled": true
  }' | jq .

# Response: 200 OK
```

---

### Configure Google Calendar Integration

```
POST /api/integrations/calendar/configure
```

**Request Body:**
```json
{
  "credentialsPath": "Required - Path to OAuth credentials JSON",
  "calendarId": "primary|your-calendar@gmail.com",
  "enabled": true
}
```

**Example:**
```bash
curl -X POST http://localhost:8787/api/integrations/calendar/configure \
  -H "Content-Type: application/json" \
  -d '{
    "credentialsPath": "/path/to/credentials.json",
    "calendarId": "primary",
    "enabled": true
  }' | jq .

# Response: 200 OK
```

---

## Error Handling

### Common HTTP Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | OK | Request successful |
| 201 | Created | Resource created |
| 204 | No Content | Successful deletion |
| 400 | Bad Request | Missing required field |
| 404 | Not Found | Task not found |
| 409 | Conflict | Task already exists |
| 500 | Server Error | Bridge crashed |

---

### Error Response Format

All errors return JSON with consistent format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "error details"
  }
}
```

**Example:**
```bash
curl http://localhost:8787/api/tasks/invalid-id

# Response: 404 Not Found
# {
#   "error": "Task not found",
#   "code": "TASK_NOT_FOUND",
#   "id": "invalid-id"
# }
```

---

### Common Errors

**Missing Required Field:**
```json
{
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": {
    "title": "Title is required"
  }
}
```

**Agent Not Found:**
```json
{
  "error": "Agent not found",
  "code": "AGENT_NOT_FOUND",
  "id": "unknown-agent"
}
```

**Blocked by Dependencies:**
```json
{
  "error": "Task is blocked",
  "code": "TASK_BLOCKED",
  "blockers": ["task-100", "task-101"]
}
```

---

## Rate Limiting

Currently no rate limiting. For production deployment, consider:

```bash
# Recommended: 1000 requests/minute per IP
# Set via reverse proxy (nginx, etc.)
```

---

## Example Workflows

### Workflow 1: Create and Assign Task

```bash
# 1. Create task
TASK_ID=$(curl -s -X POST http://localhost:8787/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title": "Implement auth"}' | jq -r '.id')

# 2. Auto-assign to best agent
curl -X POST http://localhost:8787/api/tasks/$TASK_ID/auto-assign

# 3. Verify assignment
curl http://localhost:8787/api/tasks/$TASK_ID | jq '.assignedTo'
```

### Workflow 2: Check Agent Notifications

```bash
# 1. Get agent
AGENT_ID="dev-1"

# 2. Get unread notifications
curl http://localhost:8787/api/agents/$AGENT_ID/notifications | \
  jq '.[] | select(.read == false)'

# 3. Mark as read
NOTIF_ID="notif-789"
curl -X PUT http://localhost:8787/api/notifications/$NOTIF_ID/read
```

### Workflow 3: Complete Task with Time Tracking

```bash
# 1. Get task
TASK_ID="task-123"

# 2. Log time spent
curl -X POST http://localhost:8787/api/tasks/$TASK_ID/time \
  -H "Content-Type: application/json" \
  -d '{"hours": 4, "note": "Completed auth endpoints"}'

# 3. Move to review
curl -X PUT http://localhost:8787/api/tasks/$TASK_ID \
  -H "Content-Type: application/json" \
  -d '{"lane": "review"}'

# 4. Add completion comment
curl -X POST http://localhost:8787/api/tasks/$TASK_ID/comment \
  -H "Content-Type: application/json" \
  -d '{"text": "Ready for code review"}'
```

---

**Last updated:** 2026-02-14

For questions or issues, see [docs/TROUBLESHOOTING.md](TROUBLESHOOTING.md)
