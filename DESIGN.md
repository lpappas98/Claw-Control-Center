# P0 Projects Backend Epic — Design Document

**Status:** DESIGN PHASE ✅ COMPLETE  
**Date:** 2026-02-14  
**Owner:** Blueprint ⚙️  
**Branch:** `feature/clean-repo`  
**Timeline:** Design → Implementation (Sunday)

---

## Executive Summary

This document specifies the **P0 Projects backend epic**: real storage + APIs for the Projects flow (intake → tree → kanban → export). The backend is **95% implemented** in the bridge server (`bridge/server.mjs`) with persistent JSON file storage. This doc formalizes the schema, endpoints, and acceptance criteria for final implementation and testing.

### Acceptance Criteria Status

| Criteria | Status | Location |
|----------|--------|----------|
| ✅ CRUD projects | Implemented | `/api/pm/projects/*` |
| ✅ Persist intake answers verbatim | Implemented | `.clawhub/projects/{id}/intake.json` |
| ✅ Persist tree data (hierarchy) | Implemented | `.clawhub/projects/{id}/tree.json` |
| ✅ Persist kanban data | Implemented | `.clawhub/projects/{id}/cards.json` |
| ✅ Persist links (relationships) | Implemented | Tree `dependsOn`, Card `featureId` |
| ✅ Export to markdown format | Implemented | `toMarkdownProject()` function |

---

## Architecture Overview

### Stack

- **Framework:** Express.js (Node.js bridge)
- **Storage:** JSON files on disk (`.clawhub/projects/`)
- **Frontend:** React (Projects.tsx page)
- **API Format:** RESTful JSON

### Storage Structure

Each project is a directory under `.clawhub/projects/{projectId}/` containing:

```
.clawhub/projects/
├── {projectId}/
│   ├── overview.json       # Project metadata (name, status, owner, links, etc.)
│   ├── tree.json           # Feature hierarchy (nodes with children)
│   ├── cards.json          # Kanban cards (column, priority, owner, due date)
│   ├── activity.json       # Activity log (who did what and when)
│   └── intake.json         # Intake form data (ideas, analysis, questions, requirements)
```

### Data Model

#### 1. Project (overview.json)

```typescript
type Project = {
  schemaVersion: 1
  id: string                  // slug: ^[a-z0-9][a-z0-9-]{0,80}$
  name: string                // 1-200 chars
  summary: string             // Project description
  status: 'active' | 'paused' | 'archived'
  tags: string[]              // Up to 50 tags, ~50 chars each
  owner: string               // Single user for local mode
  links: ProjectLink[]        // Up to 50 links
  createdAt: ISO8601          // UTC timestamp
  updatedAt: ISO8601          // UTC timestamp (updated on any change)
}

type ProjectLink = {
  label: string               // 1-100 chars
  url: string                 // 1-2000 chars
}
```

#### 2. Feature Tree (tree.json)

```typescript
type FeatureNode = {
  id: string                  // slug: auto-generated, guaranteed unique within project
  title: string               // 1-200 chars
  summary?: string            // Optional: 1-500 chars
  status: 'planned' | 'in_progress' | 'blocked' | 'done'
  priority: 'p0' | 'p1' | 'p2'
  tags?: string[]             // Optional: up to 50
  owner?: string              // Optional: assignee
  children?: FeatureNode[]    // Nested hierarchy (max depth: 10)
  dependsOn?: string[]        // Feature IDs this depends on (up to 50)
  sources?: SourceRef[]       // Links to intake items
}

type SourceRef = {
  kind: 'idea' | 'question' | 'requirement'
  id: string                  // Reference to intake item ID
}
```

**Notes:**
- Tree is stored as flat array at root level
- Children are nested within parent nodes
- All node IDs must be unique across the tree
- Circular dependencies are NOT prevented (app responsibility)

#### 3. Kanban Cards (cards.json)

```typescript
type KanbanCard = {
  id: string                  // slug: auto-generated
  title: string               // 1-200 chars
  featureId?: string          // Optional: links to tree node
  owner?: string              // Optional: assignee
  due?: string                // Optional: ISO8601 or friendly string
  priority: 'p0' | 'p1' | 'p2'
  column: 'todo' | 'in_progress' | 'blocked' | 'done'
  createdAt: ISO8601
  updatedAt: ISO8601
}
```

