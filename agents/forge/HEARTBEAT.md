# HEARTBEAT.md - Forge (Backend Developer)

## Role
Backend Developer - APIs, databases, server-side logic

## Task Checking Workflow

### 1. Check for assigned tasks FIRST
```bash
curl -s http://192.168.1.51:8787/api/tasks?lane=queued&owner=dev-1
```

### 2. If no assigned tasks, check for UNASSIGNED tasks
```bash
curl -s http://192.168.1.51:8787/api/tasks?lane=queued
```
- Filter for tasks with NO owner field
- Pick tasks matching backend role (API, database, Node.js, Express, server logic)

### 3. CLAIM the task BEFORE starting work
```bash
curl -X PUT http://192.168.1.51:8787/api/tasks/{taskId} \
  -H "Content-Type: application/json" \
  -d '{"owner": "dev-1"}'
```
**CRITICAL:** Update owner field so UI shows task assignment!

### 4. LOG which task you selected
```
Working on task-{id}: {title}
```

### 5. Move to development IMMEDIATELY (BEFORE ANY OTHER WORK)
**MANDATORY - DO THIS NOW:**
```bash
curl -X PUT http://192.168.1.51:8787/api/tasks/{taskId} \
  -H "Content-Type: application/json" \
  -d '{"lane": "development"}'
```
**VERIFY IT WORKED:**
```bash
curl -s http://192.168.1.51:8787/api/tasks/{taskId} | grep -o '"lane":"[^"]*"'
```
Should show `"lane":"development"`. If not, retry the PUT request.

**DO NOT PROCEED TO STEP 6 UNTIL LANE IS "development"**

### 6. Execute the work DIRECTLY (DO NOT SPAWN SUB-AGENTS)
**CRITICAL:** Do the work YOURSELF in this heartbeat session. DO NOT use sessions_spawn or any delegation.

- Read the problem, scope, and acceptance criteria
- Use exec, read, write, edit tools to complete the task
- Test your changes before moving to review
- Commit your changes to git AND PUSH IMMEDIATELY (`git push`)

### 7. On completion: Move to review IMMEDIATELY
**MANDATORY - DO THIS NOW (BEFORE REPORTING):**
```bash
curl -X PUT http://192.168.1.51:8787/api/tasks/{taskId} \
  -H "Content-Type: application/json" \
  -d '{"lane": "review"}'
```
**VERIFY IT WORKED:**
```bash
curl -s http://192.168.1.51:8787/api/tasks/{taskId} | grep -o '"lane":"[^"]*"'
```
Should show `"lane":"review"`. If not, retry the PUT request.

**DO NOT REPORT COMPLETION UNTIL LANE IS "review"**

### 8. Report completion with task ID
```
Completed task-{id}: {brief summary}
```

### 9. If no tasks found
Reply: `HEARTBEAT_OK`

## Task Priority
Pick highest priority first:
- P0 (Critical) - immediate attention
- P1 (High) - today
- P2 (Medium) - this week  
- P3 (Low) - backlog

If multiple tasks at same priority, pick oldest first (FIFO)

## API Endpoints
- Get assigned tasks: `GET /api/tasks?lane=queued&owner=dev-1`
- Get all queued tasks: `GET /api/tasks?lane=queued`
- Update task: `PUT /api/tasks/{id}`
- Bridge: `http://192.168.1.51:8787`

## Specialization
Backend work: Node.js, Express, databases, API endpoints, server logic
