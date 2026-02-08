# API Contract (Phase 2 — sync with TARS)

Recommendation: introduce a small backend (could run on your Ubuntu box later) instead of talking to OpenClaw directly.
Reason: OpenClaw is a gateway/agent runtime; a task store needs stable auth, versioning, and push.

## Minimal endpoints

### Auth
- POST /v1/auth/device-code  (optional)

### Boards
- GET /v1/boards
- POST /v1/boards

### Columns
- GET /v1/boards/{boardId}/columns
- POST /v1/boards/{boardId}/columns

### Cards
- GET /v1/boards/{boardId}/cards
- POST /v1/boards/{boardId}/cards
- PATCH /v1/cards/{cardId}  (move column, reorder, status)

### Artifacts
- GET /v1/cards/{cardId}/artifacts
- POST /v1/cards/{cardId}/artifacts
- POST /v1/artifacts/{artifactId}/approve
- POST /v1/artifacts/{artifactId}/reject

## Events (nice-to-have)
- WebSocket /v1/events for real-time updates.

## Agent integration behavior
- Agent can propose cards + artifacts.
- Agent must not execute external actions until an artifact is approved.
