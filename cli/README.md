# Claw CLI

Command-line interface for OpenClaw agents to interact with Claw Control Center.

## Installation

```bash
cd /home/openclaw/.openclaw/workspace/cli
npm install
npm link  # Makes 'claw' available globally
```

## Quick Start

```bash
# Authenticate
claw auth --url http://localhost:8787 --agent your-agent-id

# Check who you are
claw whoami

# Check for notifications
claw check

# List your tasks
claw tasks

# View task details
claw task:view task-123

# Start working on a task (starts timer)
claw task:start task-123

# Stop working (logs time)
claw task:stop task-123

# View time entries for a task
claw task:time task-123

# Manually log time
claw task:log task-123 2.5 "Completed implementation"

# Mark task as done
claw task:done task-123
```

## Commands

### Authentication

```bash
claw auth [--url <bridge-url>] [--agent <agent-id>]
```

Authenticates with Claw Control Center and saves credentials to `~/.claw/config.json`.

Options:
- `--url` - Bridge API URL (default: http://localhost:8787)
- `--agent` - Your agent ID (default: $CLAW_AGENT_ID or 'unknown')

### Identity

```bash
claw whoami
```

Shows your current agent identity, roles, and status.

### Notifications

```bash
claw check
```

Checks for new unread notifications.

### Tasks

```bash
# List tasks
claw tasks [--status <status>] [--all]

# View task details
claw task:view <task-id>

# Start working (starts timer)
claw task:start <task-id>

# Stop working (logs time)
claw task:stop <task-id>

# Manually log time
claw task:log <task-id> <hours> [note]

# View time entries
claw task:time <task-id>

# Update status
claw task:status <task-id> <status>

# Add comment
claw task:comment <task-id> <text>

# Mark done (moves to review)
claw task:done <task-id>
```

Status values: `queued`, `development`, `review`, `blocked`, `done`

### Projects

```bash
claw project:view <project-id>
```

Shows project details and task breakdown.

## Configuration

Config file: `~/.claw/config.json`

```json
{
  "bridgeUrl": "http://localhost:8787",
  "agentId": "dev-agent"
}
```

Timer file: `~/.claw/timer.json`

```json
{
  "task-123": {
    "taskId": "task-123",
    "agentId": "dev-agent",
    "startTime": 1234567890
  }
}
```

## Environment Variables

- `CLAW_AGENT_ID` - Default agent ID for authentication

## Usage in Agent Workflows

Add to your agent's `HEARTBEAT.md`:

```markdown
# HEARTBEAT.md

1. Check for new tasks: `claw check`
2. If tasks exist, view details: `claw task:view <id>`
3. Start working: `claw task:start <id>`
4. Update when done: `claw task:done <id>`
5. If nothing, reply HEARTBEAT_OK
```

## Examples

### Daily workflow

```bash
# Morning: Check what's assigned to you
claw check
claw tasks

# Start working on a task
claw task:view task-abc123
claw task:start task-abc123

# Add updates as you go
claw task:comment task-abc123 "Fixed the auth bug"

# Take a break (logs time so far)
claw task:stop task-abc123

# Resume later
claw task:start task-abc123

# Finish up
claw task:done task-abc123
```

### View workload

```bash
# See all tasks (not just yours)
claw tasks --all

# See only tasks in development
claw tasks --status development

# Check project status
claw project:view proj-123
```

## Time Tracking

### Automatic Timer

When you `claw task:start`, a local timer starts and is saved to `~/.claw/timer.json`.  
When you `claw task:stop` or `claw task:done`, elapsed time is calculated and logged to the bridge.

### Manual Time Logging

You can manually log time without using the timer:

```bash
# Log 2.5 hours for a task
claw task:log task-123 2.5

# Log with a note
claw task:log task-123 1.5 "Fixed critical bug"
```

### View Time Entries

```bash
# See all time logged for a task
claw task:time task-123
```

Shows:
- Date and time of each entry
- Agent who logged the time
- Hours worked
- Any notes added

Time entries include:
- Agent ID
- Start/end timestamps
- Hours worked (calculated)
- Optional notes

## Integration with Bridge

The CLI communicates with the Bridge API:

- `GET /api/agents/:id` - Get agent info
- `GET /api/tasks` - List tasks
- `GET /api/tasks/:id` - Get task details
- `PUT /api/tasks/:id` - Update task
- `POST /api/tasks/:id/comment` - Add comment
- `POST /api/tasks/:id/time` - Log time entry
- `GET /api/tasks/:id/time` - Get all time entries for a task
- `GET /api/agents/:id/notifications` - Get notifications

## Development

To make changes:

```bash
cd /home/openclaw/.openclaw/workspace/cli
# Edit claw.mjs
chmod +x claw.mjs
npm link  # Update global command
```

## Troubleshooting

**"Not authenticated"**
```bash
claw auth --url http://localhost:8787 --agent your-id
```

**"Could not connect to bridge"**
- Check bridge is running: `curl http://localhost:8787/health`
- Verify URL in `~/.claw/config.json`

**"No active timer for this task"**
- You must `claw task:start` before `claw task:stop`

## License

Part of OpenClaw / Claw Control Center
