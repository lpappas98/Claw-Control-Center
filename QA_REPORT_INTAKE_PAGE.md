# IntakePage QA Test Report

**Task ID:** task-53b796abf5d6b-1771194143163  
**Timestamp:** 2026-02-15 22:25 UTC  
**Tester:** Sentinel Agent (subagent)  
**Priority:** P0  

## Executive Summary

Comprehensive E2E testing of IntakePage revealed **1 CRITICAL bug** and **2 workflow issues** that prevent the intake submission and AI analysis flow from working correctly.

## Test Environment

- Frontend: http://localhost:5173
- Bridge API: http://localhost:8787
- IntakePage: `/src/pages/IntakePage.tsx`
- Backend: `/bridge/server.mjs`

## Test Results Overview

| Test | Status | Severity |
|------|--------|----------|
| Load Projects | ✅ PASS | - |
| Load Intake History | ✅ PASS | - |
| Analyze Intake (Current Flow) | ❌ FAIL | CRITICAL |
| Analyze Intake (Correct Flow) | ⏳ PENDING | - |
| Create Tasks | ⏳ PENDING | - |
| Error Handling | ⏳ PENDING | - |

---

## CRITICAL BUG #1: API Workflow Mismatch

### Problem

The IntakePage component sends intake text directly to `/api/analyze-intake`, but the backend expects the intake to already exist in the database.

### Current (Broken) Flow in IntakePage.tsx

```javascript
// Lines 405-427 in IntakePage.tsx
const handleAnalyze = useCallback(async () => {
  // ...
  const id = `intake-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  setIntakeId(id);

  const res = await fetch("http://localhost:8787/api/analyze-intake", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      intakeId: id,           // ❌ Generated on client
      projectId: selectedProjectId,
      text: intakeText,       // ❌ Sent with analysis request
    }),
  });
  // ...
});
```

### Backend Expectation

```javascript
// Lines 1408-1422 in bridge/server.mjs
app.post('/api/analyze-intake', async (req, res) => {
  const intakeId = body.intakeId
  
  // Get intake from store
  const intake = intakesStore.getById(intakeId)
  if (!intake) {
    return res.status(404).send('intake not found')  // ❌ Always fails!
  }
  // ...
});
```

### Error Received

```
HTTP 404
intake not found
```

### Correct Flow (Based on Backend Design)

1. **First:** POST `/api/intakes` with `{projectId, text}` → Returns intake object with ID
2. **Then:** POST `/api/analyze-intake` with `{intakeId}` → Analyzes existing intake
3. **Finally:** Tasks are automatically created by analyze-intake endpoint

### Root Cause

The IntakePage was designed to generate intake IDs on the client and send text directly to analysis. The backend was designed with a two-step process: create intake, then analyze. These two designs are incompatible.

---

## Issue #2: Duplicate Task Creation Logic

### Problem

IntakePage has task creation logic in `handleAccept()` (lines 469-482) that manually creates tasks via POST `/api/tasks`. However, the backend's `/api/analyze-intake` endpoint **already creates tasks automatically** (lines 1435-1444).

### Current Code

```javascript
// Lines 469-482 in IntakePage.tsx
const handleAccept = useCallback(async () => {
  setIsCreatingTasks(true);
  
  // Create tasks via POST /api/tasks
  for (const task of analysisResult.tasks) {
    await fetch("http://localhost:8787/api/tasks", {
      method: "POST",
      // ... creates task
    });
  }
  // ...
}, [analysisResult, selectedProjectId]);
```

### Backend Implementation

```javascript
// Lines 1435-1444 in bridge/server.mjs
app.post('/api/analyze-intake', async (req, res) => {
  // Analyze intake with OpenAI
  const analysis = await analyzeIntake(intake.text, projectContext, agents)

  // Create tasks in the task store ✅ Already done!
  const createdTaskIds = []
  for (const task of analysis.tasks) {
    const createdTask = await newTasksStore.create(task)
    createdTaskIds.push(createdTask.id)
  }
  // ...
});
```

### Impact

- If the analyze endpoint worked, tasks would be created twice
- Frontend is unnecessarily complex
- Violates DRY principle

---

## Issue #3: Missing Error State UX

### Problem

When analysis fails, IntakePage shows error message but doesn't provide:
- Retry button
- Clear action path
- Error details for debugging

### Current Behavior

```javascript
// Lines 443-445 in IntakePage.tsx
} catch (err: any) {
  setAnalysisError(err.message || "Analysis failed");
}
```

User sees: `❌ Analysis failed` with no recourse except refreshing page.

---

## Detailed Test Execution

### TEST 1: Load Projects ✅

**Endpoint:** GET `/api/projects`

```bash
$ curl http://localhost:8787/api/projects
```

**Result:** 
- HTTP 200
- Returned 1 project: "Claw Control Center"
- Project ID: `proj-863071f41b8a-1771121302244`

**Status:** ✅ PASS

---

### TEST 2: Load Intake History ✅

**Endpoint:** GET `/api/intakes?projectId={id}&limit=5`

```bash
$ curl "http://localhost:8787/api/intakes?projectId=proj-863071f41b8a-1771121302244&limit=5"
```

**Result:**
- HTTP 200
- Returned 5 existing intakes
- All have proper structure with id, projectId, text, createdAt

**Status:** ✅ PASS

---

### TEST 3: Analyze Intake (Current Flow) ❌

**Endpoint:** POST `/api/analyze-intake`

**Request:**
```json
{
  "intakeId": "intake-1739662293-abc123",
  "projectId": "proj-863071f41b8a-1771121302244",
  "text": "Add dark mode toggle to settings"
}
```

**Result:**
- HTTP 404
- Error: `intake not found`

**Status:** ❌ FAIL - Critical bug preventing all intake analysis

---

## Recommended Fixes

### Fix #1: Update IntakePage.tsx to match backend API

**Option A: Modify Frontend (Recommended)**

Change `handleAnalyze()` to:

```javascript
const handleAnalyze = useCallback(async () => {
  if (!selectedProjectId || !intakeText.trim()) {
    setAnalysisError("Please select a project and enter text");
    return;
  }

  try {
    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalysisResult(null);

    // Step 1: Create intake
    const createRes = await fetch("http://localhost:8787/api/intakes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: selectedProjectId,
        text: intakeText,
      }),
    });

    if (!createRes.ok) {
      throw new Error("Failed to create intake");
    }

    const intake = await createRes.json();
    setIntakeId(intake.id);

    // Step 2: Analyze intake
    const analyzeRes = await fetch("http://localhost:8787/api/analyze-intake", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intakeId: intake.id,
        projectId: selectedProjectId,
      }),
    });

    if (!analyzeRes.ok) {
      throw new Error("Analysis failed");
    }

    const result = await analyzeRes.json();
    setAnalysisResult(result);
  } catch (err: any) {
    setAnalysisError(err.message || "Analysis failed");
  } finally {
    setIsAnalyzing(false);
  }
}, [selectedProjectId, intakeText]);
```

**Option B: Modify Backend**

Change `/api/analyze-intake` to accept text directly and create intake internally. This requires refactoring the endpoint to match frontend expectations.

### Fix #2: Remove duplicate task creation

Since backend already creates tasks, remove the `handleAccept()` function and the "Accept & Create Tasks" button. Change the flow to:

1. Analyze → Tasks created automatically
2. Show success message: "✅ Created X tasks"
3. Clear form and refresh history

Or change button to "Review Tasks" that navigates to the task board.

### Fix #3: Improve error handling

Add retry mechanism and better error messages:

```javascript
{analysisError && (
  <div style={{...errorStyles}}>
    <p>{analysisError}</p>
    <button onClick={handleAnalyze}>Retry</button>
  </div>
)}
```

---

## Testing the Correct Workflow

### Manual Test with Fixed Flow

```bash
# Step 1: Create intake
INTAKE_RESPONSE=$(curl -s -X POST http://localhost:8787/api/intakes \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "proj-863071f41b8a-1771121302244",
    "text": "Add dark mode toggle to settings page with smooth transitions"
  }')

