# Worker Management

The Operator Hub uses 5 worker processes that autonomously pick up tasks from the queue and execute them.

## Workers

- **pm** - Project Manager (task coordination, planning)
- **architect** - System Architect (design, architecture decisions)
- **dev-1** - Developer 1 (implementation, coding)
- **dev-2** - Developer 2 (implementation, coding)
- **qa** - Quality Assurance (testing, verification)

## Quick Start

### Start All Workers

```bash
npm run workers
```

Or directly:

```bash
bash bridge/start-workers.sh
```

This will:
- Start all 5 workers as background processes
- Create log files in `logs/worker-<slot>.log`
- Save PID files in `.clawhub/pids/worker-<slot>.pid`
- Display status for each worker

### Stop All Workers

```bash
npm run workers:stop
```

Or directly:

```bash
bash bridge/stop-workers.sh
```

This will:
- Send SIGTERM to each worker (graceful shutdown)
- Wait up to 10 seconds for each worker to stop
- Force kill (SIGKILL) any workers that don't stop gracefully
- Clean up PID files

### Restart Workers

```bash
npm run workers:restart
```

### View Worker Logs

View all worker logs in real-time:

```bash
npm run workers:logs
```

Or view a specific worker:

```bash
tail -f logs/worker-pm.log
tail -f logs/worker-dev-1.log
```

## How Workers Operate

### Task Polling

Each worker:
1. Polls the task queue every **30 seconds**
2. Looks for tasks in the "queued" lane assigned to their slot
3. Prioritizes tasks: P0 > P1 > P2, then FIFO within priority
4. Claims the highest priority task by moving it to "development"

### Task Execution

When a task is claimed:
1. Worker spawns a Claude session as a subagent
2. Session receives task prompt with all details
3. Worker monitors session via heartbeat and status checks
4. On completion, task moves to "review" (success) or "blocked" (failure)
5. Worker returns to idle state and continues polling

### Heartbeats

Workers update their heartbeat every **15 seconds** in `.clawhub/worker-heartbeats.json`:

```json
{
  "workers": {
    "dev-1": {
      "slot": "dev-1",
      "status": "working",
      "task": "task-abc123",
      "taskTitle": "Implement feature X",
      "sessionId": "agent:main:subagent:dev-1-abc123",
      "lastUpdate": 1770865607214,
      "startedAt": 1770865600000,
      "metadata": {
        "workerPid": 12345,
        "workerVersion": "1.0.0",
        "restartCount": 0
      }
    }
  }
}
```

### Worker States

- **idle** - Available for new tasks, actively polling
- **working** - Currently executing a task
- **offline** - Shut down or crashed

## Checking Worker Status

### Via UI

Open the Operator Hub UI at `http://localhost:8787` and check the "Heartbeat" section.

### Via CLI

Check heartbeat file:

```bash
cat .clawhub/worker-heartbeats.json | jq .
```

Check running processes:

```bash
ps aux | grep workerService
```

Check PID files:

```bash
ls -la .clawhub/pids/
```

## Troubleshooting

### Worker won't start

Check logs:
```bash
cat logs/worker-<slot>.log
```

Check if port/file conflicts:
```bash
lsof -i :8787  # Bridge server should be running
```

### Worker stuck

Force restart a single worker:
```bash
# Find and kill the worker
pkill -f "workerService.mjs dev-1"

# Or use PID file
kill $(cat .clawhub/pids/worker-dev-1.pid)

# Start it again
node bridge/workerService.mjs dev-1 >> logs/worker-dev-1.log 2>&1 &
```

### Worker crashes repeatedly

Check logs for errors:
```bash
tail -n 100 logs/worker-<slot>.log
```

Common issues:
- Bridge server not running: `npm run bridge`
- Task API not responding: Check bridge server logs
- OpenClaw CLI not in PATH: Check `which openclaw`
- Permissions: Ensure scripts are executable

### Task timeout

Workers have a default timeout of **30 minutes** per task. If a task exceeds this:
- Worker logs timeout error
- Task moves to "blocked" lane
- Worker returns to idle and continues polling

To increase timeout, edit the task and add:
```json
{
  "timeoutMs": 7200000  // 2 hours
}
```

## Production Deployment

