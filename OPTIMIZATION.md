# OPTIMIZATION.md — Token & Cost Discipline

## Goal
Keep responses high-signal while minimizing tokens and tool calls.

## Session Initialization (lean context)
- On session start, load ONLY: SOUL.md, USER.md, IDENTITY.md, and today’s memory/YYYY-MM-DD.md (yesterday only if needed).
- Do NOT auto-load: MEMORY.md, full session history, or large tool logs.
- When prior context is needed: use memory_search(), then memory_get() for small snippets.

## Reply Style (low-token mode)
- Prefer bullets, short paragraphs.
- Ask 3–6 questions max at a time.
- Confirm assumptions instead of exploring every branch.
- Avoid long preambles and repeated summaries.

## Tool Discipline
- Batch work (one tool call that does 10 things > 10 tool calls).
- Use web_fetch before browser automation when possible.
- Avoid repeated snapshots/search loops; stop and ask if uncertain.

## Model/Reasoning Discipline
- Default to minimal reasoning effort; only increase when needed (complex debugging, security, architecture).
