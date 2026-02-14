# Agent Heartbeat Checklist

## Heartbeat Schedule

This file is a template for agent heartbeat workflows. Copy it to your agent workspace as `HEARTBEAT.md` and follow it on a regular schedule (typically every 15 minutes via cron).

## Heartbeat Sequence

### 1. Check for New Tasks
```bash
claw check
```

**Expected Output:**
- Number of queued tasks
- Number of tasks assigned to you
- Number of notifications

### 2. List Queued Tasks
```bash
claw tasks --status queued
```

**Review the output:**
- Identify highest priority task (P0 > P1 > P2 > P3)
- Check if any match your roles
- Verify you have capacity (workload < max concurrent tasks)

### 3. Pick a Task (If Available)
```bash
claw task:start <task-id>
```

**Replace `<task-id>` with the actual task ID from step 2.**

**This marks you as:**
- Working on the task
- Updates your status to "busy"
- Reserves the task for you

### 4. Work on the Task

Focus on completing the task:
- Follow the task description and requirements
- Use your domain expertise
- Log time periodically: `claw task:time <task-id> 1.5 "Working on implementation"`
- Add comments as needed: `claw task:comment <task-id> "Completed unit tests"`

### 5. Complete the Task
```bash
claw task:done <task-id>
```

**This:**
- Marks the task as complete
- Updates your status back to "online"
- Unblocks any dependent tasks
- Sends notifications to relevant parties

### 6. Loop Back

If there are more tasks:
- Go back to step 2
- Repeat until no more queued tasks

If no tasks remain:
- Update status to "online"
- Wait for next heartbeat cycle
- Reply `HEARTBEAT_OK`

## Environment Setup

For the claw CLI commands to work, you need:

1. **Bridge URL Configuration**
   ```bash
   export BRIDGE_URL=http://localhost:8787
   ```

2. **Agent ID Configuration**
   ```bash
   export AGENT_ID=$(cat .claw/agent-id.txt)
   ```

3. **Workspace Directory**
   Your workspace should have `.claw/config.json`:
   ```json
   {
     "bridgeUrl": "http://localhost:8787",
     "agentId": "YOUR_AGENT_ID",
     "workspace": "/path/to/workspace"
   }
   ```

## Task Pickup Strategy

**Priority Order (in recommended order):**

1. **P0 tasks** - Critical, unblocked
2. **P1 tasks** - Important, unblocked
3. **High-value P2** - Significant progress toward goals
4. **P3 tasks** - Low priority, pick if lightweight

**Blocking Strategy:**
- Never pick a task that depends on incomplete tasks
- Check the `dependsOn` field in task details
- Blocked tasks show a ⛔ indicator

**Workload Strategy:**
- Pick tasks to keep 2-3 concurrent at once
- Avoid overload (> 4 concurrent)
- Prefer completing tasks over accumulating
- Track estimated vs actual hours

## Heartbeat States

### HEARTBEAT_OK
All tasks done, no new assignments needed. Reply with:
```
HEARTBEAT_OK
```

### HEARTBEAT_PICKED_TASK
You picked a new task. Reply with task details:
```
🎯 Picked: {task-id} - {task-title}
⏱️  Estimated: {hours}h
🎬 Starting work...
```

### HEARTBEAT_WORKING
You're still working on tasks. Report progress:
```
⏳ Working on: {task-id}
✅ Progress: {x}% complete
⏱️  Time logged: {hours}h
```

### HEARTBEAT_ERROR
Something went wrong. Report it:
```
❌ Error: {description}
📋 Details: {error-details}
⚠️  Action needed: {what-to-do}
```

## Monitoring Heartbeat Health

**The system watches for:**
- Missed heartbeats (> 5 minutes = agent offline)
- Stale tasks (in progress > estimated + 50%)
- Failing agents (repeated errors)

**If your heartbeat is late:**
- Bridge marks you "offline" after 5 minutes
- Your tasks become unassigned
- Other agents can pick them up

**Best Practice:**
- Heartbeat on schedule (don't skip)
- Report blockers immediately
- Keep tasks < 8 hours to estimate
- Log time regularly

## Quick Reference

**Useful claw commands:**
```bash
claw check                          # Check status
claw tasks --status queued          # List queued tasks
claw tasks --assigned-to $AGENT_ID  # Your tasks
claw task:start <id>                # Pick a task
claw task:done <id>                 # Complete task
claw task:comment <id> "msg"        # Add note
claw task:time <id> 2.5 "work desc" # Log time
claw task:info <id>                 # Task details
claw notifications --unread         # Unread messages
```

**Example workflow:**
```bash
# 1. Check status
claw check

# 2. Find best task
claw tasks --status queued | grep "P0"

# 3. Start working
claw task:start task-abc123

# 4. Log progress every hour
claw task:time task-abc123 1.0 "Implemented feature"

# 5. Done!
claw task:done task-abc123
```

## Troubleshooting

**"claw: command not found"**
- Make sure you're in the workspace directory
- Check `~/.openclaw/workspace` exists
- Verify node_modules is installed: `npm install`

**"Bridge connection refused"**
- Check bridge is running: `curl http://localhost:8787/api/agents`
- Verify BRIDGE_URL env var is correct
- Check firewall/network access

**"Task not found"**
- Refresh task list: `claw tasks --status queued`
- Check task ID is correct
- Task may have been deleted or reassigned

**"Heartbeat timed out"**
- Check network connectivity
- Verify bridge is responding
- Try again in a few moments

## Notes

- Keep your workspace `.claw/config.json` synchronized
- Always log time when switching tasks
- Add comments for blockers or questions
- Update status promptly on changes
