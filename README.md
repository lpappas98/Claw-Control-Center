# Claw Control Center

Web-based control center for managing OpenClaw instances and operations.

## Features

- **Mission Control**: View connected OpenClaw instances with real-time status
- **Tasks**: Manage tasks across all connected instances
- **Projects**: PM Projects with tree view, kanban boards, and feature-level intake
- **Activity**: Filterable activity feed across all operations
- **Connect**: Token-based connection flow for OpenClaw instances

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Firebase (Firestore + Cloud Functions + Hosting + Auth)
- **Deployment**: Automated via GitHub Actions → Firebase Hosting

## Live Site

🌐 **https://claw-control-center.web.app**

## Local Development

### 1) Install dependencies

```bash
npm install
```

### 2) Start dev server

```bash
npm run dev
```

Open the URL printed by Vite (usually `http://localhost:5173`).

### 3) Preview production build

```bash
npm run build
npm run preview
```

## Firebase Setup

The project uses Firebase for:
- **Firestore**: Data storage (tasks, projects, activity, connections)
- **Cloud Functions**: API layer for secure operations
- **Firebase Auth**: Google OAuth authentication
- **Hosting**: Static site hosting

Firebase project: `claw-control-center`

## Cloud Functions

API endpoints for OpenClaw instance connections:

- `POST /connect` - Validate token and establish connection
- `POST /heartbeat` - Update instance status
- `POST /disconnect` - Remove connection
- `GET /getTasks` - Fetch user tasks
- `POST /createTask` - Create new task
- `PATCH /updateTask` - Update existing task
- `GET /getProjects` - Fetch user projects
- `POST /logActivity` - Log activity event
- `POST /migrate` - Migrate legacy data

See `functions/src/index.ts` for implementation.

## OpenClaw Client

The `openclaw-client/` directory contains the connection library for OpenClaw instances.

**Usage:**
```typescript
import { connectToControlCenter, sendHeartbeat } from './openclaw-client/connection'

// Connect with code from Control Center
const result = await connectToControlCenter('CODE123', 'My Instance', {
  version: '1.0.0',
  os: 'Linux',
  node: 'v22.0.0'
})

if (result.success) {
  // Start heartbeat
  setInterval(() => sendHeartbeat(result.instanceId!), 60000)
}
```

## Operator Hub Workers

The Operator Hub uses autonomous worker processes to execute tasks. See **[WORKERS.md](WORKERS.md)** for detailed documentation.

**Quick Start:**
```bash
npm run workers         # Start all 5 workers
npm run workers:stop    # Stop all workers
npm run workers:logs    # View all worker logs
```

Workers:
- **pm** - Project Manager
- **architect** - System Architect
- **dev-1** - Developer 1
- **dev-2** - Developer 2
- **qa** - Quality Assurance

## Documentation

- **[Worker Management](WORKERS.md)** - Worker startup, monitoring, and troubleshooting
- **[Operator Guide](docs/OPERATOR_GUIDE.md)** - How to use the Control Center
- **[Operator Manual](docs/OPERATOR_MANUAL.md)** - Step-by-step instructions
- **[Operators Overview](docs/OPERATORS.md)** - What operators can do
- **[Deployment](docs/DEPLOY.md)** - Deployment procedures
- **[Runbook](docs/RUNBOOK.md)** - Troubleshooting and operations

## Build / Lint / Test

```bash
npm run lint          # Run ESLint
npm run test          # Run tests
npm run build         # Build for production
npm run preview       # Preview production build
```

## License

Private project - not for public distribution.
