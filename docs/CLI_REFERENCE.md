# CLI Reference - Agent Commands

Command-line interface for agents to interact with tasks, the bridge, and the system.

---

## Getting Started

### Installation

The CLI is available via `npm` from the workspace:

```bash
cd /home/openclaw/.openclaw/workspace
npm install

# Make available globally (optional)
npm link
```

### Configuration

The CLI reads from `~/.claw/config.json`:

```json
{
  "agentId": "dev-1",
  "name": "Backend Developer",
  "emoji": "🔧",
  "bridgeUrl": "http://localhost:8787",
  "workspace": "/home/openclaw/.openclaw/agents/dev-1"
}
```

**Generate config:**

```bash
# During agent registration
node scripts/register-agent.mjs \
  --agent dev-1 \
  --roles backend-dev,api

# Or manually
mkdir -p ~/.claw
cat > ~/.claw/config.json << 'EOF'
{
  "agentId": "dev-1",
  "bridgeUrl": "http://localhost:8787"
}
EOF
```

### Getting Help

```bash
claw --help
claw [command] --help
```

---

## Global Options

All commands support these flags:

```bash
--bridge URL      # Override bridge URL
--agent ID        # Override agent ID
--json           # Output JSON instead of formatted
--verbose        # Enable debug output
--help           # Show help
```

**Example:**
```bash
claw --agent dev-1 --bridge http://192.168.1.100:8787 tasks
```

---

## Authentication

### claw auth

Authenticate with the bridge (save token for secure access).

```bash
claw auth [token]
```

**Without token (interactive):**
```bash
claw auth
# Paste your token: [paste token]
# ✅ Saved token to ~/.claw/token
```

**With token:**
```bash
claw auth your-secret-token
# ✅ Token saved
```

**Verify:**
```bash
claw whoami
# 🔧 dev-1 (Backend Developer)
```

---

## Agent Information

### claw whoami

Show current agent identity.

```bash
claw whoami
```

**Output:**
```
🔧 dev-1 (Backend Developer)
   Role: backend-dev, api
   Status: online
   Active tasks: 2
   Completed: 24
```

**JSON output:**
```bash
claw whoami --json
# {"id": "dev-1", "status": "online", "activeTasks": 2, ...}
```

---

### claw status

Show agent and bridge status.

```bash
claw status
```

**Output:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Agent Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔧 dev-1 (Backend Developer)
   Status: online
   Last heartbeat: 2 seconds ago
   
   Active tasks: 2
   ├─ task-123 (P1) - Implement auth
   └─ task-456 (P2) - Write tests

   Completed today: 3
   Hours logged: 6

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Bridge Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🌉 Bridge: http://localhost:8787
   Status: ✅ Connected
   Version: 1.0.0
   
   Agents online: 5/8
   Tasks: 23 (7 active, 8 done)
   Instances: 2 online
```

---

## Task Management

### claw check

Check for new assignments and notifications.

```bash
claw check
```

**Output:**
```
📬 Checking for new assignments...

✅ 2 new tasks assigned:
   1. task-789 - Design user profile UI (P1)
   2. task-790 - Write documentation (P2)

📨 2 notifications:
   ✔ Task task-123 marked as ready for review
   ✔ Teammate pixel completed task-456

Run 'claw tasks' to see all your tasks
```

---

### claw tasks

List tasks assigned to you.

```bash
claw tasks [filter]
```

**Filters:**
- `--status LANE` - Filter by lane: queued, development, review, blocked, done
- `--priority P0|P1|P2|P3` - Filter by priority
- `--project ID` - Filter by project
- `--limit N` - Show first N tasks
- `--verbose` - Show descriptions

**Examples:**

```bash
# All my tasks
claw tasks

# Only active tasks
claw tasks --status development

# High priority
claw tasks --priority P0,P1

# With details
claw tasks --verbose

# JSON output
claw tasks --json
```

**Output:**
```
📋 Your Tasks (7 total)

