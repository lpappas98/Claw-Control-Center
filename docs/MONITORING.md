# Monitoring & Logging Guide

This guide explains how to monitor and troubleshoot the Operator Hub bridge using the structured logging, health checks, and monitoring dashboard.

## Table of Contents

1. [Structured Logging](#structured-logging)
2. [Health Check Endpoints](#health-check-endpoints)
3. [System Status Dashboard](#system-status-dashboard)
4. [Log Files](#log-files)
5. [Error Tracking](#error-tracking)
6. [Metrics & Performance](#metrics--performance)
7. [Troubleshooting](#troubleshooting)

## Structured Logging

The bridge uses Winston for structured JSON logging, enabling machine-readable logs for monitoring systems.

### Log Levels

- **debug**: Detailed debugging information, request details
- **info**: General informational messages (task creation, assignments)
- **warn**: Warning messages (failed integrations, validation issues)
- **error**: Error messages (exceptions, failures)

### Enabling Debug Logging

To see detailed debug logs, set the environment variable:

```bash
LOG_LEVEL=debug npm run bridge
```

### Log Format

Each log entry is JSON-formatted with the following structure:

```json
{
  "level": "info",
  "message": "Task created",
  "timestamp": "2026-02-14 12:34:56",
  "service": "operator-hub",
  "taskId": "task-123",
  "title": "Fix login bug",
  "priority": "P0"
}
```

## Health Check Endpoints

The bridge provides three health check endpoints for monitoring and Kubernetes integration:

### `/health` - Full System Status

Returns comprehensive system health information:

```bash
curl http://localhost:8787/health
```

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2026-02-14T12:34:56.789Z",
  "uptime": 3600,
  "version": "6.3",
  "service": "operator-hub-bridge",
  "stats": {
    "tasks": {
      "total": 42,
      "byStatus": {
        "queued": 15,
        "development": 8,
        "review": 6,
        "blocked": 2,
        "done": 11
      }
    },
    "agents": {
      "total": 5,
      "online": 4,
      "offline": 1
    },
    "errors": 0
  },
  "memory": {
    "heapUsed": 120,
    "heapTotal": 256,
    "external": 10,
    "rss": 300
  },
  "system": {
    "platform": "linux",
    "nodeVersion": "v22.22.0",
    "cpuCount": 8,
    "totalMemory": 16384,
    "freeMemory": 8192,
    "loadAverage": [0.5, 0.3, 0.2]
  },
  "integrations": {
    "github": true,
    "telegram": false,
    "googleCalendar": false
  },
  "readiness": {
    "ready": true,
    "checks": {
      "tasksFileExists": true,
      "agentsFileExists": true,
      "activityFileExists": true
    }
  }
}
```

**Use cases:**
- General system health monitoring
- Dashboard displays
- Alerting on error rates or integration failures

### `/health/ready` - Kubernetes Readiness Probe

Determines if the service is ready to accept traffic.

```bash
curl http://localhost:8787/health/ready
```

**Response (ready):**

```json
{
  "ready": true
}
```

**Response (not ready):**

```json
{
  "ready": false,
  "details": {
    "tasksFileExists": true,
    "agentsFileExists": false,
    "activityFileExists": true
  }
}
```

**HTTP Status:**
- `200 OK` - Service is ready
- `503 Service Unavailable` - Service is not ready

**Use cases:**
- Kubernetes readiness probes
- Load balancer health checks
- Container orchestration readiness gates

### `/health/live` - Kubernetes Liveness Probe

Determines if the process is still running and responsive.

```bash
curl http://localhost:8787/health/live
```

**Response:**

```json
{
  "alive": true,
  "uptime": 3600,
  "timestamp": "2026-02-14T12:34:56.789Z"
}
```

**Use cases:**
- Kubernetes liveness probes
- Process restart triggers
- Deadlock detection

## System Status Dashboard

A real-time monitoring dashboard is available in the UI under the **System Status** tab.

### Features

**Bridge Status**
- Service name and version
- Uptime
- Last update timestamp

**Agents**
- Total agents
- Online agents
- Offline agents

**Task Statistics**
- Total tasks by status
- Visual distribution
- Real-time updates

**Memory Usage**
- Heap used / total
- External memory
- RSS (Resident Set Size)
- Heap usage percentage

**System Information**
- Platform
- Node.js version
- CPU cores
- Total/free memory
- Load average

**Integration Status**
- GitHub connection
- Telegram connection
- Google Calendar connection

**Readiness Checks**
- Required files existence
- Configuration validation

The dashboard updates every 10 seconds and color-codes components:
- 🟢 Green: OK/Connected
- 🔴 Red: Error/Disabled
- ⚪ Gray: Unknown/Offline

## Log Files

Logs are stored in the workspace logs directory:

```
~/.openclaw/workspace/logs/
├── operator-hub.log           # All logs (JSON format)
└── operator-hub-error.log     # Errors only
```

### Log File Format

All logs are in JSON format for easy machine parsing:

```bash
# View recent logs
tail -f ~/.openclaw/workspace/logs/operator-hub.log | jq '.'

# Filter for errors only
cat ~/.openclaw/workspace/logs/operator-hub.log | jq 'select(.level=="error")'

# Find specific task activity
cat ~/.openclaw/workspace/logs/operator-hub.log | jq 'select(.taskId=="task-123")'
```

## Error Tracking

The bridge tracks errors automatically and reports them via the health endpoint.

### Error Recording

Errors are recorded in two ways:

1. **Request Errors**: Any HTTP error response increments the error counter
2. **Exception Handlers**: Caught exceptions are logged with full stack traces

### Error Log Format

```json
{
  "level": "error",
  "message": "Webhook error",
  "timestamp": "2026-02-14 12:34:56",
  "service": "operator-hub",
  "error": "Invalid webhook signature",
  "stack": "Error: Invalid signature\n    at validateWebhook (line:123)\n..."
}
```

### Error Thresholds

Watch for these warning signs:

- **High error rate**: >1 error per minute
- **Memory leak**: Heap usage growing steadily
- **Dead agents**: >20% agents offline
- **Integration failures**: Any integration status change
- **Task backlog**: >100 queued tasks

## Metrics & Performance

### Key Metrics

From the `/health` endpoint, monitor these metrics:

```
✓ Task Distribution
  - queued: newly created tasks awaiting assignment
  - development: in-progress tasks
  - review: awaiting review
  - blocked: waiting for dependencies
  - done: completed tasks

✓ Agent Status
  - online: agents currently active
  - offline: agents not responding
  - Average tasks per agent

✓ System Resources
  - Memory usage trending
  - Uptime (process stability)
  - Error rate
```

### Response Time Tracking

Request duration is logged with each request:

```json
{
  "level": "debug",
  "message": "POST /api/tasks",
  "duration": 145,
  "status": 200
}
```

Monitor these API endpoints for slow responses:

- `POST /api/tasks` - Task creation
- `PUT /api/tasks/:id` - Task updates
- `GET /api/tasks` - List all tasks
- `POST /api/ai/tasks/generate` - AI task generation

## Troubleshooting

### Bridge Not Starting

**Check logs:**

```bash
tail -100 ~/.openclaw/workspace/logs/operator-hub-error.log | jq '.message, .error'
```

**Common issues:**
- Port 8787 already in use: `lsof -i :8787`
- Missing workspace directory: Check `OPENCLAW_WORKSPACE` environment variable
- Corrupt data files: Check `.clawhub/*.json` files

### High Memory Usage

1. Check memory breakdown in System Status dashboard
2. Look for memory growth over time:
   ```bash
   # Monitor memory every 5 seconds
   watch -n 5 'curl -s http://localhost:8787/health | jq ".memory"'
   ```
3. Check for memory leaks in logs:
   ```bash
   cat ~/.openclaw/workspace/logs/operator-hub.log | jq 'select(.level=="error") | .message'
   ```

### Agents Showing Offline

1. Check agent heartbeats:
   ```bash
   curl http://localhost:8787/api/agents | jq '.[] | {id, status, lastHeartbeat}'
   ```
2. Verify agent network connectivity to bridge
3. Check for authentication issues in logs:
   ```bash
   cat ~/.openclaw/workspace/logs/operator-hub.log | jq 'select(.message | contains("auth"))'
   ```

### Integration Not Working

1. Check integration status:
   ```bash
   curl http://localhost:8787/health | jq '.integrations'
   ```
2. Look for integration errors in logs:
   ```bash
   cat ~/.openclaw/workspace/logs/operator-hub.log | jq 'select(.message | contains("GitHub|Telegram|Calendar"))'
   ```
3. Verify credentials in config file:
   ```bash
   cat ~/.openclaw/workspace/.clawhub/config.json
   ```

### Slow Task Creation

1. Monitor task creation time:
   ```bash
   cat ~/.openclaw/workspace/logs/operator-hub.log | jq 'select(.message=="Task created") | {duration, priority}'
   ```
2. Check system resources:
   ```bash
   curl http://localhost:8787/health | jq '.memory, .system.loadAverage'
   ```
3. Look for concurrent operation bottlenecks

## Monitoring with External Tools

### Prometheus Integration

The health endpoints can be scraped by Prometheus:

```yaml
scrape_configs:
  - job_name: 'operator-hub'
    static_configs:
      - targets: ['localhost:8787']
    metrics_path: '/health'
```

### Kubernetes Integration

Add these probes to your container definition:

```yaml
livenessProbe:
  httpGet:
    path: /health/live
    port: 8787
  initialDelaySeconds: 5
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /health/ready
    port: 8787
  initialDelaySeconds: 5
  periodSeconds: 5
```

### Alert Examples

Set up alerts based on health endpoint:

```
WARN: Error rate > 1 per minute
CRITICAL: Memory usage > 80%
CRITICAL: Readiness check fails
WARN: More than 2 agents offline
WARN: Task queue > 100 items
```

## Dashboard Refresh Rate

The System Status dashboard refreshes every 10 seconds by default. To change this, modify `src/pages/SystemStatusPage.tsx`:

```typescript
// Poll health every 10s (default)
usePoll(loadHealth, 10000)

// Change to 5s for more frequent updates
usePoll(loadHealth, 5000)
```

## Logs Retention Policy

Log files are stored indefinitely in the logs directory. For production deployments, consider:

1. **Log Rotation**: Install `winston-daily-rotate-file` for automatic rotation
2. **Cleanup**: Implement a cleanup job to remove logs older than 30 days
3. **Archival**: Move logs to cold storage after 7 days

Example cleanup script:

```bash
# Remove logs older than 30 days
find ~/.openclaw/workspace/logs -name "*.log" -mtime +30 -delete
```

## Best Practices

1. **Monitor regularly**: Check System Status dashboard daily
2. **Set up alerts**: Use external monitoring for critical metrics
3. **Review logs**: Periodically review error logs for patterns
4. **Capacity planning**: Track trends in task counts and agent usage
5. **Test failover**: Verify health checks work with simulated failures
6. **Document incidents**: Log investigation findings for team

---

For questions or issues, refer to DEPLOYMENT.md and README.md.
