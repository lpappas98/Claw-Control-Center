# Agent Status UI - Test Plan & Verification

## Pre-Testing Checklist

- [ ] Bridge server restarted to load new code
- [ ] MissionControl UI browser tab refreshed
- [ ] All previous tests passed

## Test 1: API Response Format

### Objective
Verify that `/api/workers` endpoint returns the new `agentStatus` field

### Steps
1. Call the API:
   ```bash
   curl http://localhost:8787/api/workers
   ```

2. Inspect response structure for each worker:
   ```json
   {
     "slot": "dev-1",
     "label": "Forge",
     "status": "active",
     "task": null,           // New: object with id & title when working
     "taskId": null,         // New: task ID for working tasks
     "agentStatus": "idle",  // New: idle, working, or offline
     "lastBeatAt": "...",
     "beats": [...]
   }
   ```

### Expected Result
- ✅ All agents have `agentStatus` field
- ✅ `agentStatus` is one of: `"idle"`, `"working"`, `"offline"`
- ✅ `task` is `null` or object with `{id, title}`
- ✅ Response time < 200ms

### Pass Criteria
Response includes agentStatus for all agents with correct values

---

## Test 2: Initial Agent Status (Idle State)

### Objective
Verify agents show as idle when no tasks assigned

### Steps
1. Open MissionControl UI: http://localhost:5173
2. Take screenshot of agent strip
3. Inspect agent tiles visually

