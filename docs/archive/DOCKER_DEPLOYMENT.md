# Docker Deployment - Claw Control Center

## ✅ Deployment Complete - 2026-02-14 10:00 UTC

Successfully deployed Claw Control Center with Docker containers.

### Running Containers

1. **claw-bridge** (API Server)
   - Image: `claw-bridge:latest`
   - Port: `0.0.0.0:8787:8787`
   - Network: `claw-net`
   - Restart: `unless-stopped`
   - Health: ✅ Healthy
   - Resource: ~34MB RAM, <1% CPU

2. **claw-ui** (React Frontend)
   - Image: `claw-ui:latest`
   - Port: `0.0.0.0:5173:3000` (maps container port 3000 to host 5173)
   - Network: `claw-net`
   - Restart: `unless-stopped`
   - Health: ✅ Healthy
   - Resource: ~9MB RAM, <1% CPU
   - Served by: Nginx (production build)

### Network Access

- **LAN**: http://192.168.1.51:5173 (UI) | http://192.168.1.51:8787 (API)
- **Tailscale**: http://100.103.251.17:5173 (UI) | http://100.103.251.17:8787 (API)
- **Localhost**: http://localhost:5173 (UI) | http://localhost:8787 (API)

### Persistent Data

- Bridge data: `/home/openclaw/.openclaw/workspace/.clawhub` → `/data/.clawhub`
- Logs: `/home/openclaw/.openclaw/workspace/logs` → `/app/logs`

### Auto-Restart Behavior

Both containers have `--restart unless-stopped`:
- ✅ Restart on crash
- ✅ Restart on system reboot
- ✅ Stop gracefully with `docker stop`
- ✅ Stay stopped if manually stopped

### Health Checks

- **Bridge**: `curl -f http://localhost:8787/api/status` every 30s
- **UI**: `curl -f http://localhost:3000/` every 30s
- Auto-restart after 3 failed checks

### Management Commands

```bash
# View status
docker ps | grep claw

# View logs
docker logs claw-bridge --tail 50
docker logs claw-ui --tail 50

# Restart containers
docker restart claw-bridge
docker restart claw-ui

# Stop containers
docker stop claw-bridge claw-ui

# Start containers
docker start claw-bridge claw-ui

# Remove containers (preserves volumes)
docker rm -f claw-bridge claw-ui

# View resource usage
docker stats claw-bridge claw-ui
```

### Rebuild Images

```bash
cd /home/openclaw/.openclaw/workspace

# Rebuild bridge
docker build -t claw-bridge:latest -f docker/Dockerfile.bridge .

# Rebuild UI
docker build -t claw-ui:latest -f docker/Dockerfile.ui .

# Recreate containers after rebuild
docker stop claw-bridge claw-ui
docker rm claw-bridge claw-ui
# Then run the docker run commands again
```

### Advantages Over Dev Server

1. **Stability**: Nginx serving static files vs Vite dev server
2. **Auto-restart**: Crashes are automatically recovered
3. **Health checks**: Automatic monitoring and recovery
4. **Resource usage**: Lower memory/CPU than dev server
5. **Production-ready**: Built artifacts, not live rebuilds
6. **Isolation**: Processes isolated from host

### Issues Fixed

1. ✅ Dockerfile.bridge: Fixed dumb-init path (`/usr/bin/` not `/sbin/`)
2. ✅ UI production build: Successfully compiled and served by nginx
3. ✅ Network connectivity: Both containers accessible on LAN and Tailscale
4. ✅ Health checks: Both containers passing health checks

### Known Working Features

- ✅ Bridge API responding on port 8787
- ✅ UI loading on port 5173  
- ✅ Container restart policies active
- ✅ Health checks running every 30s
- ✅ Persistent data volumes mounted
- ✅ Network isolation (containers on claw-net)

## Next Steps

1. Monitor container stability over 24-48 hours
2. Verify agent cron jobs continue to work
3. Test UI auto-recovery after simulated crash
4. Consider adding docker-compose for easier management (requires docker-compose-v2 installation)

## Critical Fixes Applied (2026-02-14 10:05 UTC)

### Issue: Bridge Not Reading Data

**Problem**: UI showed no tasks even though data files existed. Bridge container couldn't read mounted volume data.

**Root Cause**: 
1. Bridge looks for data at `${OPENCLAW_WORKSPACE}/.clawhub`
2. Default was `~/.openclaw/workspace/.clawhub` (inside container)
3. Data was mounted at `/data/.clawhub` but env var wasn't set
4. File permissions: Container user (nodejs:1001) couldn't write to openclaw-owned files (1000:1000)

**Solution**:
1. Set environment variable: `-e OPENCLAW_WORKSPACE=/data`
2. Fixed file permissions: `chmod -R 777 .clawhub` on host
3. Removed logs volume mount (permissions conflict)

**Current Working Configuration**:
```bash
docker run -d \
  --name claw-bridge \
  --network claw-net \
  -p 0.0.0.0:8787:8787 \
  -v /home/openclaw/.openclaw/workspace/.clawhub:/data/.clawhub \
  -e NODE_ENV=production \
  -e LOG_LEVEL=info \
  -e PORT=8787 \
  -e OPENCLAW_WORKSPACE=/data \
  --restart unless-stopped \
  claw-bridge:latest
```

**Verified Working**:
- ✅ 99 tasks visible via API
- ✅ 5 agents registered
- ✅ All lanes populated (queued: 23, done: 51, review: 15, etc.)
- ✅ Container healthy and stable
