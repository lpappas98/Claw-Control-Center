# UI Flow (MVP)

## Screens
1) Boards list
- List boards
- Create board

2) Board view (Kanban)
- Horizontal scroll of columns
- Each column: vertical list of cards
- Drag card between columns
- Reorder cards within column

3) Card detail
- Title, source, priority, status
- Description (markdown)
- Artifacts list

4) Artifact detail
- Content (text/markdown)
- Buttons: Approve / Reject
- Status indicator

## Interaction rules
- Dragging a card updates column + order immediately.
- Approve/Reject requires a confirm dialog.
