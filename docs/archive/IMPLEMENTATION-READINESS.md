# Implementation Readiness Checklist

**Date:** 2026-02-14 11:25 UTC  
**Status:** 🟢 READY FOR DEV AGENTS  
**Next Phase:** Implementation & Integration (Sunday)

---

## What's Complete ✅

- [x] **Design Document** (`DESIGN.md`) — Comprehensive API + schema specs
- [x] **Backend Code** — 95% implemented in bridge server
- [x] **Storage Layer** — JSON file persistence (`pmProjectsStore.mjs`)
- [x] **API Routes** — All 25+ endpoints defined in `server.mjs`
- [x] **Acceptance Criteria** — All 6 verified in code
- [x] **Verification Report** (`BACKEND-VERIFICATION.md`) — Code walkthrough

---

## What Needs Implementation 🔄

### Priority 1: Frontend Integration

**File:** `src/pages/Projects.tsx`

**Task:** Replace mock data with real API calls

```typescript
// BEFORE (lines 1300+)
const projects = fakeProjects()  // ← Remove this

// AFTER
const [projects, setProjects] = useState<Project[]>([])
useEffect(() => {
  const load = async () => {
    const data = await fetch('/api/pm/projects').then(r => r.json())
    setProjects(data)
  }
  load()
}, [])

// Wire up create/update/delete
const onCreate = async (p: Project) => {
  const created = await fetch('/api/pm/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(p)
  }).then(r => r.json())
  setProjects(prev => [...prev, created])
}
```

**Scope:**
- [ ] Replace `fakeProjects()` with API call
- [ ] Wire up `onCreate` handler
- [ ] Wire up `onUpdate` handler
- [ ] Wire up `onDelete` handler
- [ ] Test create → display → modify → verify

---

### Priority 2: Kanban Drag-and-Drop Persistence

**File:** `src/pages/Projects.tsx` — KanbanBoard component (line ~1000)

**Task:** Persist column changes to API

```typescript
// BEFORE (line ~1024)
const onDrop = (col: KanbanColumnId, ev: React.DragEvent) => {
  ev.preventDefault()
  const id = ev.dataTransfer.getData('text/kanban-card')
  setCards((prev) => prev.map((c) => (c.id === id ? { ...c, column: col } : c)))  // ← Only local
}

// AFTER
const onDrop = async (col: KanbanColumnId, ev: React.DragEvent) => {
  ev.preventDefault()
  const id = ev.dataTransfer.getData('text/kanban-card')
  
  // Update local state
  setCards((prev) => prev.map((c) => (c.id === id ? { ...c, column: col } : c)))
  
  // Persist to API
  await fetch(`/api/pm/projects/${projectId}/cards/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ column: col })
  })
}
```

**Scope:**
- [ ] Add API call on card column change
- [ ] Handle errors gracefully (revert on failure)
- [ ] Show loading state if needed

---

### Priority 3: TypeScript Types in Bridge

**File:** `bridge/server.mjs` (partially typed)

**Task:** Add JSDoc type annotations for all endpoints

```javascript
// BEFORE
app.post('/api/pm/projects', async (req, res) => {
  try {
    const created = await createPmProject(PM_PROJECTS_DIR, req.body ?? {})
    res.json(created)
  } catch (err) {
    res.status(400).send(err?.message ?? 'invalid project')
  }
})

// AFTER
/**
 * @param {Express.Request} req
 * @param {Express.Response} res
 * @returns {Promise<void>}
 */
app.post('/api/pm/projects', async (req, res) => {
  try {
    /** @type {Partial<Project>} */
    const body = req.body ?? {}
    const created = await createPmProject(PM_PROJECTS_DIR, body)
    res.json(created)
  } catch (err) {
    res.status(400).send(err?.message ?? 'invalid project')
  }
})
```

**Scope:**
- [ ] Add JSDoc for all PM project endpoints (25+)
- [ ] Reference types from DESIGN.md
- [ ] Run linter to verify

---

### Priority 4: End-to-End Testing

**File:** `e2e/projects.test.mjs` (create new)

**Task:** Write automated tests for all 6 acceptance criteria

```javascript
import test from 'node:test'
import assert from 'node:assert'

const API_BASE = 'http://localhost:8787/api'

