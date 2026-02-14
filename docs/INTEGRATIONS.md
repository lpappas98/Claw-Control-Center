# External Integrations Guide

How to integrate Claw Control Center with GitHub, Telegram, Google Calendar, and other services.

---

## Table of Contents

1. [GitHub](#github)
2. [Telegram](#telegram)
3. [Google Calendar](#google-calendar)
4. [General Integration Pattern](#general-integration-pattern)

---

## GitHub

### Overview

Link Claw tasks to GitHub issues and PRs:
- Create issue → task syncs to Claw
- Task completed → auto-link to PR
- PR merged → auto-close task

### Setup

#### 1. Create Personal Access Token

**GitHub Settings → Developer settings → Personal access tokens → Fine-grained tokens**

**Permissions needed:**
```
Repository access:
  - All repositories
  
Permissions:
  - Issues: Read & Write
  - Pull requests: Read & Write
  - Repository contents: Read
  - Webhooks: Read & Write
```

**Save token:** `ghp_...`

#### 2. Configure in Claw

```bash
curl -X POST http://localhost:8787/api/integrations/github/configure \
  -H "Content-Type: application/json" \
  -d '{
    "token": "ghp_...",
    "repo": "myorg/myrepo",
    "autoLink": true,
    "autoClose": true
  }'

# Response: 200 OK
# {
#   "status": "configured",
#   "repo": "myorg/myrepo",
#   "webhook": "http://localhost:8787/webhooks/github"
# }
```

#### 3. Add Webhook to GitHub

**GitHub Settings → Webhooks → Add webhook**

```
Payload URL: http://your-domain.com/webhooks/github
Content type: application/json
Events: Issues, Pull requests, Pushes
Active: ✓
```

### Usage

#### Create Task from Issue

```bash
# When issue created on GitHub:
# "feat: add dark mode" (#456)

# Claw automatically:
# 1. Creates task
# 2. Links to GitHub issue
# 3. Assigns based on labels

curl http://localhost:8787/api/tasks | jq '.[] | select(.githubIssue)'

# Output:
# {
#   "id": "task-123",
#   "title": "Add dark mode",
#   "githubIssue": {
#     "repo": "myorg/myrepo",
#     "number": 456,
#     "url": "https://github.com/myorg/myrepo/issues/456"
#   }
# }
```

#### Link Task to PR

```bash
# In commit message:
# "Implement dark mode (fixes claw:task-123)"

# Or manually:
curl -X PUT http://localhost:8787/api/tasks/task-123 \
  -H "Content-Type: application/json" \
  -d '{
    "githubPR": {
      "repo": "myorg/myrepo",
      "number": 789,
      "url": "https://github.com/myorg/myrepo/pull/789"
    }
  }'
```

#### Auto-Close on Merge

```bash
# When PR merged to main branch:
# Task automatically moves to "done"
# Github issue automatically closed

# You'll see in activity feed:
# "task-123 completed (PR #789 merged)"
```

### Configuration

**Config file:** `.clawhub/integrations/github.json`

```json
{
  "enabled": true,
  "token": "ghp_...",
  "repo": "myorg/myrepo",
  "autoLink": true,
  "autoClose": true,
  "labelMapping": {
    "bug": "p0",
    "enhancement": "p1",
    "documentation": "p2"
  },
  "webhook": "http://your-domain.com/webhooks/github"
}
```

### Commands

```bash
# Configure
curl -X POST http://localhost:8787/api/integrations/github/configure \
  -H "Content-Type: application/json" \
  -d '{"token": "ghp_...", "repo": "org/repo"}'

# Get status
curl http://localhost:8787/api/integrations/github/status

# Sync issues
curl -X POST http://localhost:8787/api/integrations/github/sync-issues

# Disable
curl -X POST http://localhost:8787/api/integrations/github/disable
```

---

## Telegram

### Overview

Receive task notifications and updates on Telegram:
- New task assigned → message
- Task blocked → alert
- Task completed → celebration
- Status updates → inline

### Setup

#### 1. Create Telegram Bot

**Telegram:** Talk to @BotFather

```
/start
/newbot
Name: Claw Control Center
Handle: @clawcontrolcenterbot
```

**Save token:** `123456:ABC...`

#### 2. Get Chat ID

**Option A: For personal chat**

```bash
# Forward a message from @userinfobot
# It will reply with your chat ID
# Example: 123456789
```

**Option B: For channel/group**

```bash
# Make bot admin in channel
# Post a message
# Send to bot API to get chat ID

curl "https://api.telegram.org/bot123456:ABC.../getUpdates" | jq '.result[].message.chat.id'
```

#### 3. Configure in Claw

```bash
curl -X POST http://localhost:8787/api/integrations/telegram/configure \
  -H "Content-Type: application/json" \
  -d '{
    "botToken": "123456:ABC...",
    "chatId": "-1001234567890",
    "enabled": true
  }'

# Response: 200 OK
# {"status": "configured", "chatId": "-1001234567890"}
```

#### 4. Test Connection

```bash
curl -X POST http://localhost:8787/api/integrations/telegram/test \
  -H "Content-Type: application/json" \
  -d '{
    "message": "🎯 Claw Control Center is online!"
  }'

# Check Telegram for message
```

### Usage

#### Task Assigned Notification

```
🎯 New Task Assigned

Task: Implement user authentication
Priority: P0 🔴
Assigned to: dev-1 🔧
Project: Web Dashboard

Description:
Add OAuth2 support to the API

Actions:
/view_task_123  /start_task_123  /open_browser
```

#### Task Blocked Notification

```
⛔ Task Blocked

Task: Deploy to production (task-456)
Blocked by: Security review (task-123)

Actions:
/view_task_456  /check_blocker_task_123
```

#### Task Completed Notification

```
🎉 Task Completed!

Task: Add dark mode
Completed by: pixel 🎨
Time spent: 4 hours / 6 estimated
Status: Ready for review

/view_task_789  /view_review
```

### Notification Types

**Customizable in config:**

```json
{
  "notifications": {
    "task-assigned": {
      "enabled": true,
      "template": "default"
    },
    "task-blocked": {
      "enabled": true,
      "template": "alert"
    },
    "task-completed": {
      "enabled": true,
      "template": "celebration"
    },
    "task-commented": {
      "enabled": false
    }
  }
}
```

### Configuration

**Config file:** `.clawhub/integrations/telegram.json`

```json
{
  "enabled": true,
  "botToken": "123456:ABC...",
  "chatId": "-1001234567890",
  "notifications": {
    "task-assigned": true,
    "task-blocked": true,
    "task-completed": true,
    "task-commented": false
  },
  "messageFormat": "markdown"
}
```

### Commands

```bash
# Configure
curl -X POST http://localhost:8787/api/integrations/telegram/configure \
  -H "Content-Type: application/json" \
  -d '{"botToken": "...", "chatId": "...", "enabled": true}'

# Test
curl -X POST http://localhost:8787/api/integrations/telegram/test

# Get status
curl http://localhost:8787/api/integrations/telegram/status

# Send message
curl -X POST http://localhost:8787/api/integrations/telegram/send \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Test message",
    "parseMode": "markdown"
  }'

# Disable
curl -X POST http://localhost:8787/api/integrations/telegram/disable
```

---

## Google Calendar

### Overview

Sync task deadlines and time blocks to Google Calendar:
- Task deadline → calendar event
- Work blocks → reserved time
- Reminders → email 1 day before

### Setup

#### 1. Create Google Project

**Google Cloud Console:**

1. Create new project: `claw-control-center`
2. Enable APIs:
   - Google Calendar API
3. Create OAuth 2.0 credentials:
   - Type: Desktop application
   - Download JSON credentials file

**Save credentials file:** `credentials.json`

#### 2. Configure in Claw

```bash
curl -X POST http://localhost:8787/api/integrations/calendar/configure \
  -H "Content-Type: application/json" \
  -d '{
    "credentialsPath": "/path/to/credentials.json",
    "calendarId": "primary",
    "enabled": true
  }'

# Response: 200 OK
# {
#   "status": "configured",
#   "calendarId": "primary",
#   "nextSync": 1707900000000
# }
```

#### 3. Authorize (First Time)

```bash
# Browser will open for OAuth login
# Authorize Claw to access your calendar
# Credentials saved to ~/.claw/google-token.json
```

### Usage

#### Sync Task Deadlines

```bash
# Sync all tasks with deadlines
curl -X POST http://localhost:8787/api/integrations/calendar/sync

# Or sync specific project
curl -X POST http://localhost:8787/api/integrations/calendar/sync \
  -H "Content-Type: application/json" \
  -d '{"projectId": "proj-1"}'

# Response:
# {
#   "synced": 5,
#   "created": 3,
#   "updated": 2,
#   "errors": 0
# }
```

#### Block Time for Task

```bash
# Reserve 4 hours on calendar
curl -X POST http://localhost:8787/api/integrations/calendar/block-time \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "task-123",
    "hours": 4,
    "date": "2026-02-15"
  }'

# Creates calendar event:
# 2026-02-15 2:00 PM - 6:00 PM
# "task-123 - Implement auth"
```

#### Auto-Sync on Deadline Change

```bash
# When task deadline updated:
curl -X PUT http://localhost:8787/api/tasks/task-123 \
  -H "Content-Type: application/json" \
  -d '{
    "deadline": "2026-02-28"
  }'

# Calendar event automatically updates
# Notification sent: "deadline changed"
```

### Configuration

**Config file:** `.clawhub/integrations/calendar.json`

```json
{
  "enabled": true,
  "credentialsPath": "/path/to/credentials.json",
  "tokenPath": "/home/user/.claw/google-token.json",
  "calendarId": "primary",
  "autoSync": true,
  "syncInterval": 3600000,
  "eventDefaults": {
    "reminder": "1 day",
    "transparency": "busy",
    "description": "Task: {title}\nLink: {url}"
  }
}
```

### Commands

```bash
# Configure
curl -X POST http://localhost:8787/api/integrations/calendar/configure \
  -H "Content-Type: application/json" \
  -d '{"credentialsPath": "...", "calendarId": "primary"}'

# Sync now
curl -X POST http://localhost:8787/api/integrations/calendar/sync

# Block time
curl -X POST http://localhost:8787/api/integrations/calendar/block-time \
  -H "Content-Type: application/json" \
  -d '{"taskId": "task-123", "hours": 4}'

# Get status
curl http://localhost:8787/api/integrations/calendar/status

# Disable
curl -X POST http://localhost:8787/api/integrations/calendar/disable
```

---

## General Integration Pattern

### How to Add a New Integration

**Example: Slack Integration**

#### 1. Create Integration Module

**File:** `bridge/integrations/slack.mjs`

```javascript
import { EventEmitter } from 'events';

export class SlackIntegration extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.webhookUrl = config.webhookUrl;
  }

  async notify(event) {
    const message = this.formatMessage(event);
    
    const response = await fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });

    return response.ok;
  }

  formatMessage(event) {
    switch(event.type) {
      case 'task-assigned':
        return {
          text: `🎯 Task assigned: ${event.taskTitle}`,
          attachments: [{
            fields: [
              { title: 'Assigned to', value: event.agentName },
              { title: 'Priority', value: event.priority }
            ]
          }]
        };
      // ... other event types
    }
  }

  async configure(config) {
    // Validate and save config
  }

  async test() {
    // Test connection
  }
}
```

#### 2. Register in Server

**File:** `bridge/server.mjs`

```javascript
import { SlackIntegration } from './integrations/slack.mjs';

// Load integrations
const integrations = {
  slack: new SlackIntegration(config.integrations.slack)
};

// API endpoints
app.post('/api/integrations/slack/configure', (req, res) => {
  integrations.slack.configure(req.body);
  res.json({ status: 'configured' });
});

app.post('/api/integrations/slack/test', async (req, res) => {
  const result = await integrations.slack.test();
  res.json({ status: result ? 'ok' : 'failed' });
});

// Emit events
on('task:assigned', (task, agent) => {
  integrations.slack.notify({
    type: 'task-assigned',
    taskTitle: task.title,
    agentName: agent.name,
    priority: task.priority
  });
});
```

#### 3. Add Tests

**File:** `bridge/integrations/slack.test.mjs`

```javascript
import test from 'node:test';
import assert from 'node:assert';
import { SlackIntegration } from './slack.mjs';

test('Slack integration sends messages', async (t) => {
  const integration = new SlackIntegration({
    webhookUrl: 'http://localhost:3001/webhook'
  });

  const result = await integration.notify({
    type: 'task-assigned',
    taskTitle: 'Test task',
    agentName: 'test-agent',
    priority: 'P1'
  });

  assert.ok(result);
});
```

#### 4. Document

**Add to INTEGRATIONS.md:**

```markdown
## Slack

### Setup
1. Create webhook: https://api.slack.com/messaging/webhooks
2. Configure: POST /api/integrations/slack/configure
3. Test: POST /api/integrations/slack/test
```

---

## Configuration Management

### Load Integrations from Config

**File:** `.clawhub/integrations.json`

```json
{
  "github": {
    "enabled": true,
    "token": "ghp_...",
    "repo": "org/repo"
  },
  "telegram": {
    "enabled": true,
    "botToken": "123456:ABC...",
    "chatId": "-1001234567890"
  },
  "calendar": {
    "enabled": true,
    "credentialsPath": "/path/to/credentials.json"
  },
  "slack": {
    "enabled": false,
    "webhookUrl": null
  }
}
```

### Environment Variables

Support sensitive values via env vars:

```bash
GITHUB_TOKEN=ghp_...
TELEGRAM_BOT_TOKEN=123456:ABC...
GOOGLE_CREDENTIALS_PATH=/path/to/credentials.json
```

**In code:**

```javascript
const config = {
  github: {
    token: process.env.GITHUB_TOKEN || config.github.token
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || config.telegram.botToken
  }
};
```

---

## Testing Integrations

### Manual Testing

```bash
# Test each integration
curl -X POST http://localhost:8787/api/integrations/github/test
curl -X POST http://localhost:8787/api/integrations/telegram/test
curl -X POST http://localhost:8787/api/integrations/calendar/test
```

### Automated Testing

```bash
npm run test -- bridge/integrations/*.test.mjs
```

### Monitoring

```bash
# Check integration status
curl http://localhost:8787/api/integrations | jq '.[] | {name, enabled, status}'

# Response:
# [
#   {"name": "github", "enabled": true, "status": "ok"},
#   {"name": "telegram", "enabled": true, "status": "ok"},
#   {"name": "calendar", "enabled": true, "status": "ok"}
# ]
```

---

## Troubleshooting

### GitHub

**"Invalid token"**
```bash
# Check token has correct permissions
# Regenerate at https://github.com/settings/tokens
```

**"Webhook not triggering"**
```bash
# Verify webhook in GitHub settings
# Check logs for errors
# Test webhook manually
```

### Telegram

**"Chat not found"**
```bash
# Get correct chat ID
curl "https://api.telegram.org/bot123456:ABC/getUpdates" | jq '.result[].message.chat.id'

# Reconfigure
curl -X POST http://localhost:8787/api/integrations/telegram/configure \
  -H "Content-Type: application/json" \
  -d '{"chatId": "123456"}'
```

**"Bot can't send messages"**
```bash
# Check bot is admin in channel
# Check chat ID is correct
# Test: curl -X POST http://localhost:8787/api/integrations/telegram/test
```

### Google Calendar

**"Permission denied"**
```bash
# Reauthorize
rm ~/.claw/google-token.json
curl -X POST http://localhost:8787/api/integrations/calendar/configure \
  -H "Content-Type: application/json" \
  -d '{"credentialsPath": "/path/to/credentials.json"}'

# Browser will open for re-auth
```

**"Sync not running"**
```bash
# Check config
curl http://localhost:8787/api/integrations/calendar/status

# Manually sync
curl -X POST http://localhost:8787/api/integrations/calendar/sync
```

---

**Last updated:** 2026-02-14

For API docs, see [API.md](API.md)  
For CLI, see [CLI_REFERENCE.md](CLI_REFERENCE.md)
