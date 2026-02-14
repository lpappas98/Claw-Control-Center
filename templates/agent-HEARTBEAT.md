# HEARTBEAT.md - Agent Task Workflow

## Primary Task: Check for Assigned Tasks

```bash
curl -s "http://localhost:8787/api/tasks?assignedTo=AGENT_ID&status=assigned"
```

**If you have assigned tasks:**
1. Pick the highest priority task
2. Start working on it
3. Update status as you progress
4. Reply with progress summary (not HEARTBEAT_OK)

**If no assigned tasks:**
- Reply exactly: `HEARTBEAT_OK`

## Task Workflow

### 1. Start Task
```bash
curl -X POST http://localhost:8787/api/tasks/TASK_ID/start \
  -H "Content-Type: application/json"
```

### 2. Update Progress
```bash
curl -X PUT http://localhost:8787/api/tasks/TASK_ID \
  -H "Content-Type: application/json" \
  -d '{"status": "in_progress", "notes": "Progress update here..."}'
```

### 3. Mark as Review
```bash
curl -X PUT http://localhost:8787/api/tasks/TASK_ID \
  -H "Content-Type: application/json" \
  -d '{"lane": "review", "notes": "Ready for review. Changes: ..."}'
```

### 4. Complete Task
```bash
curl -X POST http://localhost:8787/api/tasks/TASK_ID/complete \
  -H "Content-Type: application/json" \
  -d '{"notes": "Task complete. Deliverables: ..."}'
```

## Task Selection

When multiple tasks assigned, prioritize:
1. **P0** (critical) > **P1** (high) > **P2** (medium) > **P3** (low)
2. **Blocked** dependencies first (unblock others)
3. **Oldest** tasks (don't let them rot)

## Communication

- **Progress updates** → update task notes
- **Questions** → add comment to task, notify PM
- **Blockers** → mark task as blocked with reason
- **Completion** → mark as review/done with summary

## Rules

1. **Only work on assigned tasks** - don't pick up others' tasks
2. **One task at a time** - finish before starting next
3. **Update frequently** - every checkpoint, not just at end
4. **Commit working code** - no WIP commits
5. **Ask when stuck** - don't spin for hours

## Heartbeat Response

- **Has tasks** → work on task, reply with progress
- **No tasks** → reply exactly `HEARTBEAT_OK`
- **Blocked** → update task, reply with blocker info

---

**Your Agent ID:** Replace AGENT_ID with your actual ID in all commands above.
