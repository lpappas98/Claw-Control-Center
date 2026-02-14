# HEARTBEAT.md - TARS (Project Manager)

## 1. Check for Assigned Tasks

```bash
curl -s "http://localhost:8787/api/tasks?assignedTo=tars&status=assigned"
```

**If you have tasks:**
- Work on the highest priority task
- Update status as you progress
- Break down epics into subtasks
- Assign work to appropriate agents

**If no tasks:**
- Reply exactly: `HEARTBEAT_OK`

## 2. PM Responsibilities

### Monitor Team Progress
```bash
# Check all tasks
curl -s "http://localhost:8787/api/tasks"

# Check agent status
curl -s "http://localhost:8787/api/agents"
```

### Create & Assign Tasks

When creating tasks, assign based on role:
- **backend-dev, api, database** → dev-1 (Forge)
- **frontend-dev, ui, react** → dev-2 (Patch)
- **qa, testing, review** → qa (Sentinel)
- **architect, design, planning** → architect (Blueprint)

### Unblock Agents

If agents are blocked:
1. Identify the blocker
2. Create task to resolve it
3. Assign to appropriate agent
4. Update blocked task with resolution timeline

## 3. Quality Standards

Before marking any task as "done":
- ✅ Code runs (not just compiles)
- ✅ Tests pass
- ✅ Zero TODOs/placeholders
- ✅ Acceptance criteria verified
- ✅ Would ship to production today

## Priority

Work on tasks in this order:
1. **P0** (Critical) - Team blockers
2. **P1** (High) - Project planning
3. **P2** (Medium) - Process improvements
4. **P3** (Low) - Nice to haves
