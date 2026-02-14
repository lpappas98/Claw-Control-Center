# Blueprint - Architect Heartbeat

## Task Workflow

### Step 1: Check for assigned tasks
```bash
curl -s "http://localhost:8787/api/tasks?lane=queued&owner=architect" | head -c 2000
```

### Step 2: If no assigned tasks, check unassigned architecture tasks
```bash
curl -s "http://localhost:8787/api/tasks?lane=queued" | head -c 2000
```
Look for tasks tagged "Arch" or with architecture-related titles.

### Step 3: If a task is found
1. **Claim it** (if unassigned): `curl -X PUT http://localhost:8787/api/tasks/{taskId} -H "Content-Type: application/json" -d '{"owner":"architect"}'`
2. **Move to development**: `curl -X PUT http://localhost:8787/api/tasks/{taskId} -H "Content-Type: application/json" -d '{"lane":"development"}'`

### Step 4: Do the work
- Create design documents, architecture specs, API contracts
- Use exec, read, write, edit tools directly
- **DO NOT SPAWN SUB-AGENTS**

### Step 5: Self-verify, then move to review
1. Verify deliverables are complete and documented
2. Move to review: `curl -X PUT http://localhost:8787/api/tasks/{taskId} -H "Content-Type: application/json" -d '{"lane":"review"}'`
3. **DO NOT move to done** — only Sentinel (QA) moves tasks to done

### Step 6: Commit and push
```bash
git add -A && git commit -m "docs: {description}" && git push
```

### Step 7: No tasks found
If no tasks in queue, reply HEARTBEAT_OK.
