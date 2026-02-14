# Troubleshooting Guide

Common issues and solutions for Claw Control Center.

---

## Quick Diagnostics

Run these commands to check system health:

```bash
# Check bridge is running
curl http://localhost:8787/health

# Check agents
curl http://localhost:8787/api/agents | jq '.[] | {id, status}'

# Check tasks
curl http://localhost:8787/api/tasks | jq 'length'

# Check instances (multi-instance)
curl http://localhost:8787/api/instances | jq '.[] | {id: .instanceId, status}'
```

---

## Bridge Issues

### "Bridge connection refused"

**Problem:** Can't connect to bridge API

```
Error: ECONNREFUSED 127.0.0.1:8787
```

**Solutions:**

```bash
# 1. Check bridge is running
npm run bridge

# 2. Check port is available
lsof -i :8787

# 3. Kill conflicting process
kill -9 <PID>

# 4. Start bridge again
npm run bridge

# 5. Test connection
curl http://localhost:8787/health
```

### Bridge crashes on startup

**Problem:** Bridge exits immediately after starting

```
Error: ENOENT: no such file or directory, open '.clawhub/tasks.json'
```

**Solutions:**

```bash
# 1. Create .clawhub directory
mkdir -p .clawhub

# 2. Create empty data files
echo '[]' > .clawhub/agents.json
echo '[]' > .clawhub/tasks.json
echo '[]' > .clawhub/notifications.json

# 3. Start bridge again
npm run bridge
```

### High memory usage

**Problem:** Bridge consuming lots of memory

**Solutions:**

```bash
# Check tasks count
curl http://localhost:8787/api/tasks | jq 'length'

# Archive old tasks (monthly cleanup)
find .clawhub -name "*.json" -mtime +30 -archive

# Restart bridge
npm run bridge
```

---

## Agent Issues

### "Agent not found on bridge"

**Problem:** Can't see registered agent

```
Error: Agent dev-1 not found
```

**Solutions:**

```bash
# 1. Re-register agent
node scripts/register-agent.mjs \
  --agent dev-1 \
  --roles backend-dev \
  --emoji 🔧

# 2. Verify registration
curl http://localhost:8787/api/agents/dev-1

# 3. Check bridge has data
ls -la .clawhub/agents.json
cat .clawhub/agents.json | jq '.[].id'
```

### "Agent marked offline but it's running"

**Problem:** Agent shows offline even though heartbeat is active

**Causes:**
- Bridge can't reach agent's instance
- Heartbeat not running
- Network connectivity issue

**Solutions:**

```bash
# 1. Check heartbeat is configured
crontab -l | grep heartbeat

# 2. Test manual heartbeat
cd ~/.openclaw/agents/dev-1
node run-agent-heartbeat.mjs --agent dev-1

# 3. Check bridge connectivity
ping 100.x.x.x  # Agent's Tailscale IP (multi-instance)

# 4. Restart heartbeat
node scripts/setup-heartbeats.mjs --agent dev-1
```

### Agent can't reach bridge (multi-instance)

**Problem:** Agent on different machine can't connect to bridge

```
Error: ECONNREFUSED 100.64.xxx.xxx:8787
```

**Solutions:**

```bash
# 1. Verify Tailscale connectivity
tailscale ip -4

# 2. Ping bridge machine
ping 100.64.xxx.xxx  # Bridge IP

# 3. Check bridge is listening
lsof -i :8787  # On bridge machine

# 4. Update bridge URL in agent config
cat > ~/.claw/config.json << 'EOF'
{
  "agentId": "dev-1",
  "bridgeUrl": "http://100.64.xxx.xxx:8787"
}
EOF

# 5. Test connection
curl http://100.64.xxx.xxx:8787/health
```

---

## Task Issues

### "Task not syncing between instances"

**Problem:** Tasks created on one instance don't appear on another

**Solutions:**

