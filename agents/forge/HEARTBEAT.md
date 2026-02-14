# Forge - Heartbeat

⚠️ Before any UI work: Read /home/openclaw/.openclaw/workspace/CODING_STANDARDS.md

## Task Workflow

### Step 1: Check for assigned tasks
```bash
curl -s "http://localhost:8787/api/tasks?lane=queued&owner=dev-1" | head -c 2000
```

### Step 2: If no assigned tasks, check unassigned
```bash
curl -s "http://localhost:8787/api/tasks?lane=queued" | head -c 2000
```

### Step 3: If a task is found
1. **Claim it** (if unassigned): `curl -X PUT http://localhost:8787/api/tasks/{taskId} -H "Content-Type: application/json" -d '{"owner":"dev-1"}'`
2. **Move to development**: `curl -X PUT http://localhost:8787/api/tasks/{taskId} -H "Content-Type: application/json" -d '{"lane":"development"}'`
3. **Verify lane changed**: `curl -s http://localhost:8787/api/tasks | python3 -c "import sys,json; [print(t['lane']) for t in json.load(sys.stdin) if t['id']=='{taskId}']"`

### Step 4: Do the work
- Use exec, read, write, edit tools directly
- **DO NOT SPAWN SUB-AGENTS**
- Follow CODING_STANDARDS.md for all UI work (inline styles, no Tailwind classes)
- If a `.reference.tsx` file exists, match its design exactly (but use inline styles)

### Step 5: Self-verify before moving to review
Before moving to review, YOU must verify your own work:
1. Run `npm run build` — must succeed with 0 errors
2. If UI change: Clear Vite cache (`rm -rf dist node_modules/.vite`), rebuild, rebuild Docker, test with Playwright
3. If backend change: Test the endpoint with curl
4. **Take a screenshot** if UI work and verify it looks correct
5. Only proceed to Step 6 if verification passes

### Step 6: Move to review
```bash
curl -X PUT http://localhost:8787/api/tasks/{taskId} -H "Content-Type: application/json" -d '{"lane":"review"}'
```
Verify the lane change succeeded. **DO NOT move to done** — only Sentinel (QA) moves tasks to done.

### Step 7: Commit and push
```bash
git add -A && git commit -m "feat: {description}" && git push
```

### Step 8: Update heartbeat
```bash
curl -X POST http://localhost:8787/api/agents/dev-1/heartbeat -H "Content-Type: application/json" -d '{"status":"online","currentTask":null}'
```

### Step 9: No tasks found
If no tasks in queue, reply HEARTBEAT_OK.