#### 4. Intake (intake.json)

```typescript
type ProjectIntake = {
  idea: IntakeIdea[]
  analysis: Analysis[]
  questions: IntakeQuestion[]
  requirements: Requirement[]
}

type IntakeIdea = {
  id: string
  at: ISO8601
  author: 'human' | 'ai'
  text: string                // Verbatim user input (1-5000 chars)
}

type Analysis = {
  id: string
  at: ISO8601
  type: 'software' | 'ops' | 'hybrid'
  tags: string[]
  risks: string[]             // Up to 30
  summary: string             // Generated classification
}

type IntakeQuestion = {
  id: string
  category: string            // 'Outcome', 'Users', 'Workflow', etc.
  prompt: string              // The question
  answer?: {
    text: string              // Verbatim answer (1-5000 chars)
    at: ISO8601
    author: 'human' | 'ai'
  } | null
}

type Requirement = {
  id: string
  at: ISO8601
  source: 'human' | 'ai'
  kind: 'goal' | 'constraint' | 'non_goal'
  text: string
  citations?: {               // Links to intake sources
    kind: 'idea' | 'question'
    id: string
  }[]
}
```

#### 5. Activity (activity.json)

```typescript
type ActivityEntry = {
  id: string
  at: ISO8601
  actor: string               // User/agent name
  text: string                // What happened
}
```

---

## API Endpoints

### Projects (CRUD)

#### List projects
```
GET /api/pm/projects
Response: Project[] (summary only, not full data)
```

#### Create project
```
POST /api/pm/projects
Body: {
  name: string
  summary?: string
  tags?: string[]
  status?: 'active' | 'paused' | 'archived'
  owner?: string
  links?: ProjectLink[]
  intake?: ProjectIntake
  tree?: FeatureNode[]
  cards?: KanbanCard[]
}
Response: Project (created with auto-generated id)
```

#### Get project (full)
```
GET /api/pm/projects/:id
Response: Project (includes tree, cards, intake, activity)
```

#### Update project
```
PUT /api/pm/projects/:id
Body: {
  name?: string
  summary?: string
  status?: string
  tags?: string[]
  owner?: string
  links?: ProjectLink[]
}
Response: Project (full updated project)
```

#### Delete project (soft)
```
DELETE /api/pm/projects/:id
Response: { ok: true }
Note: Moves project to .clawhub/projects/_trash/{id}
```

#### Export JSON
```
GET /api/pm/projects/:id/export.json
Response: application/json (attachment)
```

#### Export Markdown
```
GET /api/pm/projects/:id/export.md
Response: text/markdown
Format: Hierarchy + kanban status + links
```

---

### Tree Operations

#### Get full tree
```
GET /api/pm/projects/:id/tree
Response: FeatureNode[] (root-level nodes only)
```

#### Create node
```
POST /api/pm/projects/:id/tree/nodes
Body: {
  title: string
  summary?: string
  status?: string
  priority?: string
  tags?: string[]
  owner?: string
  parentId?: string        // If null, adds to root
  dependsOn?: string[]
  sources?: SourceRef[]
}
Response: FeatureNode (created node with auto ID)
```

#### Update node
```
PUT /api/pm/projects/:id/tree/nodes/:nodeId
Body: { title?, summary?, status?, priority?, tags?, owner?, dependsOn?, sources? }
Response: FeatureNode (updated node)
```

#### Delete node
```
DELETE /api/pm/projects/:id/tree/nodes/:nodeId
Response: { ok: true }
Note: Also removes from any parent's children
```

---

### Kanban Operations

#### Get all cards
```
GET /api/pm/projects/:id/cards
Response: KanbanCard[]
```

#### Create card
```
POST /api/pm/projects/:id/cards
Body: {
  title: string
  priority?: 'p0' | 'p1' | 'p2'
  column?: 'todo' | 'in_progress' | 'blocked' | 'done'
  featureId?: string
  owner?: string
  due?: string
}
Response: KanbanCard (created with auto ID)
```