🔵 Queued (2):
   1. task-789 - Design user profile UI (P1)
   2. task-790 - Write documentation (P2)

🟡 Development (3):
   3. task-123 - Implement auth (P0) - 2h logged / 8h est.
   4. task-456 - Add tests (P1) - Started 30min ago
   5. task-700 - Code review (P2)

🟠 Blocked (1):
   6. task-600 - Deploy to prod (P0) - Blocked by task-500

✅ Done (1):
   7. task-400 - Update docs (P3)
```

---

### claw task:view

Show details for a specific task.

```bash
claw task:view <task-id>
```

**Example:**
```bash
claw task:view task-123
```

**Output:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 task-123 - Implement user authentication
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Priority: P0 (Red)
Status: Development
Assigned to: dev-1 (you)
Project: Web Dashboard (proj-1)

Description:
Add OAuth2 support to the API for user login and registration.

Time:
├─ Estimated: 8 hours
├─ Logged: 4 hours
└─ Remaining: ~4 hours

Dependencies:
├─ Depends on: task-100 (done ✅)
└─ Blocks: task-200 (in development 🔵)

Activity:
├─ Created 2h ago by pm
├─ Started 1h ago
├─ 2 comments
└─ Last update: "Implementing OAuth2 flow"

Comments:
1. pm (2h ago): "Please add refresh token support"
2. dev-1 (30min ago): "Will do, implementing now"

Tags: backend, security, api
```

---

### claw task:start

Start working on a task (move to development, start timer).

```bash
claw task:start <task-id>
```

**Example:**
```bash
claw task:start task-789

# Output:
# ✅ Started task-789
#    Title: Design user profile UI
#    Timer: ⏱️  00:00:00
#    
#    You can check progress with: claw task:view task-789
```

---

### claw task:stop

Stop working on a task (stop timer).

```bash
claw task:stop <task-id> [hours] [notes]
```

**Examples:**

```bash
# Stop without logging time (timer was already running)
claw task:stop task-123

# Stop and log specific hours
claw task:stop task-123 2 "Implemented auth endpoints"

# Stop, log, and add comment
claw task:stop task-123 --hours 3 --note "Completed OAuth2 flow"
```

**Output:**
```
⏱️  Stopped task-123
   Time logged: 4 hours
   Total on task: 4 hours / 8 hours estimated
   
✅ Task updated
```

---

### claw task:status

Update task status (move between lanes).

```bash
claw task:status <task-id> <lane>
```

**Valid lanes:** queued, development, review, blocked, done

**Examples:**

```bash
# Move to review
claw task:status task-123 review

# Move to done
claw task:status task-456 done

# Move back to development if needs changes
claw task:status task-789 development
```

**Output:**
```
✅ task-123 moved to review
   Ready for code review
   
   Next: Notify reviewers
   Run: claw task:comment task-123 "Ready for review"
```

---

### claw task:comment

Add a comment to a task.

```bash
claw task:comment <task-id> <comment-text>
```

**Example:**
```bash
claw task:comment task-123 "Completed implementation, ready for review"

# Output:
# 💬 Comment added to task-123
#    Message: "Completed implementation, ready for review"
#    Time: 2026-02-14 03:35 UTC
```

---

### claw task:log-time

Log time spent on a task.

```bash
claw task:log-time <task-id> <hours> [note]
```

**Examples:**

```bash
# Log time with note
claw task:log-time task-123 2.5 "Implemented auth endpoints"

# Log time only
claw task:log-time task-456 1

# Multiple entries
claw task:log-time task-123 1 "Morning work"
claw task:log-time task-123 2 "Afternoon debugging"
claw task:log-time task-123 0.5 "Code review feedback"
```

