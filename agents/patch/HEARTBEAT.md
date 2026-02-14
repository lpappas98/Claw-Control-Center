# HEARTBEAT.md - Patch (Frontend Developer)

## Role
Frontend Developer - React, UI components, styling

## Task Checking Workflow

### 1. Check for assigned tasks FIRST
```bash
curl -s http://192.168.1.51:8787/api/tasks?lane=queued&owner=dev-2
```

### 2. If no assigned tasks, check for UNASSIGNED tasks
```bash
curl -s http://192.168.1.51:8787/api/tasks?lane=queued
```
- Filter for tasks with NO owner field
- Pick tasks matching frontend role (React, UI, components, CSS, Tailwind, shadcn/ui)

### 3. CLAIM the task BEFORE starting work
```bash
curl -X PUT http://192.168.1.51:8787/api/tasks/{taskId} \
  -H "Content-Type: application/json" \
  -d '{"owner": "dev-2"}'
```
**CRITICAL:** Update owner field so UI shows task assignment!

### 4. LOG which task you selected & UPDATE currentTask
**LOG:**
```
Working on task-{id}: {title}
```

**UPDATE AGENT STATUS** (Mark as "working"):
```bash
curl -X POST http://192.168.1.51:8787/api/agents/dev-2/heartbeat \
  -H "Content-Type: application/json" \
  -d '{
    "currentTask": {
      "id": "{taskId}",
      "title": "{taskTitle}"
    }
  }'
```
This updates MissionControl UI to show you as "working" instead of "idle"

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

### 7. On completion: Move to review IMMEDIATELY & CLEAR currentTask
**MANDATORY - DO THIS NOW (BEFORE REPORTING):**

**Step 7a - Move lane to review:**
```bash
curl -X PUT http://192.168.1.51:8787/api/tasks/{taskId} \
  -H "Content-Type: application/json" \
  -d '{"lane": "review"}'
```

**Step 7b - Clear currentTask (mark as "idle"):**
```bash
curl -X POST http://192.168.1.51:8787/api/agents/dev-2/heartbeat \
  -H "Content-Type: application/json" \
  -d '{"currentTask": null}'
```

**VERIFY BOTH WORKED:**
```bash
curl -s http://192.168.1.51:8787/api/tasks/{taskId} | grep -o '"lane":"[^"]*"'
# Should show "lane":"review"

curl -s http://192.168.1.51:8787/api/agents/dev-2 | grep -o '"status":"[^"]*"'
# Should now show "status":"online" with no currentTask
```

**DO NOT REPORT COMPLETION UNTIL BOTH ARE UPDATED**

### 8. Report completion with task ID
```
Completed task-{id}: {brief summary}
```

### 9. If no tasks found
**BEFORE replying, update heartbeat:**
```bash
curl -X POST http://192.168.1.51:8787/api/agents/dev-2/heartbeat \
  -H "Content-Type: application/json" \
  -d '{"status": "online", "currentTask": null}'
```

Then reply: `HEARTBEAT_OK`

## Task Priority
Pick highest priority first:
- P0 (Critical) - immediate attention
- P1 (High) - today
- P2 (Medium) - this week  
- P3 (Low) - backlog

If multiple tasks at same priority, pick oldest first (FIFO)

## API Endpoints
- Get assigned tasks: `GET /api/tasks?lane=queued&owner=dev-2`
- Get all queued tasks: `GET /api/tasks?lane=queued`
- Update task: `PUT /api/tasks/{id}`
- Bridge: `http://192.168.1.51:8787`

## Specialization
Frontend work: React, TypeScript, Tailwind CSS, shadcn/ui, components, responsive design
