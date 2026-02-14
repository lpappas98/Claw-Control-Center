# API Endpoint Test Specifications

## Overview

The Bridge API provides 16+ endpoints for the multi-agent system. Tests can be validated using:
- `curl` commands
- Postman collection
- Node.js fetch API
- Browser fetch API

## Starting the Bridge Server

```bash
npm run bridge
```

The server starts on port 8787 (default) or `$PORT` environment variable.

## Agent Endpoints

### 1. POST /api/agents/register
**Register or update an agent**

```bash
curl -X POST http://localhost:8787/api/agents/register \
  -H "Content-Type: application/json" \
  -d '{
    "id": "dev-agent-1",
    "name": "Backend Developer",
    "emoji": "🔧",
    "roles": ["backend-dev", "api"],
    "model": "anthropic/claude-haiku",
    "workspace": "/home/user/.openclaw/workspace",
    "status": "online",
    "instanceId": "inst-123",
    "tailscaleIP": "100.0.0.1"
  }'
```

**Expected Response**: Agent object with createdAt/updatedAt timestamps

### 2. GET /api/agents
**List all agents**

```bash
curl http://localhost:8787/api/agents
```

**Expected Response**: Array of agent objects

### 3. GET /api/agents/:id
**Get specific agent**

```bash
curl http://localhost:8787/api/agents/dev-agent-1
```

**Expected Response**: Single agent object or 404

### 4. PUT /api/agents/:id/status
**Update agent status**

```bash
curl -X PUT http://localhost:8787/api/agents/dev-agent-1/status \
  -H "Content-Type: application/json" \
  -d '{"status": "busy", "currentTask": "task-123"}'
```

**Expected Response**: Updated agent object

### 5. GET /api/agents/:id/tasks
**Get agent's assigned tasks**

```bash
curl http://localhost:8787/api/agents/dev-agent-1/tasks
```

**Expected Response**: Array of task objects assigned to agent

### 6. GET /api/agents/:id/notifications
**Get agent's notifications**

```bash
curl "http://localhost:8787/api/agents/dev-agent-1/notifications?unread=true"
```

**Parameters**: 
- `unread` (optional): filter to unread only

**Expected Response**: Array of notification objects

## Task Endpoints

### 7. POST /api/tasks
**Create a new task**

```bash
curl -X POST http://localhost:8787/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Implement login form",
    "description": "Build React component for user authentication",
    "lane": "queued",
    "priority": "P1",
    "tags": ["frontend", "ui"],
    "estimatedHours": 5
  }'
```

**Expected Response**: Task object with generated ID

### 8. GET /api/tasks
**List all tasks with optional filtering**

```bash
curl "http://localhost:8787/api/tasks?lane=development&priority=P0"
```

**Query Parameters**:
- `lane`: filter by lane (queued, development, review, blocked, done)
- `priority`: filter by priority (P0, P1, P2, P3)
- `assignedTo`: filter by agent ID

**Expected Response**: Array of task objects

### 9. GET /api/tasks/:id
**Get specific task**

```bash
curl http://localhost:8787/api/tasks/task-abc123
```

**Expected Response**: Single task object or 404

### 10. PUT /api/tasks/:id
**Update task**

```bash
curl -X PUT http://localhost:8787/api/tasks/task-abc123 \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated title",
    "lane": "development",
    "priority": "P0",
    "updatedBy": "user-1"
  }'
```

**Expected Response**: Updated task object with status history

### 11. POST /api/tasks/:id/assign
**Manually assign task to agent**

```bash
curl -X POST http://localhost:8787/api/tasks/task-abc123/assign \
  -H "Content-Type: application/json" \
  -d '{"agentId": "dev-agent-1", "assignedBy": "user-1"}'
```

**Expected Response**: Updated task with assignedTo field

### 12. POST /api/tasks/:id/auto-assign
**Auto-assign task based on role matching**

```bash
curl -X POST http://localhost:8787/api/tasks/task-abc123/auto-assign
```

**Expected Response**:
```json
{
  "assigned": true,
  "agent": "dev-agent-1",
  "roles": ["backend-dev", "api"]
}
```

### 13. POST /api/tasks/:id/comment
**Add comment to task**

```bash
curl -X POST http://localhost:8787/api/tasks/task-abc123/comment \
  -H "Content-Type: application/json" \
  -d '{"text": "Great implementation!", "by": "reviewer-1"}'
```

