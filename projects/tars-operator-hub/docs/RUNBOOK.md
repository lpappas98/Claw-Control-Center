# Operator Hub Runbook (local)

This UI is intended for **single-user local operations**.

- UI: Vite dev server (typically `http://localhost:5173`)
- Bridge (optional, recommended): `http://localhost:8787`

## Quick start

```bash
cd ~/.openclaw/workspace/projects/tars-operator-hub
npm install

# terminal 1
npm run bridge

# terminal 2
npm run dev
```

If the bridge is not running, switch the UI to **Mock** (Mission Control → Adapter).

## What the bridge does

The bridge is a small local Express server that:

- shells out to `openclaw gateway status|start|stop|restart`
- reads workspace files (ex: worker heartbeats)
- exposes a simple HTTP API for the UI

### Bridge endpoints

- `GET /healthz`
- `GET /api/status`
- `GET /api/projects`
- `GET /api/workers`
- `GET /api/blockers`
- `GET /api/activity?limit=200`
- `POST /api/control` (expects a JSON `ControlAction`)

## Troubleshooting

### UI shows “Status adapter error”

1) Verify the bridge is up:

```bash
curl -sS http://localhost:8787/healthz
```

2) If that fails, start it:

```bash
cd ~/.openclaw/workspace/projects/tars-operator-hub
npm run bridge
```

3) If you don’t want the bridge, switch to **Mock** in the UI.

### Gateway health is `down` or `unknown`

Run:

```bash
openclaw gateway status
```

Common fix:

```bash
openclaw gateway restart
```

If the CLI itself errors, confirm `openclaw` is on your PATH and that the Gateway service can start on this machine.

### Workers panel is empty

The bridge reads (first match):

- `~/.openclaw/workspace/worker-heartbeats.json`
- `~/.openclaw/workspace/.clawhub/worker-heartbeats.json`

Confirm the file exists:

```bash
ls -la ~/.openclaw/workspace
ls -la ~/.openclaw/workspace/.clawhub
```

If present but malformed, validate JSON:

```bash
node -e "JSON.parse(require('fs').readFileSync(process.env.HOME+'/.openclaw/workspace/worker-heartbeats.json','utf8')); console.log('ok')"
```

### Projects panel looks shallow

Projects are enumerated from:

- `~/.openclaw/workspace/projects/*`

When available, the bridge enriches each project with:

- git branch/dirty/ahead/behind/last commit time (when `.git/` exists)
- `package.json` name and script keys (when present)

If fields are missing, verify the project is a git repo and/or has a readable `package.json`.

## Operational notes

- **Bridge security**: this is a local tool; do not expose the bridge port publicly.
- **Polling**: the UI polls multiple endpoints; brief spikes or intermittent errors are expected during restarts.
- **Controls**: Only the Bridge adapter can execute controls; Mock is read-only.
