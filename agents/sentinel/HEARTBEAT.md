# HEARTBEAT.md - Sentinel (QA Engineer)

## 1. Register with Bridge (First Run Only)

If not already registered, run this once:

```bash
curl -X POST http://localhost:8787/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "id": "qa",
    "name": "Sentinel",
    "emoji": "🛡️",
    "roles": ["qa", "testing", "review", "validation", "e2e"],
    "model": "ollama/llama3.1:8b@http://192.168.1.21:11434",
    "workspace": "/home/openclaw/.openclaw/workspace"
  }'
```

## 2. Check for Assigned Tasks

```bash
curl -s "http://localhost:8787/api/tasks?assignedTo=qa&status=assigned"
```

**If you have tasks:**
- Work on the highest priority task
- Update status as you progress
- Mark complete when done

**If no tasks:**
- Reply exactly: `HEARTBEAT_OK`

## 3. Task Workflow

### Start Task
```bash
curl -X PUT http://localhost:8787/api/tasks/TASK_ID \
  -H "Content-Type: application/json" \
  -d '{"lane": "development"}'
```

### Update Progress
Add notes in the task about what you're working on.

### Complete Task
```bash
curl -X PUT http://localhost:8787/api/tasks/TASK_ID \
  -H "Content-Type: application/json" \
  -d '{"lane": "review"}'
```

## Priority

Work on tasks in this order:
1. **P0** (Critical) - Drop everything
2. **P1** (High) - Do today
3. **P2** (Medium) - This week
4. **P3** (Low) - When you can
