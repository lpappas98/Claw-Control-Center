# Coding Standards - Claw Control Center

## ⚠️ CRITICAL: Inline Styles Only (No Tailwind Classes)

This project has Tailwind CSS v4 installed but with a v3-format config file. **Tailwind utility classes do NOT compile.** All styling MUST use inline React styles.

### ❌ WRONG (will not render)
```tsx
<div className="bg-slate-900 rounded-2xl p-4 text-white">
```

### ✅ CORRECT
```tsx
<div style={{ background: '#0f172a', borderRadius: 16, padding: 16, color: '#fff' }}>
```

## CSS Gotchas (Bugs That Have Bitten Us)

### 1. Never use `inset: '50%'` for centering
**Bug:** `inset: '50%'` sets ALL four sides (top/right/bottom/left) to 50%, collapsing the element to 0×0 size. Modal renders invisible.

**Wrong:**
```tsx
{ position: 'fixed', inset: '50%', transform: 'translate(-50%, -50%)' }
```

**Correct:**
```tsx
{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 'min(90vw, 560px)' }
```

### 2. Always set explicit width on centered modals
Modals positioned with `top/left: 50% + translate` need an explicit `width` — they won't auto-size.

### 3. Color reference (Tailwind equivalents)
```
slate-900: #0f172a    slate-800: #1e293b    slate-700: #334155
slate-600: #475569    slate-500: #64748b    slate-400: #94a3b8
slate-300: #cbd5e1    slate-200: #e2e8f0    slate-100: #f1f5f9
red-400: #f87171      orange-400: #fb923c   yellow-400: #facc15
green-400: #4ade80    blue-400: #60a5fa     purple-400: #a78bfa
```

## Test Task Naming & Cleanup (CRITICAL)

**⚠️ NEVER delete tasks from done/review lanes accidentally!**

### Creating Test Tasks
Always prefix test task titles with `TEMP-TEST:` for easy identification:

```bash
# ✅ CORRECT
curl -X POST http://localhost:8787/api/tasks -H "Content-Type: application/json" \
  -d '{"title":"TEMP-TEST: Nav item 1","lane":"queued","priority":"P3"}'
```

```bash
# ❌ WRONG (no prefix - risk of confusion with real tasks)
curl -X POST http://localhost:8787/api/tasks -H "Content-Type: application/json" \
  -d '{"title":"Test navigation","lane":"queued","priority":"P3"}'
```

### Deleting Test Tasks
Use an exact pattern match to delete ONLY tasks with the `TEMP-TEST:` prefix:

```bash
# ✅ CORRECT (safe - only deletes TEMP-TEST tasks)
curl -s http://localhost:8787/api/tasks | \
  python3 -c "import sys,json; [print(t['id']) for t in json.load(sys.stdin) if 'TEMP-TEST:' in t.get('title','')]" | \
  xargs -I {} curl -X DELETE http://localhost:8787/api/tasks/{}
```

```bash
# ❌ WRONG (dangerous - could delete real tasks with 'test' in title)
curl -s http://localhost:8787/api/tasks | grep -i test | delete
```

**NEVER:**
- Use broad patterns like `grep -i "test"` or `grep -i "nav"` — these match real task titles
- Delete tasks from done/review lanes unless explicitly instructed
- Delete tasks by lane (always filter by exact title prefix)

## Agent Verification Checklist

Before submitting UI work, agents MUST verify:

1. **Build passes:** `npm run build` with 0 errors
2. **Docker deploy:** Full rebuild cycle (clear vite cache → build → docker build → rm+run)
3. **Visual verification:** Create test tasks with `TEMP-TEST:` prefix, verify UI works
4. **Cleanup:** Delete ONLY `TEMP-TEST:` prefixed tasks using exact pattern match
5. **No invisible elements:** Check that modals/overlays actually render visible content (not just backdrop)
6. **No Tailwind classes:** `grep -c "className" <file>` must be 0 for new components

## Docker Rebuild Command (Copy-Paste)

```bash
cd /home/openclaw/.openclaw/workspace
rm -rf dist node_modules/.vite
npm run build
docker build --no-cache -t claw-ui:latest -f docker/Dockerfile.ui .
docker rm -f claw-ui
docker run -d --name claw-ui --network claw-net -p 5173:3000 claw-ui:latest
```

## Git Workflow

- Branch: `feature/clean-repo`
- Commit immediately after work
- Push immediately after commit
- Use descriptive commit messages: `feat:`, `fix:`, `refactor:`
