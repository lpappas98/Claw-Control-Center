# Coding Standards - Claw Control Center

## ⚠️ NO Tailwind CSS Classes

**All React components MUST use inline styles, NOT Tailwind utility classes.**

### Why
- We use Tailwind CSS v4 with `@tailwindcss/postcss`
- Our Docker build copies a pre-built `dist/` from the host
- Tailwind's JIT compiler does not reliably scan all component files
- Result: classes like `bg-slate-900` compile to nothing → unstyled UI in production

### Rule
Every `style` prop must use a JavaScript object. No `className` with Tailwind utilities.

```tsx
// ❌ NEVER DO THIS
<div className="bg-slate-900 text-white rounded-2xl p-6 border border-slate-700/50">

// ✅ ALWAYS DO THIS
<div style={{
  background: '#0f172a',
  color: '#fff',
  borderRadius: 16,
  padding: 24,
  border: '1px solid rgba(51,65,85,0.5)',
}}>
```

### Exceptions
- `className` is OK for shadcn/ui components (`<Button>`, `<Alert>`) since those are pre-compiled
- `className` is OK for layout classes already in `App.css`

### Color Reference
```
Background:   #080c16 (page), #0f172a (modal/panel), rgba(30,41,59,0.45) (card)
Text:         #f1f5f9 (primary), #e2e8f0 (body), #94a3b8 (muted), #64748b (dim)
Borders:      rgba(51,65,85,0.35) (subtle), rgba(30,41,59,0.55) (panel)
Accent:       #3b82f6 (blue), #10b981 (green), #f87171 (red), #fbbf24 (yellow)
Priority:     P0=#f87171, P1=#fbbf24, P2=#facc15, P3=#64748b
```

### Docker Deployment Checklist
After any UI changes:
1. `rm -rf dist node_modules/.vite` (clear Vite cache)
2. `npm run build` (fresh build on host)
3. `docker build -t claw-ui:latest -f docker/Dockerfile.ui .`
4. `docker rm -f claw-ui && docker run -d --name claw-ui --network claw-net -p 5173:3000 claw-ui:latest`
5. Verify in Playwright before reporting done