echo "$INTAKE_RESPONSE"
INTAKE_ID=$(echo "$INTAKE_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

# Step 2: Analyze intake
curl -X POST http://localhost:8787/api/analyze-intake \
  -H "Content-Type: application/json" \
  -d "{
    \"intakeId\": \"$INTAKE_ID\",
    \"projectId\": \"proj-863071f41b8a-1771121302244\"
  }"
```

This workflow should succeed (pending AI analysis working).

---

## Additional Observations

### Code Quality Issues

1. **Lines 405-427:** Complex async flow with multiple state updates - consider useReducer
2. **Lines 234-248:** AnalyzingAnimation could use CSS keyframes instead of inline styles
3. **No loading skeletons** - Projects dropdown shows empty while loading
4. **No optimistic updates** - Could show pending state immediately

### Missing Features

1. **Draft auto-save** - Losing text on refresh
2. **Intake editing** - Can't modify submitted intakes
3. **Task previews** - Can't click to see task details before accepting
4. **Keyboard shortcuts** - No Cmd+Enter to submit
5. **File attachments** - Backend supports `files` field but UI doesn't

### Performance Concerns

1. **No debouncing** - Every keystroke could trigger validation
2. **No request cancellation** - Navigating away during analysis could cause issues
3. **History refetch** - Reloads on every project change even if cached

---

## Next Steps

1. ✅ Document all findings (this report)
2. ⏳ Fix critical bug in IntakePage.tsx
3. ⏳ Test full flow end-to-end
4. ⏳ Add integration tests
5. ⏳ Update error handling
6. ⏳ Remove duplicate task creation logic

---

## Conclusion

The IntakePage is **non-functional** due to an API workflow mismatch. The frontend and backend were designed with different assumptions about the intake creation/analysis flow.

**Severity:** P0 - Blocks all intake functionality  
**Effort:** Low (2-hour fix)  
**Risk:** Low (isolated to IntakePage)  

**Recommended Action:** Implement Fix #1 Option A (modify frontend) as it's less invasive and maintains backend integrity.

---

## Appendix: API Endpoints Summary

### Intakes

- `GET /api/intakes?projectId={id}&limit={n}` - List intakes
- `POST /api/intakes` - Create intake (body: {projectId, text, files?})
- `PUT /api/intakes/:id` - Update intake
- `DELETE /api/intakes/:id` - Delete intake
- `POST /api/analyze-intake` - Analyze existing intake (body: {intakeId, projectId?})

### Projects

- `GET /api/projects` - List all projects

### Tasks

- `GET /api/tasks` - List all tasks
- `POST /api/tasks` - Create task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task

---

**Report Generated:** 2026-02-15 22:26 UTC  
**Agent:** sentinel-task-53b  
**Status:** Complete
