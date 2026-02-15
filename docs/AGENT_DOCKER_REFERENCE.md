# Agent Docker Reference - Quick Commands

## ⚠️ CRITICAL: Volume Mount Requirements

**When restarting claw-bridge, you MUST include the volume mount or all tasks will disappear!**

## Bridge Container Restart (STANDARD COMMAND)

**Use this exact command every time:**

```bash
docker rm -f claw-bridge && docker run -d --name claw-bridge --network claw-net \
  -p 8787:8787 \
  -v /home/openclaw/.openclaw/workspace/.clawhub:/data/.clawhub \
  -e OPENCLAW_WORKSPACE=/data \
  claw-bridge:latest
```

## Common Scenarios

### After Code Changes to Bridge

```bash
# 1. Build new image
docker build -t claw-bridge:latest -f docker/Dockerfile.bridge .

# 2. Restart with volume mount (use standard command above)
docker rm -f claw-bridge && docker run -d --name claw-bridge --network claw-net \
  -p 8787:8787 \
  -v /home/openclaw/.openclaw/workspace/.clawhub:/data/.clawhub \
  -e OPENCLAW_WORKSPACE=/data \
  claw-bridge:latest
```

### After Code Changes to UI

```bash
# 1. Clear Vite cache on host (if needed)
rm -rf dist node_modules/.vite

# 2. Build fresh
npm run build

# 3. Build Docker image
docker build --no-cache -t claw-ui:latest -f docker/Dockerfile.ui .

# 4. Restart
docker rm -f claw-ui && docker run -d --name claw-ui --network claw-net \
  -p 5173:3000 \
  claw-ui:latest
```

## Verification

### Check Volume Mount is Active

```bash
docker inspect claw-bridge | grep -A 10 "Mounts"
# Should show: /home/openclaw/.openclaw/workspace/.clawhub -> /data/.clawhub
```

### Check Tasks are Accessible

```bash
curl -s http://localhost:8787/api/tasks | python3 -c "
import sys, json
tasks = json.load(sys.stdin)
print(f'Total tasks: {len(tasks)}')
"
```

If this returns 0 when tasks should exist, **volume mount is missing!**

### Check Files Inside Container

```bash
docker exec claw-bridge ls -la /data/.clawhub/
# Should show: tasks.json, agents.json, activity.json, etc.
```

## What NOT to Do

❌ **WRONG - Missing volume mount:**
```bash
docker run -d --name claw-bridge claw-bridge:latest
# Container starts with empty /data/.clawhub/ - all tasks lost!
```

❌ **WRONG - Using docker restart after rebuild:**
```bash
docker build -t claw-bridge:latest -f docker/Dockerfile.bridge .
docker restart claw-bridge  # Still uses OLD image!
```

✅ **RIGHT - Always rm + run with volume:**
```bash
docker build -t claw-bridge:latest -f docker/Dockerfile.bridge .
docker rm -f claw-bridge && docker run -d --name claw-bridge --network claw-net \
  -p 8787:8787 \
  -v /home/openclaw/.openclaw/workspace/.clawhub:/data/.clawhub \
  -e OPENCLAW_WORKSPACE=/data \
  claw-bridge:latest
```

## Emergency Recovery

If tasks disappeared after restart:

1. **Check if data still exists on disk:**
   ```bash
   ls -lh /home/openclaw/.openclaw/workspace/.clawhub/tasks.json
   ```

2. **If file exists (non-zero size), restart with volume mount:**
   ```bash
   docker rm -f claw-bridge && docker run -d --name claw-bridge --network claw-net \
     -p 8787:8787 \
     -v /home/openclaw/.openclaw/workspace/.clawhub:/data/.clawhub \
     -e OPENCLAW_WORKSPACE=/data \
     claw-bridge:latest
   ```

3. **Verify tasks are back:**
   ```bash
   curl -s http://localhost:8787/api/tasks | python3 -c "import sys,json; print(len(json.load(sys.stdin)))"
   ```

## Memory Aid

**Think: "Bridge MUST have a BRIDGE to the data!"**

The volume mount (`-v ... `) is the bridge between:
- Host filesystem: `/home/openclaw/.openclaw/workspace/.clawhub/`
- Container filesystem: `/data/.clawhub/`

Without it, the container creates its own empty `/data/.clawhub/` and starts fresh.
