# Docker Container Management

## Critical: Updating Code in Docker Containers

**WRONG (doesn't work):**
```bash
docker build -t claw-bridge:latest -f docker/Dockerfile.bridge .
docker restart claw-bridge  # ❌ Still uses OLD image!
```

**RIGHT (actually updates):**
```bash
# 1. Build new image
docker build -t claw-bridge:latest -f docker/Dockerfile.bridge .

# 2. Remove old container
docker rm -f claw-bridge

# 3. Start new container with new image
docker run -d \
  --name claw-bridge \
  --network claw-net \
  -p 0.0.0.0:8787:8787 \
  -v /home/openclaw/.openclaw/workspace/.clawhub:/data/.clawhub \
  -v /home/openclaw/.openclaw/workspace/logs:/app/logs \
  -e NODE_ENV=production \
  -e LOG_LEVEL=info \
  -e PORT=8787 \
  -e OPENCLAW_WORKSPACE=/data \
  --restart unless-stopped \
  claw-bridge:latest
```

## Why `docker restart` Doesn't Work

When you run `docker restart claw-bridge`:
- It stops and starts the **existing container**
- The container is bound to the **image ID** it was created from
- Even if you rebuild with the same tag (`claw-bridge:latest`), the OLD container still points to the OLD image ID

## Quick Commands

### Rebuild Bridge

**⚠️ CRITICAL: Always include volume mounts or all tasks will be lost!**

```bash
cd /home/openclaw/.openclaw/workspace
docker build -t claw-bridge:latest -f docker/Dockerfile.bridge .
docker rm -f claw-bridge
docker run -d --name claw-bridge --network claw-net \
  -p 8787:8787 \
  -v /home/openclaw/.openclaw/workspace/.clawhub:/data/.clawhub \
  -e OPENCLAW_WORKSPACE=/data \
  claw-bridge:latest
```

**Required flags:**
- `-v /home/openclaw/.openclaw/workspace/.clawhub:/data/.clawhub` ← **MUST HAVE** or tasks disappear!
- `-e OPENCLAW_WORKSPACE=/data` ← Tells bridge where to find data
- `--network claw-net` ← Bridge and UI must be on same network

### Rebuild UI
```bash
cd /home/openclaw/.openclaw/workspace
docker build -t claw-ui:latest -f docker/Dockerfile.ui .
docker rm -f claw-ui
docker run -d --name claw-ui --network claw-net \
  -p 0.0.0.0:5173:3000 \
  -e NODE_ENV=production \
  --restart unless-stopped \
  claw-ui:latest
```

### Check Running Images
```bash
# See what image each container is actually using
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.ID}}"

# See all images (including untagged old ones)
docker images
```

### Clean Up Old Images
```bash
# Remove dangling images (untagged, not in use)
docker image prune

# Remove ALL unused images
docker image prune -a
```

## File Permissions

Bridge and UI containers run as non-root user (`nodejs`, UID 1001).

Files in `.clawhub/` are owned by the bridge container:
- Can't edit directly from host as `openclaw` user
- Must use Docker exec or API endpoints

**Wrong:**
```bash
echo '[]' > .clawhub/tasks.json  # Permission denied!
```

**Right (use API):**
```bash
curl -X DELETE http://localhost:8787/api/tasks/{id}
```

**Or (stop container first):**
```bash
docker stop claw-bridge
# Now you can edit files
echo '[]' > .clawhub/tasks.json
docker start claw-bridge
```
