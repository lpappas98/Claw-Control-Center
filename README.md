# Claw Control Center

Multi-agent task management system for [OpenClaw](https://github.com/openclaw/openclaw). Coordinate AI agents to work on tasks autonomously — from assignment through implementation to QA verification.

## Features

- **Kanban Task Board** — Visual task management across 5 lanes (Proposed → Queued → Development → Review → Done)
- **Agent Coordination** — 5 pre-configured agents (PM, 2 Devs, QA, Architect) with automatic task pickup
- **Real-time Activity Feed** — Track task creation, assignment, lane changes, and completions
- **Automated QA** — Sentinel agent runs Playwright tests with screenshot verification
- **Docker Deployment** — Single `docker-compose up` to run everything
- **Local-first** — All data stored on your machine in JSON files, no cloud required

## Quick Start

```bash
git clone https://github.com/your-org/Claw-Control-Center.git
cd Claw-Control-Center
npm install
docker-compose up -d
```

Open http://localhost:5173

## Architecture

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────┐
│   React UI  │────▶│  Bridge (API)   │────▶│  .clawhub/   │
│  port 5173  │     │   port 8787     │     │  JSON files  │
└─────────────┘     └─────────────────┘     └──────────────┘
                           ▲
                    ┌──────┴──────┐
                    │  OpenClaw   │
                    │  Agents     │
                    │  (via cron) │
                    └─────────────┘
```

## Agent Workflow

```
Dev Agent picks up task     Sentinel (QA) verifies
from queued lane            from review lane
        │                          │
        ▼                          ▼
   Development ──────▶ Review ──────▶ Done
        ▲                  │
        └── (QA fails) ────┘
```

- **Dev agents** (Forge, Patch): Pick up queued tasks → implement → self-verify → move to review
- **Sentinel** (QA): Pick up review tasks → Playwright tests + screenshot verification → move to done (or back to development)
- **Blueprint** (Architect): Architecture design and documentation
- **TARS** (PM): Task creation, breakdown, and coordination

## Documentation

- [Setup Guide](docs/SETUP.md) — Installation, agent configuration, and deployment
- [Coding Standards](CODING_STANDARDS.md) — Component styling rules for agents

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Node.js + Express
- **Storage**: JSON files (`.clawhub/`)
- **Deployment**: Docker + Docker Compose
- **Testing**: Playwright (E2E) + Vitest (unit)
- **Agents**: OpenClaw cron-based isolated sessions

## License

MIT