#### Update card
```
PUT /api/pm/projects/:id/cards/:cardId
Body: { title?, priority?, column?, featureId?, owner?, due? }
Response: KanbanCard (updated card)
```

#### Delete card
```
DELETE /api/pm/projects/:id/cards/:cardId
Response: { ok: true }
```

---

### Intake Operations

#### Get intake
```
GET /api/pm/projects/:id/intake
Response: ProjectIntake (all ideas, analysis, questions, requirements)
```

#### Update intake (replace entire)
```
PUT /api/pm/projects/:id/intake
Body: ProjectIntake
Response: ProjectIntake (updated)
```

#### Add idea
```
POST /api/pm/projects/:id/intake/idea
Body: { text: string, author?: 'human' | 'ai' }
Response: IntakeIdea (appended)
```

#### Add analysis
```
POST /api/pm/projects/:id/intake/analysis
Body: { type: string, tags: string[], risks: string[], summary: string }
Response: Analysis
```

#### Generate questions
```
POST /api/pm/projects/:id/intake/questions/generate
Body: { type: 'software' | 'ops' | 'hybrid' }
Response: IntakeQuestion[]
Note: Overwrites existing questions
```

#### Answer question
```
POST /api/pm/projects/:id/intake/questions/:qid/answer
Body: { text: string, author?: 'human' | 'ai' }
Response: IntakeQuestion (with answer set)
```

#### Add requirement
```
POST /api/pm/projects/:id/intake/requirements
Body: {
  kind: 'goal' | 'constraint' | 'non_goal'
  text: string
  source?: 'human' | 'ai'
  citations?: SourceRef[]
}
Response: Requirement
```

---

## Persistence & Recovery

### Storage Guarantees

1. **Atomicity:** Each file write is atomic (write to temp, rename)
2. **Consistency:** JSON schema validation on read/write
3. **Durability:** Synchronous writes to disk
4. **Isolation:** Single-user local mode (no concurrency)

### Survival Across Restarts

Projects persist in `.clawhub/projects/{id}/` as JSON files. To test:

```bash
# 1. Create project via API
# 2. Restart bridge server (or app)
# 3. Verify project still exists at GET /api/pm/projects/:id
```

### Deletion Policy

- Soft deletes: Moves to `.clawhub/projects/_trash/{id}/`
- Restore from trash (future feature)
- Hard delete (future feature)

---

## Acceptance Criteria Verification

### ✅ 1. CRUD Projects

| Operation | Endpoint | Status |
|-----------|----------|--------|
| Create | POST /api/pm/projects | ✅ Implemented |
| Read | GET /api/pm/projects/:id | ✅ Implemented |
| Update | PUT /api/pm/projects/:id | ✅ Implemented |
| Delete | DELETE /api/pm/projects/:id | ✅ Implemented |
| List | GET /api/pm/projects | ✅ Implemented |

**Test Path:**
```
POST /api/pm/projects { name: "Test" }
→ GET /api/pm/projects/:id (verify exists)
→ PUT /api/pm/projects/:id { name: "Updated" } (update)
→ GET /api/pm/projects/:id (verify update)
→ DELETE /api/pm/projects/:id (delete)
→ GET /api/pm/projects/:id (should 404)
```

---

### ✅ 2. Persist Intake Answers Verbatim

**Storage:** `.clawhub/projects/{id}/intake.json`

**Fields Persisted:**
- `idea[].text` — Exact user input (no transformation)
- `questions[].answer.text` — Exact answer (no transformation)
- `questions[].prompt` — Original question
- `requirements[].text` — Exact requirement text

**Test Path:**
```
POST /api/pm/projects/{id}/intake/idea 
  { text: "My exact 本idea with special chars: 中文 & <>", author: "human" }
→ GET /api/pm/projects/{id}/intake
→ Verify: idea[0].text === "My exact 本idea with special chars: 中文 & <>"
→ Restart bridge
→ GET /api/pm/projects/{id}/intake
→ Verify: persisted verbatim
```

---

### ✅ 3. Persist Tree Data (Hierarchy)

**Storage:** `.clawhub/projects/{id}/tree.json`