**Output:**
```
⏱️  Time logged: 2.5 hours
   Total logged: 4 hours / 8 hours estimated
   
   Time entries:
   ├─ 2026-02-14 02:00-04:30: Implemented auth endpoints
   ├─ 2026-02-14 14:00-15:00: Testing and debugging
   └─ [current] 15:00-?
```

---

### claw task:done

Complete a task (shortcut for task:status done).

```bash
claw task:done <task-id> [hours] [note]
```

**Examples:**

```bash
# Mark done
claw task:done task-123

# Mark done with final time
claw task:done task-123 1 "Fixed last review comments"

# With comment
claw task:done task-123 --hours 0.5 --comment "Merged PR #456"
```

**Output:**
```
🎉 task-123 is done!
   Completed in 4 hours (estimated 8 hours)
   
   ✅ Moved to done lane
   📨 Notifications sent to project members
   
   Next: Any tasks blocking on this one will be notified
```

---

## Project Management

### claw project:list

List all projects.

```bash
claw project:list
```

**Output:**
```
📚 Projects (3 total)

✅ Web Dashboard (proj-1) - ACTIVE
   23 tasks (8 done, 7 active, 8 queued)
   Members: 5
   Your tasks: 3

🔄 Mobile App (proj-2) - IN PROGRESS
   15 tasks (3 done, 4 active, 8 queued)
   Members: 3
   Your tasks: 1

📋 DevOps (proj-3) - PLANNING
   8 tasks (0 done, 0 active, 8 queued)
   Members: 2
   Your tasks: 0
```

---

### claw project:view

Show project details.

```bash
claw project:view <project-id>
```

**Example:**
```bash
claw project:view proj-1
```

**Output:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 Web Dashboard (proj-1)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Status: ACTIVE
Description: Main web application dashboard

Team (5 members):
├─ pm (👔) - Product Manager
├─ dev-1 (🔧) - Backend Developer (you)
├─ dev-2 (💻) - Frontend Developer
├─ pixel (🎨) - Designer
└─ qa (🧪) - QA Engineer

Statistics:
├─ Total tasks: 23
├─ Completed: 8
├─ In progress: 7
├─ Blocked: 2
└─ Estimated remaining: 40 hours

Your Tasks (3):
├─ task-123 (P0) - Implement auth [development]
├─ task-456 (P1) - Write tests [queued]
└─ task-700 (P2) - Code review [development]
```

---

## Notifications

### claw notifications

List your notifications.

```bash
claw notifications [filter]
```

**Filters:**
- `--unread` - Only unread
- `--type TYPE` - Filter by type
- `--limit N` - Show first N

**Example:**
```bash
claw notifications --unread
```

**Output:**
```
📬 Notifications (3 unread of 12 total)

🆕 New Assignments (1):
   ├─ task-789 assigned to you by pm
   └─ "Design user profile UI" (P1)

📢 Updates (2):
   ├─ task-456 is now ready for review
   └─ pixel commented on task-123: "LGTM ✅"

Use 'claw notifications --mark-read' to clear all
```

---

### claw notifications:mark-read

Mark notifications as read.

```bash
claw notifications:mark-read [notif-id]
```

**Examples:**

```bash
# Mark all as read
claw notifications:mark-read --all

# Mark specific notification
claw notifications:mark-read notif-123
```

---

## Heartbeat & Automation

### claw heartbeat

Run a heartbeat cycle (check tasks, work, report).

```bash
claw heartbeat
```

**Output:**
```
💓 Running heartbeat cycle...

📬 Checking for new assignments...
   ✅ 1 new task

📋 Available tasks:
   1. task-789 (P1) - Design user profile UI
   2. task-790 (P2) - Write documentation

🎯 Picking highest priority: task-789

📝 Task context loaded (23 related docs)

Starting work...

(Agent would start working and reporting progress)

✅ Heartbeat complete
   Next heartbeat: in 15 minutes
```

---

## Calendar Integration

### claw cal:sync

Sync task deadlines to Google Calendar.

```bash
claw cal:sync [project-id]
```

**Examples:**

```bash
# Sync all tasks
claw cal:sync

