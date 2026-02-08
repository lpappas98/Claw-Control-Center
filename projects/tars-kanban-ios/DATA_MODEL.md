# Data Model (MVP)

## Entities

### Board
- id: UUID
- name: String
- createdAt: Date
- updatedAt: Date

### Column
- id: UUID
- boardId: UUID
- name: String
- order: Int

### Card (Task)
- id: UUID
- boardId: UUID
- columnId: UUID
- title: String
- detail: String? (markdown)
- source: enum { tars, email, meeting, manual }
- priority: enum { p0, p1, p2, p3 }
- status: enum { proposed, queued, inProgress, blocked, done, cancelled }
- order: Int (within column)
- createdAt: Date
- updatedAt: Date

### Artifact
- id: UUID
- cardId: UUID
- type: enum { jiraStoryDraft, emailDraft, excelDraft, pptOutline, note }
- title: String
- content: String (markdown/text)
- state: enum { draft, approved, rejected }
- createdAt: Date
- updatedAt: Date

## Notes
- Local-first store can be SwiftData (iOS 17+) or CoreData (iOS 15+).
- Drag/drop updates card.columnId and reorders card.order.