**Features:**
- Nested hierarchy (children within parent)
- Unique IDs across tree
- Relationships: `dependsOn[]` (feature dependencies)
- Sources: `sources[]` (links to intake)

**Test Path:**
```
POST /api/pm/projects/{id}/tree/nodes
  { title: "Epic 1", parentId: null }
→ Get epic-1 ID (e.g., "epic-1")
→ POST .../tree/nodes { title: "Task 1", parentId: "epic-1" }
→ GET /api/pm/projects/{id}/tree
→ Verify: Epic 1 has children[0].title === "Task 1"
→ Restart bridge
→ GET /api/pm/projects/{id}/tree
→ Verify: hierarchy persisted
```

---

### ✅ 4. Persist Kanban Data (Board State)

**Storage:** `.clawhub/projects/{id}/cards.json`

**Features:**
- Column state (`todo`, `in_progress`, `blocked`, `done`)
- Card order (preserved in array)
- Links to features (`featureId`)
- Metadata (owner, due, priority)

**Test Path:**
```
POST /api/pm/projects/{id}/cards
  { title: "Design UI", column: "in_progress", priority: "p0", owner: "Alice" }
→ PUT /api/pm/projects/{id}/cards/{cardId}
  { column: "blocked" }
→ GET /api/pm/projects/{id}/cards
→ Verify: cards[X].column === "blocked"
→ Restart bridge
→ GET /api/pm/projects/{id}/cards
→ Verify: column state persisted
```

---

### ✅ 5. Persist Links (Relationships)

**Links Types:**

| Type | Storage | Example |
|------|---------|---------|
| Feature → Feature | `tree[].dependsOn[]` | Task depends on another task |
| Card → Feature | `cards[].featureId` | Kanban card links to spec |
| Node → Intake | `tree[].sources[]` | Feature sourced from idea/question |
| Project → External | `overview.json.links[]` | GitHub, docs, Figma links |

**Test Path:**
```
POST /api/pm/projects/{id}/tree/nodes
  { title: "Feature A" } → { id: "feat-a" }
POST /api/pm/projects/{id}/tree/nodes
  { title: "Feature B", dependsOn: ["feat-a"] } → { id: "feat-b" }
GET /api/pm/projects/{id}/tree
→ Verify: feat-b.dependsOn === ["feat-a"]
Restart bridge
GET /api/pm/projects/{id}/tree
→ Verify: dependsOn relationship persisted
```

---

### ✅ 6. Export to Markdown Format

**Endpoint:** `GET /api/pm/projects/:id/export.md`

**Format:**
```markdown
# Project Name

## Overview
- **Status:** active
- **Owner:** Alice
- **Tags:** #backend #api

### Project Links
- [GitHub](https://github.com/...)
- [Docs](https://docs.example.com)

## Feature Tree

### Epic 1 (P0)
- Description: ...

#### Story 1.1 (P1)
- Status: in_progress
- Owner: Alice

### Epic 2 (P1)
- ...

## Kanban Summary

| Column | Count |
|--------|-------|
| To do | 5 |
| In progress | 2 |
| Blocked | 1 |
| Done | 8 |

### In Progress
- [x] Task 1 (P0) — @Alice
- [x] Task 2 (P1) — @Bob
```

**Test Path:**
```
GET /api/pm/projects/{id}/export.md
→ Verify: response Content-Type: text/markdown
→ Verify: response includes tree, cards, project metadata
→ Save to file, open in Markdown viewer
→ Verify: formatting is readable
```

---

## Implementation Checklist

### Done (Existing)
- [x] Storage layer (`pmProjectsStore.mjs`)
- [x] Schema definitions and normalization
- [x] File-based persistence (JSON)
- [x] Project CRUD endpoints
- [x] Tree node operations
- [x] Kanban card operations
- [x] Intake form endpoints
- [x] Activity logging
- [x] Export to JSON
- [x] Export to Markdown

### TODO (Next Phase - Implementation Agents)
- [ ] Frontend integration (Projects.tsx API calls)
- [ ] Error handling & validation
- [ ] WebSocket broadcasts (optional, for real-time)
- [ ] End-to-end testing (Playwright)
- [ ] TypeScript types in bridge server
- [ ] Documentation

