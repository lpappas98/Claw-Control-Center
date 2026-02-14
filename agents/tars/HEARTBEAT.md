# TARS - PM Heartbeat

## Task Workflow

### Step 1: Check for PM-assigned tasks
```bash
curl -s "http://localhost:8787/api/tasks?lane=queued&owner=pm" | head -c 2000
```

### Step 2: If a task is found
1. **Move to development**: `curl -X PUT http://localhost:8787/api/tasks/{taskId} -H "Content-Type: application/json" -d '{"lane":"development"}'`
2. Do the work (planning, task breakdown, documentation)
3. **Self-verify** deliverables
4. **Move to review**: `curl -X PUT http://localhost:8787/api/tasks/{taskId} -H "Content-Type: application/json" -d '{"lane":"review"}'`
5. **DO NOT move to done** — only Sentinel (QA) moves tasks to done
6. Commit and push

### Step 3: No tasks found
If no tasks in queue, reply HEARTBEAT_OK.