test('AC1: Create project', async () => {
  const res = await fetch(`${API_BASE}/pm/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test Project' })
  })
  const project = await res.json()
  assert.ok(project.id)
  assert.equal(project.name, 'Test Project')
})

test('AC2: Persist intake verbatim', async () => {
  const projectRes = await fetch(`${API_BASE}/pm/projects`, {
    method: 'POST',
    body: JSON.stringify({ name: 'Test' })
  })
  const { id } = await projectRes.json()
  
  const text = 'My idea with 中文 & special <chars>'
  await fetch(`${API_BASE}/pm/projects/${id}/intake/idea`, {
    method: 'POST',
    body: JSON.stringify({ text, author: 'human' })
  })
  
  const intakeRes = await fetch(`${API_BASE}/pm/projects/${id}/intake`)
  const { idea } = await intakeRes.json()
  assert.equal(idea[0].text, text)  // ← Verify verbatim
})

// ... 4 more tests for AC3-6
```

**Scope:**
- [ ] Create test file with 6 test cases (one per AC)
- [ ] Add to package.json as `npm run test:projects`
- [ ] Verify all tests pass

---

### Priority 5: Error Handling & Validation

**File:** `bridge/pmProjectsStore.mjs` (partial)

**Task:** Enhance validation for edge cases

```javascript
// Add validation for:
// - Empty project names
// - Circular dependencies
// - Orphaned references (card → deleted feature)
// - Payload size limits
// - Special characters in IDs
```

**Scope:**
- [ ] Add input validation helpers
- [ ] Handle edge cases gracefully
- [ ] Return meaningful error messages

---

## Testing Strategy

### Manual Testing (Day 1)

```bash
# Start bridge
npm run bridge

# Test each endpoint:
# 1. Create project
curl -X POST http://localhost:8787/api/pm/projects \
  -H 'Content-Type: application/json' \
  -d '{"name":"Test","summary":"A test project"}'

# 2. Get project
curl http://localhost:8787/api/pm/projects/{id}

# 3. Create tree node
curl -X POST http://localhost:8787/api/pm/projects/{id}/tree/nodes \
  -H 'Content-Type: application/json' \
  -d '{"title":"Epic 1","priority":"p0"}'

# 4. Create kanban card
curl -X POST http://localhost:8787/api/pm/projects/{id}/cards \
  -H 'Content-Type: application/json' \
  -d '{"title":"Task 1","column":"todo","priority":"p0"}'

# 5. Add intake idea
curl -X POST http://localhost:8787/api/pm/projects/{id}/intake/idea \
  -H 'Content-Type: application/json' \
  -d '{"text":"User idea text","author":"human"}'

# 6. Export markdown
curl http://localhost:8787/api/pm/projects/{id}/export.md > project.md
open project.md

# 7. Restart bridge
# 8. Verify all data persisted
```

### E2E Testing (Day 2)

```bash
npm run test:projects
npm run test:e2e
```

### Browser Testing (Day 2)

```bash
# Start frontend
npm run dev

# Open Projects page
# Test: create project
# Test: view in tree/kanban/overview tabs
# Test: drag cards between columns
# Test: restart app
# Verify data persisted
```

---

## Implementation Timeline

| Day | Task | Owner | Status |
|-----|------|-------|--------|
| Sun 2/16 | Frontend integration | Dev agent | 🔄 |
| Sun 2/16 | Kanban persistence | Dev agent | 🔄 |
| Sun 2/16 | TypeScript types | Dev agent | 🔄 |
| Mon 2/17 | E2E tests | QA agent | 🔄 |
| Mon 2/17 | Error handling | Dev agent | 🔄 |
| Mon 2/17 | Manual QA | QA agent | 🔄 |
| Tue 2/18 | Deploy | DevOps agent | 🔄 |

---

## Success Criteria

- [x] All 6 ACs implemented
- [ ] Frontend calls real API (not mock)
- [ ] All CRUD ops work end-to-end
- [ ] Data persists across restart
- [ ] TypeScript: 0 errors
- [ ] E2E tests: all passing
- [ ] Manual QA: all passing
- [ ] Export markdown: human-readable
- [ ] Drag-and-drop: persists

---

## Known Issues & Gaps

### Minor (Nice-to-have)
- [ ] WebSocket real-time sync (optional)
- [ ] Conflict resolution (single-user for now)
- [ ] Search indexing (phase 2)
- [ ] Undo/redo (phase 2)

### Edge Cases to Test
- [ ] Create project with empty string name
- [ ] Create card with 5000-char title
- [ ] Circular dependencies (feat-a → feat-b → feat-a)
- [ ] Delete feature with linked cards
- [ ] Concurrent updates (single-user, low priority)
- [ ] Large tree (100+ nodes)

---

## Resources

**Code:**
- Backend: `/home/openclaw/.openclaw/workspace/bridge/`
- Frontend: `/home/openclaw/.openclaw/workspace/src/pages/Projects.tsx`
- Storage: `/home/openclaw/.openclaw/workspace/.clayhub/projects/`

**Documentation:**
- Design: `DESIGN.md`
- Verification: `BACKEND-VERIFICATION.md`
- This file: `IMPLEMENTATION-READINESS.md`

**API Base URL (dev):**
```
http://localhost:8787/api
```

---

## Handoff to Dev Agents

**Ready:** ✅ YES

**Package:**
- DESIGN.md (comprehensive API specs)
- BACKEND-VERIFICATION.md (code verification)
- IMPLEMENTATION-READINESS.md (this file)
- Branch: feature/clean-repo

**Next Steps:**
1. Read DESIGN.md to understand schema/endpoints
2. Review BACKEND-VERIFICATION.md for code locations
3. Start with Priority 1 (frontend integration)
4. Test after each step
5. Escalate blockers to TARS

**Questions?** Check DESIGN.md first — it's comprehensive.

---

**Prepared by:** Blueprint ⚙️  
**Date:** 2026-02-14 11:25 UTC  
**Status:** 🟢 READY TO HAND OFF