For production use, consider using **PM2** instead of bash scripts for:
- Automatic restart on crash
- Process monitoring
- Log rotation
- Cluster mode

### PM2 Setup (Optional)

Install PM2:
```bash
npm install -g pm2
```

Create `ecosystem.config.cjs`:
```javascript
module.exports = {
  apps: [
    {
      name: 'worker-pm',
      script: 'bridge/workerService.mjs',
      args: 'pm',
      cwd: '/home/openclaw/.openclaw/workspace',
      interpreter: 'node',
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 3000,
    },
    {
      name: 'worker-architect',
      script: 'bridge/workerService.mjs',
      args: 'architect',
      cwd: '/home/openclaw/.openclaw/workspace',
      interpreter: 'node',
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 3000,
    },
    {
      name: 'worker-dev-1',
      script: 'bridge/workerService.mjs',
      args: 'dev-1',
      cwd: '/home/openclaw/.openclaw/workspace',
      interpreter: 'node',
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 3000,
    },
    {
      name: 'worker-dev-2',
      script: 'bridge/workerService.mjs',
      args: 'dev-2',
      cwd: '/home/openclaw/.openclaw/workspace',
      interpreter: 'node',
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 3000,
    },
    {
      name: 'worker-qa',
      script: 'bridge/workerService.mjs',
      args: 'qa',
      cwd: '/home/openclaw/.openclaw/workspace',
      interpreter: 'node',
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 3000,
    },
  ],
};
```

Commands:
```bash
pm2 start ecosystem.config.cjs   # Start all workers
pm2 stop all                      # Stop all workers
pm2 restart all                   # Restart all workers
pm2 logs                          # View logs
pm2 monit                         # Monitor processes
pm2 save                          # Save process list
pm2 startup                       # Auto-start on boot
```

## Architecture

```
┌─────────────────┐
│  Task Queue     │
│  (API Server)   │
└────────┬────────┘
         │
    ┌────┴────┐ Poll every 30s
    │ Workers │
    ├─────────┤
    │   pm    │──┐
    │architect│  │
    │  dev-1  │  ├─> Heartbeat every 15s
    │  dev-2  │  │   (.clawhub/worker-heartbeats.json)
    │   qa    │──┘
    └─────────┘
         │
         │ Spawn session
         ▼
┌─────────────────┐
│ Claude Sessions │
│  (Subagents)    │
└─────────────────┘
```

## Logging

Each worker logs to its own file with timestamps:

```
[2026-02-12T03:19:45.123Z] [INFO] [dev-1] WorkerService initialized
[2026-02-12T03:19:45.456Z] [INFO] [dev-1] Starting worker service...
[2026-02-12T03:19:45.789Z] [INFO] [dev-1] Worker service started (PID: 12345)
[2026-02-12T03:20:15.123Z] [INFO] [dev-1] Found task: Implement feature X
[2026-02-12T03:20:15.456Z] [INFO] [dev-1] Spawning session for task task-abc123
```

Log files are **not** rotated automatically. Consider setting up logrotate or clearing old logs periodically:

```bash
# Clear logs older than 7 days
find logs/ -name "worker-*.log" -mtime +7 -delete
```

## Security

- Workers run as the same user as the bridge server
- Sessions spawned by workers inherit the same permissions
- Workers can read/write to the workspace directory
- Workers can execute `openclaw` CLI commands
- No external network access restrictions (workers can make API calls)

Ensure:
- Bridge server is not exposed to public internet
- Worker logs don't contain sensitive data
- Task prompts don't include secrets

## Performance

Resource usage per worker:
- **Memory**: ~100-200 MB idle, ~500 MB when running a session
- **CPU**: Minimal when idle, varies during task execution
- **Disk**: Logs grow ~1-10 MB per day depending on activity

With 5 workers:
- **Total Memory**: ~500 MB idle, ~2.5 GB under full load
- **Concurrent Tasks**: Up to 5 (one per worker)
- **Task Throughput**: Depends on task complexity, typically 5-20 tasks/hour

## See Also

- `bridge/workerService.mjs` - Worker implementation
- `bridge/server.mjs` - Task API server
- `bridge/slot-heartbeats.mjs` - Heartbeat visualization
- `.clawhub/worker-heartbeats.json` - Live worker status
