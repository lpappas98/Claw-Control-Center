# TARS Operator Hub (local)

Single-user local operator UI for managing assistant operations.

## What it does

- **Mission Control**: system status panels (gateway/nodes/relay), worker heartbeat visualization, blockers + remediation commands, and a controls scaffold.
- **Projects**: list projects under `~/.openclaw/workspace/projects` (via optional bridge).
- **Activity**: clear, filterable activity feed.

This project is **local-only** and does **not** use Firestore.

## Run

### 1) Start the optional bridge (recommended)

The bridge runs on `http://localhost:8787` and provides `/api/*` endpoints by shelling out to `openclaw` and reading workspace files.

```bash
cd ~/.openclaw/workspace/projects/tars-operator-hub
npm install
npm run bridge
```

### 2) Start the UI

```bash
cd ~/.openclaw/workspace/projects/tars-operator-hub
npm run dev
```

Open the URL printed by Vite.

## Runbook

See [`docs/RUNBOOK.md`](docs/RUNBOOK.md) for troubleshooting and operational notes.

## Notes

- The bridge currently has **real gateway status + gateway controls**.
- Node + browser relay telemetry are scaffolded and will be wired to canonical APIs once available.
- Worker heartbeats are read from (first match):
  - `~/.openclaw/workspace/worker-heartbeats.json`
  - `~/.openclaw/workspace/.clawhub/worker-heartbeats.json`

### Demo: generate fake worker heartbeats

If you want to see worker cards light up without running real agents:

```bash
cd ~/.openclaw/workspace/projects/tars-operator-hub
npm run beats
```

This writes `~/.openclaw/workspace/.clawhub/worker-heartbeats.json` on an interval.

## Build / lint / test

```bash
npm run lint
npm run test
npm run build
```
