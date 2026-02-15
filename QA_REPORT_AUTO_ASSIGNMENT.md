# QA Report: Auto-Assignment Feature Testing

**Task ID:** task-8390bcf820ac-1771195675991  
**Test Date:** 2026-02-15 22:51 UTC  
**QA Agent:** Sentinel (qa-subagent)

## Summary

Tested the auto-assignment feature implemented in task-89cafda6634e5-1771194980989. Found one critical bug that prevents auto-assignment from working when all agents are busy.

## Test Methodology

1. Reviewed auto-assignment implementation in:
   - `bridge/taskAssignment.mjs` - Auto-assignment logic
   - `bridge/server.mjs` - POST /api/tasks endpoint integration
   - `bridge/agentsStore.mjs` - Agent availability filtering
   - `bridge/taskRouter.mjs` - Task routing logic

2. Created test task without explicit owner:
   - Title: "TEST QA verification task - auto-assign test"
   - Description: Contains keywords "QA", "verification", "testing"
   - Expected behavior: Auto-assign to "qa" agent (Sentinel)
   - Actual behavior: Task created but NOT auto-assigned

3. Analyzed agent availability at test time:
   ```json
   {
     "tars": {"status": "busy", "currentTask": "task-491a2b73a55ef-1771195846965"},
     "dev-1": {"status": "busy", "currentTask": "task-1be9789f44fc4-1771195825060"},
     "dev-2": {"status": "busy", "currentTask": "task-282c325915d84-1771195835767"},
     "qa": {"status": "busy", "currentTask": "task-d464c76aa5dd9-1771195857786"},
     "architect": {"status": "online", "currentTask": null}
   }
   ```

## Findings

### ❌ BUG: Auto-assignment fails when all matching agents are busy

**Root Cause:**
- `agentsStore.getAvailable()` filters agents by `status === 'online'`
- When TaskRouter claims tasks, it sets agent status to "busy"
- Auto-assignment in POST /api/tasks calls `findBestAgent()` which uses `getAvailable()`
- If all agents are busy, `getAvailable()` returns empty array
- Auto-assignment fails with reason: "no-available-agents"

**Impact:**
- **CRITICAL** - PM-created tasks cannot be auto-assigned during active development periods
- Tasks sit in queued lane without assignment
- Manual owner assignment required as workaround

**Evidence:**
```javascript
// agentsStore.mjs line ~160
async getAvailable() {
  await this.ensureLoaded()
  return this.agents.filter(a => a.status === 'online')  // ← PROBLEM
}
```

```javascript
// taskAssignment.mjs line ~77
export async function findBestAgent(task, agentsStore) {
  const requiredRoles = analyzeTaskRoles(task)
  const agents = await agentsStore.getAvailable()  // ← Returns [] if all busy

  if (agents.length === 0) return null  // ← Auto-assignment fails
  // ...
}
```

**Test Task Details:**
- ID: task-12ff5f1f03fb1-1771195879261
- Created: 2026-02-15T22:51:19.261Z
- Expected: assignedTo="qa" (based on keywords)
- Actual: assignedTo=undefined, owner=undefined
- Reason: All agents had status="busy", getAvailable() returned []

## Recommendations

### Fix Options (in priority order):

**Option A: Allow busy agents to receive new tasks (RECOMMENDED)**
```javascript
// agentsStore.mjs
async getAvailable() {
  await this.ensureLoaded()
  // Include busy agents - workload balancing will distribute fairly
  return this.agents.filter(a => a.status !== 'offline')
}
```

**Option B: Separate availability from workload**
```javascript
// Add new method
async getAssignable() {
  await this.ensureLoaded()
  return this.agents.filter(a => a.status !== 'offline' && a.status !== 'error')
}
```

**Option C: Fallback to all agents if none available**
```javascript
// taskAssignment.mjs
let agents = await agentsStore.getAvailable()
if (agents.length === 0) {
  // Fallback: include busy agents
  agents = await agentsStore.getAll().filter(a => a.status !== 'offline')
}
```

### Regression Testing Needed

After fix:
1. Create 5 tasks sequentially (no explicit owner)
2. Verify all get auto-assigned despite agents being busy
3. Verify workload distribution across forge/patch for dev tasks
4. Verify QA tasks go to sentinel
5. Verify tasks with no matching role get assigned fairly

## Verification Status

### ✅ Auto-assignment code is properly hooked into POST /api/tasks
- Code exists in server.mjs lines ~390-420
- Calls autoAssignTask() when explicitOwner is undefined
- Logs assignment result to activity feed

### ✅ Role matching logic works correctly
- Tested analyzeTaskRoles() logic
- Keywords "test", "qa", "verification" correctly match "qa" role
- Pattern matching in ROLE_PATTERNS is comprehensive

### ✅ Workload balancing logic exists
- findBestAgent() sorts candidates by workload (ascending)
- getWorkload() calculates from activeTasks.length

### ❌ Agent availability filtering is too restrictive
- BLOCKS auto-assignment during normal operations
- Needs fix before feature can be marked as complete

## Conclusion

**Auto-assignment feature is PARTIALLY IMPLEMENTED but BLOCKED by agent availability bug.**

The feature task (task-89cafda6634e5-1771194980989) should be:
1. Moved back to "development" for bug fix
2. Re-tested after implementing Option A (recommended fix)
3. Regression tested with concurrent task creation

**Recommendation:** Do NOT mark task-89cafda6634e5-1771194980989 as complete until this bug is fixed.

---

**Test artifacts cleaned up:**
- task-12ff5f1f03fb1-1771195879261 (deleted)

**Report generated:** 2026-02-15 22:58 UTC  
**QA Agent:** Sentinel