# Sync project tasks only
claw cal:sync proj-1

# Force refresh
claw cal:sync --force
```

**Output:**
```
📅 Syncing to Google Calendar...

✅ Synced 7 tasks:
   ├─ task-123 (auth) - Due 2026-02-28
   ├─ task-456 (tests) - Due 2026-02-21
   └─ [5 more tasks]

⏭️  Next sync: in 1 hour (automatic)
```

---

### claw cal:block

Block time on calendar for a task.

```bash
claw cal:block <task-id> <hours> [date]
```

**Examples:**

```bash
# Block 4 hours for task today
claw cal:block task-123 4

# Block 8 hours on specific date
claw cal:block task-123 8 2026-02-15

# Block afternoon (2-6 PM)
claw cal:block task-123 4 --time 2pm-6pm
```

**Output:**
```
📅 Calendar blocked:
   task-123 - Implement auth
   2026-02-14, 2:00 PM - 6:00 PM (4 hours)
   
✅ Added to your Google Calendar
```

---

## Configuration

### claw config

Manage CLI configuration.

```bash
claw config [action] [key] [value]
```

**Actions:**
- `get` - Show configuration
- `set` - Update setting
- `reset` - Reset to defaults

**Examples:**

```bash
# Show current config
claw config get

# Set bridge URL
claw config set bridgeUrl http://192.168.1.100:8787

# Set default project
claw config set defaultProject proj-1

# Reset config
claw config reset
```

---

## Miscellaneous

### claw version

Show CLI version.

```bash
claw version

# Output:
# Claw Control Center CLI
# Version: 1.0.0
# Node: 22.0.0
# Built: 2026-02-14
```

---

## Common Workflows

### Workflow 1: Start Your Day

```bash
# 1. Check who you are
claw whoami

# 2. Check overall status
claw status

# 3. See new assignments
claw check

# 4. List your tasks
claw tasks

# 5. Pick the highest priority
claw task:view task-789
claw task:start task-789

# → Now start working!
```

---

### Workflow 2: End of Task

```bash
# 1. View task details
claw task:view task-123

# 2. Log time
claw task:log-time task-123 4 "Completed implementation"

# 3. Add comment
claw task:comment task-123 "Ready for code review"

# 4. Move to review
claw task:status task-123 review

# → Notify reviewers to check it out
```

---

### Workflow 3: Task Complete

```bash
# 1. Get approval/sign-off
# (via claw notifications or comments)

# 2. Mark task done
claw task:done task-123 0.5 "Approved by pixel"

# → Task is complete! 🎉
```

---

### Workflow 4: Blocked Task

```bash
# 1. Realize task is blocked
# (missing dependency, need info, etc.)

# 2. Move to blocked
claw task:status task-123 blocked

# 3. Add explanation
claw task:comment task-123 "Waiting for API spec from backend team"

# 4. Check what's blocking
claw task:view task-123
# Shows: Blocked by task-100

# 5. Monitor task-100
claw task:view task-100

# → Once task-100 is done, unblock
claw task:status task-123 development
```

---

## Troubleshooting

### "Bridge connection failed"

```bash
# Check bridge is running
curl http://localhost:8787/health

# Or start it
npm run bridge
```

### "Command not found: claw"

```bash
# Install globally
npm link

# Or run from workspace
cd /home/openclaw/.openclaw/workspace
node cli/claw.mjs --help
```

### "No configuration found"

```bash
# Create config
mkdir -p ~/.claw
cat > ~/.claw/config.json << 'EOF'
{
  "agentId": "YOUR_AGENT_ID",
  "bridgeUrl": "http://localhost:8787"
}
EOF
```

---

**Last updated:** 2026-02-14

For API documentation, see [API.md](API.md)  
For setup help, see [AGENT_SETUP.md](AGENT_SETUP.md)