```bash
# 1. Verify all agents point to same bridge
curl http://bridge:8787/api/agents | jq '.[] | {id, instanceId}'

# 2. Check bridge is the single source of truth
curl http://instance-1:8787/api/tasks | jq 'length'
curl http://instance-2:8787/api/tasks | jq 'length'

# 3. Both should show same count. If not:
#    Instance 2 is running a separate bridge - WRONG!
#    Point to central bridge instead
```

### "Task stuck in 'blocked' lane"

**Problem:** Task won't move out of blocked state

```bash
# 1. Check what's blocking it
curl http://localhost:8787/api/tasks/task-123 | jq '.dependsOn'

# 2. Find blocking tasks
curl http://localhost:8787/api/tasks | \
  jq '.[] | select(.id == "task-100")'

# 3. Mark blocking task done
curl -X PUT http://localhost:8787/api/tasks/task-100 \
  -H "Content-Type: application/json" \
  -d '{"lane": "done"}'

# 4. Task should auto-unblock
curl http://localhost:8787/api/tasks/task-123 | jq '.lane'
```

### "Auto-assign not working"

**Problem:** Task auto-assign returns wrong agent

**Solutions:**

```bash
# 1. Check task
curl http://localhost:8787/api/tasks/task-123 | jq '{title, priority}'

# 2. Manually trigger auto-assign
curl -X POST http://localhost:8787/api/tasks/task-123/auto-assign

# 3. Check assignment logic
curl http://localhost:8787/api/tasks/task-123 | jq '{assignedTo, reason}'

# 4. Verify agents exist with right roles
curl http://localhost:8787/api/agents | jq '.[] | {id, roles}'

# 5. Manually assign if needed
curl -X PUT http://localhost:8787/api/tasks/task-123 \
  -H "Content-Type: application/json" \
  -d '{"assignedTo": "correct-agent"}'
```

---

## CLI Issues

### "Command not found: claw"

**Problem:** `claw` command not available

**Solutions:**

```bash
# 1. Install globally
npm link

# 2. Or run from workspace
cd /home/openclaw/.openclaw/workspace
node cli/claw.mjs --help

# 3. Check installation
which claw
npm list -g claw

# 4. Reinstall if needed
npm unlink
npm link
```

### "No configuration found"

**Problem:** `claw` can't find agent config

```
Error: Config not found at ~/.claw/config.json
```

**Solutions:**

```bash
# 1. Create config
mkdir -p ~/.claw

# 2. Copy from workspace
cp /path/to/workspace/.claw/config.json ~/.claw/

# 3. Or create manually
cat > ~/.claw/config.json << 'EOF'
{
  "agentId": "dev-1",
  "name": "Backend Developer",
  "emoji": "🔧",
  "bridgeUrl": "http://localhost:8787"
}
EOF

# 4. Verify
cat ~/.claw/config.json
```

### CLI commands slow/hanging

**Problem:** `claw` commands take long time or hang

**Solutions:**

```bash
# 1. Check bridge is responsive
curl -m 5 http://localhost:8787/health

# 2. Increase CLI timeout (in config)
cat > ~/.claw/config.json << 'EOF'
{
  "timeout": 10000,  # 10 seconds
  "agentId": "dev-1"
}
EOF

# 3. Check network connectivity
ping localhost

# 4. Try with verbose debug
DEBUG=* claw tasks
```

---

## Notification Issues

### "Not receiving task notifications"

**Problem:** Telegram/email notifications not arriving

**Solutions:**

```bash
# 1. Check integration is configured
curl http://localhost:8787/api/integrations | jq '.[] | {name, enabled}'

# 2. Test integration
curl -X POST http://localhost:8787/api/integrations/telegram/test

# 3. Check notifications queue
curl http://localhost:8787/api/agents/dev-1/notifications | jq '.[] | {type, read}'

# 4. Force notification
curl -X POST http://localhost:8787/api/notifications \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "dev-1",
    "type": "test",
    "title": "Test notification"
  }'

# 5. Check notification logs
tail -f .clawhub/notifications.log
```

