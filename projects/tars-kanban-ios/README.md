# TARS Kanban iOS App (MVP)

Goal: A lightweight iOS Kanban board where TARS can propose tasks and you can triage/approve them.

## Reality check (build environment)
This Mac is on macOS 12.7.4 and does not have Xcode (`xcodebuild` missing). Modern iOS development typically needs:
- macOS 14+ (Sonoma) for current Xcode
- Xcode 15/16

So tonight we can produce: product spec + data model + API contract + SwiftUI skeleton code.
To actually run on device/simulator, we’ll need a newer Mac/Xcode environment.

## MVP scope
- Local-first Kanban:
  - Boards → Columns → Cards
  - drag/drop cards between columns
  - reorder cards within a column
- Card detail view:
  - description
  - attachments (text artifacts like a Jira story draft)
  - status: proposed / queued / in-progress / blocked / done / cancelled
- Approvals:
  - “Approve” / “Reject” on an artifact (e.g., Jira story draft text)

## Sync (phase 2)
- Connect to OpenClaw over Tailscale URL:
  - Gateway UI: /openclaw
  - HA proxy: /ha
- Add a small backend service later (recommended) for:
  - auth
  - push updates
  - durable task store

See docs in this folder:
- PRD.md
- DATA_MODEL.md
- API_CONTRACT.md
- UI_FLOW.md
- BACKLOG.md