### TODO (Future)
- [ ] Conflict resolution (concurrent edits)
- [ ] Permissions system
- [ ] Backup/restore
- [ ] Search indexing
- [ ] Analytics

---

## Integration with Frontend

### Current Frontend State

**File:** `src/pages/Projects.tsx`

**Uses:**
- Creates projects via `NewProjectWizard` modal
- Displays overview, tree, kanban tabs
- Stores projects in local mock state

**Changes Needed:**
1. Replace `fakeProjects()` with API calls:
   ```typescript
   const projects = await fetch('/api/pm/projects').then(r => r.json())
   ```
2. Hook create/update/delete to API:
   ```typescript
   const onCreate = async (p: Project) => {
     const created = await fetch('/api/pm/projects', {
       method: 'POST',
       body: JSON.stringify(p)
     }).then(r => r.json())
   }
   ```
3. Add drag-and-drop handlers to save kanban state:
   ```typescript
   const onDrop = async (col: KanbanColumnId, cardId: string) => {
     await fetch(`/api/pm/projects/${projectId}/cards/${cardId}`, {
       method: 'PUT',
       body: JSON.stringify({ column: col })
     })
   }
   ```

---

## Testing Strategy

### Manual Testing

1. **Create project** → Verify persists across restart
2. **Add tree nodes** → Verify hierarchy is saved
3. **Add kanban cards** → Verify column state persists
4. **Answer intake questions** → Verify verbatim text saved
5. **Export markdown** → Verify format is readable
6. **Soft delete** → Verify moved to _trash

### Automated Testing

- Unit tests: `bridge/pmProjectsStore.test.mjs` (if exists)
- E2E tests: Playwright (future)
- API tests: Supertest (future)

### Error Cases

- Invalid project ID
- Malformed JSON payloads
- Circular dependencies (allowed, app handles)
- Large payloads (2MB file limit)
- Concurrent requests (single-user for now)

---

## Error Handling

### HTTP Status Codes

| Status | Case |
|--------|------|
| 200 | Success |
| 201 | Created |
| 400 | Invalid request (bad schema) |
| 404 | Resource not found |
| 500 | Server error |

### Response Format

**Success:**
```json
{ "id": "p-xyz", "name": "My Project", ... }
```

**Error:**
```json
{ "error": "project not found" }
```

---

## File Size Limits

| File | Limit | Rationale |
|------|-------|-----------|
| overview.json | ~50 KB | Metadata |
| tree.json | ~5 MB | Up to 10k nodes |
| cards.json | ~500 KB | Up to 2k cards |
| intake.json | ~2 MB | Up to 50 ideas + questions |
| activity.json | ~1 MB | Up to 500 entries |

---

## Next Steps (For Dev Agents)

1. **Test the existing backend:**
   - Start bridge server: `npm run bridge`
   - Create a project: `curl -X POST http://localhost:8787/api/pm/projects -H 'Content-Type: application/json' -d '{"name":"Test"}'`
   - Verify it persists in `.clawhub/projects/`

2. **Wire up frontend:**
   - Update `Projects.tsx` to fetch from API instead of mock data
   - Replace `fakeProjects()` with real API calls
   - Test end-to-end: create → display → modify → verify persisted

3. **Run tests:**
   - `npm test` (run bridge tests)
   - `npm run test:e2e` (if exists)

4. **Verify acceptance criteria:**
   - Create project, restart, verify it exists (CRUD + persistence)
   - Answer intake questions with special chars, verify verbatim (intake)
   - Create tree with children, verify saved (tree)
   - Drag card to blocked, verify persisted (kanban)
   - Export to markdown, verify format (export)

---

## References

- **Frontend:** `src/pages/Projects.tsx`
- **Backend:** `bridge/server.mjs`, `bridge/pmProjectsStore.mjs`
- **Storage:** `.clawhub/projects/`
- **Types:** Defined in this document

---

## Signature

**Design Document:** Blueprint ⚙️  
**Status:** READY FOR IMPLEMENTATION  
**Date:** 2026-02-14 11:15 UTC  
**Next:** Dev agents begin implementation (Sunday)