**Expected Response**: Updated task with new comment

### 14. POST /api/tasks/:id/time
**Log time entry**

```bash
curl -X POST http://localhost:8787/api/tasks/task-abc123/time \
  -H "Content-Type: application/json" \
  -d '{"agentId": "dev-agent-1", "hours": 2.5}'
```

**Expected Response**: Updated task with accumulated actualHours

### 15. PUT /api/tasks/:id/dependencies
**Update task dependencies**

```bash
curl -X PUT http://localhost:8787/api/tasks/task-abc123/dependencies \
  -H "Content-Type: application/json" \
  -d '{"dependsOn": ["task-dep1", "task-dep2"], "updatedBy": "user-1"}'
```

**Expected Response**: Updated task with new dependencies

### 16. POST /api/tasks/:id/complete
**Mark task complete and unblock dependent tasks**

```bash
curl -X POST http://localhost:8787/api/tasks/task-abc123/complete \
  -H "Content-Type: application/json" \
  -d '{"completedBy": "user-1"}'
```

**Expected Response**:
```json
{
  "task": {...},
  "unblocked": [...]
}
```

## Notification Endpoints

### 17. POST /api/notifications
**Create notification**

```bash
curl -X POST http://localhost:8787/api/notifications \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "dev-agent-1",
    "type": "task-assigned",
    "title": "New task assigned",
    "text": "You have been assigned a new task",
    "taskId": "task-abc123"
  }'
```

**Expected Response**: Notification object

### 18. PUT /api/notifications/:id/read
**Mark notification as read**

```bash
curl -X PUT http://localhost:8787/api/notifications/notif-abc123/read
```

**Expected Response**: Updated notification with read=true

### 19. DELETE /api/notifications/:id
**Delete notification**

```bash
curl -X DELETE http://localhost:8787/api/notifications/notif-abc123
```

**Expected Response**: `{"deleted": true}`

## Integration Test Workflows

### Workflow 1: Register Agent → Create Task → Auto-Assign → Notification

1. Register agent with roles
2. Create task matching agent's role
3. Call auto-assign endpoint
4. Verify task is assigned
5. Verify notification created
6. Verify agent's activeTasks updated

### Workflow 2: Task Blocking and Unblocking

1. Create task A (blocking)
2. Create task B (blocked by A)
3. Update task A to mark it blocks B
4. Complete task A
5. Verify task B moves to queued
6. Verify notification sent

### Workflow 3: Task Dependencies

1. Create task A
2. Create task B depending on A
3. Create task C depending on both A and B
4. Add comment to task B
5. Log time on task B
6. Complete task A
7. Verify B dependencies updated
8. Complete task B
9. Verify C unblocked

## Error Scenarios

### 404 Not Found
- GET /api/agents/nonexistent
- GET /api/tasks/nonexistent
- GET /api/notifications/nonexistent

### 400 Bad Request
- POST /api/agents/register without required fields
- POST /api/tasks/assign without agentId
- PUT /api/agents/:id/status without status

## Data Persistence

All changes are persisted to JSON files:
- Agents: `.clawhub/agents.json`
- Tasks: `.clawhub/tasks.json`
- Notifications: `.clawhub/notifications.json`

## Testing with curl + jq

Extract field from response:
```bash
curl http://localhost:8787/api/agents | jq '.[0].id'
```

Create and store ID:
```bash
AGENT_ID=$(curl -s -X POST http://localhost:8787/api/agents/register \
  -H "Content-Type: application/json" \
  -d '{"id":"test","name":"Test",...}' | jq -r '.id')
```

## Performance Benchmarks

Expected response times (on typical hardware):
- GET endpoints: < 50ms
- POST/PUT endpoints: < 100ms
- Auto-assign with role matching: < 200ms

## Testing Checklist

- [ ] All agents endpoints work
- [ ] All tasks endpoints work
- [ ] All notifications endpoints work
- [ ] Filtering works correctly
- [ ] Auto-assignment matches roles
- [ ] Blocking/unblocking works
- [ ] Dependencies tracked correctly
- [ ] Time tracking accumulates
- [ ] Notifications created on events
- [ ] 404 errors returned for missing resources
- [ ] 400 errors for invalid requests
- [ ] Data persists across restarts