### "Telegram bot not sending messages"

**Problem:** Telegram integration configured but no messages arrive

**Solutions:**

```bash
# 1. Test Telegram connection
curl -X POST http://localhost:8787/api/integrations/telegram/test \
  -H "Content-Type: application/json" \
  -d '{"message": "Test from Claw"}'

# 2. Verify bot token
curl https://api.telegram.org/bot123456:ABC/getMe

# 3. Verify chat ID
curl https://api.telegram.org/bot123456:ABC/getUpdates | \
  jq '.result[].message.chat.id'

# 4. Reconfigure with correct IDs
curl -X POST http://localhost:8787/api/integrations/telegram/configure \
  -H "Content-Type: application/json" \
  -d '{
    "botToken": "123456:ABC...",
    "chatId": "-1001234567890",
    "enabled": true
  }'
```

---

## Integration Issues

### "GitHub webhook not triggering"

**Problem:** GitHub issues don't sync to Claw

**Solutions:**

```bash
# 1. Verify webhook in GitHub settings
#    Repo → Settings → Webhooks
#    Should see requests in delivery history

# 2. Check webhook endpoint
curl -X POST http://your-domain.com/webhooks/github \
  -H "X-GitHub-Event: issues" \
  -H "Content-Type: application/json" \
  -d '{"action": "opened", "issue": {"number": 1, "title": "Test"}}'

# 3. Check bridge logs
tail -f bridge.log | grep -i github

# 4. Manually sync issues
curl -X POST http://localhost:8787/api/integrations/github/sync-issues
```

### "Google Calendar sync not working"

**Problem:** Tasks not syncing to calendar

**Solutions:**

```bash
# 1. Check credentials file exists
ls -la /path/to/credentials.json

# 2. Check token is cached
ls -la ~/.claw/google-token.json

# 3. Re-authorize
rm ~/.claw/google-token.json
curl -X POST http://localhost:8787/api/integrations/calendar/configure \
  -H "Content-Type: application/json" \
  -d '{"credentialsPath": "/path/to/credentials.json"}'

# 4. Test sync
curl -X POST http://localhost:8787/api/integrations/calendar/sync

# 5. Check logs
tail -f bridge.log | grep -i calendar
```

---

## Heartbeat Issues

### "Cron job not running"

**Problem:** Heartbeat configured but not executing

**Solutions:**

```bash
# 1. Check cron is running
systemctl status cron  # Linux
sudo launchctl list | grep cron  # macOS

# 2. List registered jobs
crontab -l | grep heartbeat

# 3. Check job logs
tail -f /var/log/cron  # Linux
log stream --predicate 'process == "cron"' | grep heartbeat  # macOS

# 4. Test job manually
cd ~/.openclaw/agents/dev-1
node run-agent-heartbeat.mjs --agent dev-1

# 5. Re-register job
node scripts/setup-heartbeats.mjs --agent dev-1
```

### "Heartbeat timeout (agent marked offline)"

**Problem:** Agent stops responding after inactivity

**Cause:** Heartbeat not sending status updates

**Solutions:**

```bash
# 1. Check heartbeat is running
crontab -l | grep dev-1

# 2. Run heartbeat manually
cd ~/.openclaw/agents/dev-1
cat HEARTBEAT.md  # Review workflow
node run-agent-heartbeat.mjs

# 3. Check network connectivity
curl http://localhost:8787/health

# 4. Update agent status
curl -X PUT http://localhost:8787/api/agents/dev-1/status \
  -H "Content-Type: application/json" \
  -d '{"status": "online"}'
```

---

## Multi-Instance Issues

### "Tailscale connection issues"

**Problem:** Machines can't reach each other via Tailscale

**Solutions:**

