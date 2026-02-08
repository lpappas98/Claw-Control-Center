# PRD — TARS Kanban iOS (MVP)

## Problem
Logan receives tasks from many sources (emails, meetings, ideas). They need a fast triage surface to prioritize and approve agent-generated outputs (e.g., Jira story drafts) without giving the agent permission to send messages externally.

## Goals
- A single place to see TARS-proposed tasks.
- Fast triage: reorder, move between columns, start/stop/delete.
- Artifact approval workflow (approve a Jira story draft, approve an email draft, etc.).
- Local-first so it works without constant connectivity.

## Non-goals (MVP)
- Real trading/external actions.
- Automatic sending of emails/Teams messages.
- Complex multi-user collaboration.

## Personas
- Logan (primary user): TPO, wants strict control and approvals.

## Core user stories
1. As Logan, I can create a board with columns.
2. As Logan, I can drag a task card between columns.
3. As Logan, I can reorder tasks by priority in a column.
4. As Logan, I can open a task and view artifacts (e.g., Jira story text).
5. As Logan, I can approve/reject an artifact.

## Data to display on a card
- Title
- Source (TARS / Email / Meeting / Manual)
- Priority (P0–P3)
- Status
- CreatedAt
- Optional: due date

## Safety constraints
- App must clearly indicate “Draft” vs “Executed”.
- Approvals must be explicit (no auto-execute).
- No secrets in logs.

## Success metrics
- Time to triage daily tasks < 2 minutes.
- Reduction in missed action items.
- Logan trusts the system because approvals are transparent.