### Expected Result
- ✅ All offline agents shown with red indicators
- ✅ All online agents with no task shown with gray indicators
- ✅ Text shows "Idle · X time ago"
- ✅ No blue working indicators visible
- ✅ Agent status colors match spec:
  - Gray (#6B7280) for idle
  - Red (#EF4444) for offline

### Visual Verification Checklist
- [ ] Gray status indicators for idle agents
- [ ] Red status indicators for offline agents
- [ ] Status text below agent name shows "Idle" or "Offline"
- [ ] Dot indicators have appropriate glow effect
- [ ] Compact or expanded layout renders correctly

### Pass Criteria
All idle/offline agents display correct status colors and labels

---

## Test 3: Task Assignment Status Change

### Objective
Verify agent status changes from idle to working when task assigned

### Steps
1. **Create a test task:**
   ```bash
   curl -X POST http://localhost:8787/api/tasks \
     -H "Content-Type: application/json" \
     -d '{
       "title":"Test Task - Idle to Working",
       "lane":"proposed",
       "priority":"P1"
     }'
   ```
   Save the returned `id`

2. **Assign task to specific agent:**
   ```bash
   curl -X POST http://localhost:8787/api/tasks/{TASK_ID}/auto-assign
   ```

3. **Verify API response:**
   ```bash
   curl http://localhost:8787/api/workers | python3 -m json.tool | grep -A 10 '"task"'
   ```

4. **Verify UI update (within 5 seconds):**
   - Look at agent strip in MissionControl
   - Find the assigned agent
   - Verify status changed to working (blue)

### Expected Result from API
```json
{
  "slot": "assigned-agent-id",
  "agentStatus": "working",
  "task": {
    "id": "{TASK_ID}",
    "title": "Test Task - Idle to Working"
  }
}
```

### Expected UI Changes
- ✅ Agent tile changes to blue status indicator
- ✅ Agent tile shows blue-tinted background
- ✅ Task title displayed below agent name
- ✅ Status text changes from "Idle" to task title
- ✅ Dot color changes from gray to blue with stronger glow

### Pass Criteria
- [ ] Agent status changes to working within 5 seconds
- [ ] Task title displays in agent tile
- [ ] Blue color (#3B82F6) applied to status indicator
- [ ] Blue background gradient applied

---

## Test 4: Task Completion Status Reset

### Objective
Verify agent status returns to idle when task completed

### Steps
1. **Complete the task from Test 3:**
   ```bash
   curl -X POST http://localhost:8787/api/tasks/{TASK_ID}/complete
   ```

2. **Verify API response immediately:**
   ```bash
   curl http://localhost:8787/api/workers | python3 -m json.tool
   ```

3. **Verify UI updates (within 5 seconds):**
   - Check agent strip in MissionControl
   - Verify agent returns to idle status

### Expected Result from API
```json
{
  "slot": "assigned-agent-id",
  "agentStatus": "idle",  // Changed back to idle
  "task": null            // Task cleared
}
```

### Expected UI Changes
- ✅ Status indicator returns to gray
- ✅ Background returns to neutral color
- ✅ Status text changes back to "Idle · 0s ago"
- ✅ Dot color returns to gray
- ✅ Task title removed from display

### Pass Criteria
- [ ] Agent status returns to idle
- [ ] currentTask cleared from agent
- [ ] UI reflects changes within 5 seconds
- [ ] Gray colors restored (#6B7280)

---

## Test 5: Multiple Agents with Mixed Status

### Objective
Verify color coding works correctly with multiple agents at different states

### Steps
1. **Create 3 test tasks:**
   ```bash
   for i in {1..3}; do
     curl -X POST http://localhost:8787/api/tasks \
       -H "Content-Type: application/json" \
       -d "{\"title\":\"Task $i\",\"lane\":\"proposed\",\"priority\":\"P1\"}"
   done
   ```

2. **Assign tasks to different agents:**
   - Assign Task 1 to dev-1
   - Assign Task 2 to dev-2
   - Leave Task 3 unassigned

3. **Check UI visually:**
   - dev-1 should show blue (working)
   - dev-2 should show blue (working)
   - tars, architect, qa should show gray (idle)
   - Any offline agents should show red

4. **Verify through API:**
   ```bash
   curl http://localhost:8787/api/workers | python3 -c "
     import json, sys
     workers = json.load(sys.stdin)
     for w in workers:
       print(f\"{w['label']}: {w.get('agentStatus', 'N/A')} - {w.get('task', {}).get('title', 'No task')}\")
   "
   ```

### Expected Result
```
TARS: idle - No task
Forge: working - Task 1
Patch: working - Task 2
Sentinel: idle - No task
Blueprint: idle - No task
```

### Visual Expectations
- 2 blue agents (working)
- 3+ gray agents (idle)
- 0 red agents (all online)
- Color distribution matches API status

### Pass Criteria
- [ ] Correct color for each agent status
- [ ] API and UI statuses match
- [ ] No mixed or undefined statuses

---

## Test 6: Offline Agent Handling

### Objective
Verify offline agents are properly color-coded in red

### Steps
1. Simulate agent going offline (backend specific)
2. Check `/api/workers` response
3. Verify UI shows red status

### Expected Result
- ✅ Offline agents show red indicator (#EF4444)
- ✅ Status text shows "Offline"
- ✅ Agent not included in "working" or "idle" counts
- ✅ No task title shown

### Pass Criteria
- [ ] Red color (#EF4444) applied to offline agents
- [ ] Status label shows "Offline"
- [ ] Proper visual distinction from idle agents

---

## Test 7: Real-Time Update Timing

### Objective
Verify status updates occur within acceptable latency

### Steps
1. **Create and assign task:**
   ```bash
   TASK_ID=$(curl -s -X POST http://localhost:8787/api/tasks \
     -H "Content-Type: application/json" \
     -d '{"title":"Timing Test","lane":"proposed","priority":"P1"}' \
     | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])")
   
   START=$(date +%s%N)
   curl -X POST http://localhost:8787/api/tasks/$TASK_ID/auto-assign
   ASSIGN_TIME=$(($(date +%s%N) - START))
   ```

2. **Check status update time:**
   ```bash
   START=$(date +%s%N)
   until curl -s http://localhost:8787/api/workers | \
         python3 -c "import json,sys; w=json.load(sys.stdin); exit(0 if any(t['agentStatus']=='working' for t in w) else 1)"; do
     sleep 0.1
   done
   UPDATE_TIME=$(($(date +%s%N) - START))
   ```

### Expected Result
- ✅ Task assignment API response: < 100ms
- ✅ Status update visible in UI: < 5 seconds
- ✅ API response time consistent: ±50ms

### Pass Criteria
- [ ] Status updates within 5 second polling interval
- [ ] No latency increase with multiple agents

---

## Test 8: Browser Page Refresh

### Objective
Verify UI correctly loads and displays status after page refresh

### Steps
1. **Assign a task** (keep it assigned)
2. **Refresh browser:** F5 or Cmd+R
3. **Verify initial load:**
   - Agent tile shows correct status
   - Task title displays correctly
   - Colors match current state

### Expected Result
- ✅ Page loads with correct agent statuses
- ✅ No flashing or incorrect intermediate state
- ✅ Colors correct after load completes
- ✅ Task information preserved and displayed

### Pass Criteria
- [ ] Status displays correctly on page load
- [ ] No visual glitches or flashing

---

## Completion Checklist

- [ ] Test 1: API Response Format - PASS
- [ ] Test 2: Initial Idle Status - PASS
- [ ] Test 3: Idle to Working - PASS
- [ ] Test 4: Working to Idle - PASS
- [ ] Test 5: Mixed Status Display - PASS
- [ ] Test 6: Offline Status - PASS
- [ ] Test 7: Real-Time Timing - PASS
- [ ] Test 8: Page Refresh - PASS

## Acceptance Criteria Final Verification

- [ ] Idle agents: gray color with "Idle" label
- [ ] Working agents: blue color with task title
- [ ] Offline agents: red color with "Offline" label
- [ ] Status updates within 30 seconds (we: 5 seconds)
- [ ] Agent tiles show distinct visual states
- [ ] No TODO/FIXME comments in code
- [ ] Code compiles with 0 TypeScript errors
- [ ] All changes committed to feature branch

## Notes

- Color spec: idle=#6B7280, working=#3B82F6, offline=#EF4444
- Polling interval: 5 seconds (MissionControl)
- API response time: typically <50ms
- Status field: `agentStatus` (new), fallback to `status` (legacy)