```bash
# 1. Check Tailscale status
sudo tailscale status

# 2. Ping other machines
ping 100.x.x.x  # Other machine's Tailscale IP

# 3. Check firewall rules
sudo tailscale acl  # View ACLs

# 4. Restart Tailscale
sudo systemctl restart tailscale

# 5. Reconnect if needed
sudo tailscale down
sudo tailscale up
```

### "Instance discovery not working"

**Problem:** Bridge can't find instances on other machines

**Solutions:**

```bash
# 1. Verify all instances point to same bridge
curl http://bridge:8787/api/agents | \
  jq '.[] | {id, instanceId}' | \
  sort | uniq

# 2. Check instance discovery
curl http://bridge:8787/api/instances | jq '.'

# 3. Check heartbeat from each instance
curl http://instance-1:8787/api/agents/agent-1 | jq '.lastHeartbeat'
curl http://instance-2:8787/api/agents/agent-6 | jq '.lastHeartbeat'

# 4. Wait for heartbeat cycle (up to 15 min)
# Then check again

# 5. Force discovery update
curl -X POST http://bridge:8787/api/instances/discover
```

---

## Performance Issues

### "Slow API responses"

**Problem:** Bridge API responding slowly

**Solutions:**

```bash
# 1. Check task count
curl http://localhost:8787/api/stats | jq '.taskCount'

# 2. Archive old completed tasks
curl -X POST http://localhost:8787/api/tasks/archive \
  -H "Content-Type: application/json" \
  -d '{"olderThan": 2592000000}'  # 30 days

# 3. Check memory usage
ps aux | grep "npm run bridge"

# 4. Restart bridge to clear memory
npm run bridge

# 5. Use pagination for large queries
curl "http://localhost:8787/api/tasks?limit=50&offset=0"
```

### "Drag-and-drop UI lag"

**Problem:** Kanban board slow to respond

**Solutions:**

```bash
# 1. Clear browser cache
# Chrome: Cmd+Shift+Delete → Clear browsing data

# 2. Check browser console for errors
# Open DevTools: F12 → Console

# 3. Check API response time
time curl http://localhost:8787/api/tasks | jq 'length'

# 4. Reduce data load in UI
Filter tasks: assignee, project, priority

# 5. Restart UI
npm run dev
```

---

## Getting Help

### Debug Mode

Enable verbose logging:

```bash
# Bridge
DEBUG=* npm run bridge

# CLI
DEBUG=* claw tasks

# UI (browser console)
# Open DevTools → Console
```

### Collect Diagnostics

```bash
# Create diagnostic bundle
mkdir -p ~/claw-diagnostics
cp .clawhub/*.json ~/claw-diagnostics/
curl http://localhost:8787/api/agents > ~/claw-diagnostics/agents.json
curl http://localhost:8787/api/tasks > ~/claw-diagnostics/tasks.json
curl http://localhost:8787/api/instances > ~/claw-diagnostics/instances.json
ps aux | grep node > ~/claw-diagnostics/processes.log
crontab -l > ~/claw-diagnostics/crontab.log

# Share folder with support
zip -r ~/claw-diagnostics.zip ~/claw-diagnostics
```

### Common Error Messages

| Error | Cause | Fix |
|-------|-------|-----|
| ECONNREFUSED | Bridge not running | `npm run bridge` |
| ENOENT: agents.json | Missing data files | `mkdir -p .clawhub` |
| Task not found | Invalid ID | `curl http://localhost:8787/api/tasks` |
| Agent offline | No heartbeat | `node scripts/setup-heartbeats.mjs` |
| ETIMEOUT | Network issue | Check Tailscale/connectivity |

---

**Last updated:** 2026-02-14

For more help:
- [README.md](../README.md) - Overview and quick start
- [API.md](API.md) - API reference
- [CLI_REFERENCE.md](CLI_REFERENCE.md) - CLI commands
- [AGENT_SETUP.md](AGENT_SETUP.md) - Agent configuration
