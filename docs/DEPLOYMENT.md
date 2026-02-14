# Claw Control Center - Deployment Guide

This guide covers deploying the Claw Control Center multi-agent task management system in production using Docker Compose or systemd services.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start (Docker Compose)](#quick-start-docker-compose)
3. [Production Deployment (Systemd)](#production-deployment-systemd)
4. [Environment Variables](#environment-variables)
5. [Backup & Restore](#backup--restore)
6. [Monitoring & Health Checks](#monitoring--health-checks)
7. [Nginx Reverse Proxy](#nginx-reverse-proxy)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements

- **Docker & Docker Compose:** Latest stable versions (for Docker deployment)
  ```bash
  docker --version
  docker-compose --version
  ```
- **Or Node.js + Nginx:** For systemd deployment
  - Node.js 22+ LTS
  - Nginx 1.24+
  - systemd (most modern Linux distributions)
- **Disk Space:** Minimum 2GB for application + data
- **Memory:** 2GB recommended (1GB bridge + 512MB UI + 512MB redis)
- **Network:** Ports 8787 (bridge), 3000 (UI), and 80/443 (if using reverse proxy)

### Required Files

Ensure these files exist in the project root:
- `docker-compose.yml` - Service orchestration
- `docker/Dockerfile.bridge` - Bridge server image
- `docker/Dockerfile.ui` - UI server image
- `docker/nginx.conf` - Nginx configuration for UI
- `.env.example` - Configuration template
- `scripts/backup.sh` - Backup utility
- `scripts/restore.sh` - Restore utility

---

## Quick Start (Docker Compose)

### 1. Clone and Configure

```bash
# Clone the repository
git clone https://github.com/openclaw/claw-control-center.git
cd claw-control-center

# Copy environment template
cp .env.example .env

# Edit configuration (optional)
nano .env
```

### 2. Build and Start Services

```bash
# Build images
docker-compose build

# Start services in background
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f bridge
docker-compose logs -f ui
```

### 3. Verify Deployment

```bash
# Check health endpoints
curl http://localhost:8787/health
curl http://localhost:3000/health

# Access the UI
# Open browser to http://localhost:3000

# Check service status
docker-compose ps
```

### 4. Stop Services

```bash
# Stop all services
docker-compose down

# Stop and remove volumes (⚠️ deletes data!)
docker-compose down -v
```

---

### Docker Compose - Common Operations

#### Rebuild Services

```bash
# Rebuild after code changes
docker-compose build --no-cache

# Rebuild specific service
docker-compose build bridge
docker-compose build ui
```

#### View Logs

```bash
# Follow bridge logs
docker-compose logs -f bridge

# Follow UI logs
docker-compose logs -f ui

# View last 50 lines
docker-compose logs --tail=50 bridge
```

#### Scale Services

```bash
# Note: Currently only stateless services (bridge) can be scaled
# UI and redis should remain at 1 replica

docker-compose up -d --scale bridge=2
```

#### Execute Commands

```bash
# Run command in bridge container
docker-compose exec bridge node --version

# Run command in UI container
docker-compose exec ui curl http://localhost:3000/health
```

#### Resource Usage

```bash
# Check container resource usage
docker stats claw-bridge claw-ui

# Check volume usage
docker volume ls
docker volume inspect claw-control-center_clawhub_data
```

---

## Production Deployment (Systemd)

For production deployments without Docker, use systemd services.

### 1. System Setup

```bash
# Create dedicated user
sudo useradd --system --home-dir /var/lib/claw --shell /bin/false claw

# Create installation directory
sudo mkdir -p /opt/claw/bridge /opt/claw/ui
sudo mkdir -p /var/lib/claw/.clawhub
sudo mkdir -p /var/log/claw
sudo mkdir -p /etc/claw

# Set permissions
sudo chown -R claw:claw /var/lib/claw /var/log/claw /etc/claw
sudo chmod 750 /var/lib/claw /var/log/claw
```

### 2. Install Bridge Server

```bash
# Copy bridge files
sudo cp -r ./projects/tars-operator-hub/bridge /opt/claw/bridge/app
sudo cp package*.json /opt/claw/bridge/

# Install dependencies
cd /opt/claw/bridge
sudo npm ci --omit=dev

# Set permissions
sudo chown -R claw:claw /opt/claw/bridge
sudo chmod 755 /opt/claw/bridge
```

### 3. Install UI Server

```bash
# Build UI
cd ./projects/claw-task-manager
npm run build

# Copy built files
sudo mkdir -p /var/www/claw-ui
sudo cp -r dist/* /var/www/claw-ui/

# Copy nginx config
sudo cp ../../docker/nginx.conf /etc/claw/
sudo mkdir -p /var/cache/nginx /var/run/nginx
sudo chown -R www-data:www-data /var/www/claw-ui /var/cache/nginx
```

### 4. Install Systemd Services

```bash
# Copy service files
sudo cp ./systemd/claw-bridge.service /etc/systemd/system/
sudo cp ./systemd/claw-ui.service /etc/systemd/system/

# Reload systemd daemon
sudo systemctl daemon-reload

# Enable services (start on boot)
sudo systemctl enable claw-bridge.service
sudo systemctl enable claw-ui.service
```

### 5. Configure Services

Create environment files:

**Bridge Environment** (`/etc/claw/bridge.env`):
```bash
NODE_ENV=production
LOG_LEVEL=info
BRIDGE_URL=http://localhost:8787
UI_URL=http://localhost:3000
DATA_DIR=/var/lib/claw/.clawhub
```

**UI Environment** (`/etc/claw/ui.env`):
```bash
NODE_ENV=production
```

Set permissions:
```bash
sudo chmod 640 /etc/claw/bridge.env /etc/claw/ui.env
sudo chown claw:claw /etc/claw/bridge.env
sudo chown www-data:www-data /etc/claw/ui.env
```

### 6. Start Services

```bash
# Start bridge service
sudo systemctl start claw-bridge.service

# Start UI service
sudo systemctl start claw-ui.service

# Check status
sudo systemctl status claw-bridge.service
sudo systemctl status claw-ui.service

# View service logs
sudo journalctl -u claw-bridge.service -f
sudo journalctl -u claw-ui.service -f
```

### 7. Verify Deployment

```bash
# Health checks
curl http://localhost:8787/health
curl http://localhost:3000/health

# Check service status
systemctl is-active claw-bridge.service
systemctl is-active claw-ui.service

# Check processes
ps aux | grep node
ps aux | grep nginx
```

---

### Systemd - Common Operations

#### Restart Service

```bash
# Restart bridge service
sudo systemctl restart claw-bridge.service

# Restart UI service
sudo systemctl restart claw-ui.service

# Restart all services
sudo systemctl restart claw-bridge.service claw-ui.service
```

#### Stop Service

```bash
# Stop service (won't start on boot)
sudo systemctl stop claw-bridge.service

# Disable service (prevent auto-start on boot)
sudo systemctl disable claw-bridge.service
```

#### View Logs

```bash
# Follow bridge logs
sudo journalctl -u claw-bridge.service -f

# View UI logs
sudo journalctl -u claw-ui.service -f

# View last 100 lines
sudo journalctl -u claw-bridge.service -n 100

# View logs since yesterday
sudo journalctl -u claw-bridge.service --since yesterday
```

#### Resource Usage

```bash
# Monitor bridge service
ps aux | grep "node.*server.mjs"

# Monitor nginx
ps aux | grep nginx

# Check memory usage
systemctl status claw-bridge.service | grep Memory
```

---

## Environment Variables

All configuration is done via environment variables or `.env` files.

### Core Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Environment mode (production/development) |
| `LOG_LEVEL` | `info` | Logging level (debug/info/warn/error) |
| `BRIDGE_URL` | `http://localhost:8787` | Bridge server URL (for UI to reach API) |
| `UI_URL` | `http://localhost:3000` | UI server URL |
| `PORT` | `8787` | Bridge server port |
| `DATA_DIR` | `./.clawhub` | Data storage directory |

### Service Ports (Docker Compose)

| Variable | Default | Description |
|----------|---------|-------------|
| `BRIDGE_PORT` | `8787` | Bridge API port |
| `UI_PORT` | `3000` | UI server port |
| `PROXY_PORT` | `80` | Reverse proxy HTTP port |
| `PROXY_HTTPS_PORT` | `443` | Reverse proxy HTTPS port |

### Optional Integrations

| Variable | Default | Description |
|----------|---------|-------------|
| `TELEGRAM_BOT_TOKEN` | `` | Telegram bot token for notifications |
| `GITHUB_TOKEN` | `` | GitHub API token for issue creation |
| `GITHUB_WEBHOOK_SECRET` | `` | GitHub webhook secret for verification |
| `SLACK_WEBHOOK_URL` | `` | Slack webhook for notifications |
| `GOOGLE_CALENDAR_CREDENTIALS` | `` | Google Calendar OAuth credentials |
| `REDIS_URL` | `redis://redis:6379` | Redis connection URL |

### Creating .env File

```bash
# Copy template
cp .env.example .env

# Edit with your values
nano .env

# Example .env:
NODE_ENV=production
BRIDGE_URL=https://claw.example.com/api
UI_URL=https://claw.example.com
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
GITHUB_TOKEN=ghp_xxxxx...
```

---

## Backup & Restore

### Automatic Backups

For production deployments, set up automated backups via cron:

```bash
# Edit crontab
sudo crontab -e

# Add daily backup at 2 AM (Docker Compose)
0 2 * * * cd /opt/claw && ./scripts/backup.sh /data/backups true

# Add daily backup at 2 AM (Systemd)
0 2 * * * /opt/claw/scripts/backup.sh /data/backups true
```

### Manual Backup

#### Docker Compose

```bash
# Create backup
docker-compose exec bridge bash /app/scripts/backup.sh

# Backup with compression
docker-compose exec bridge bash /app/scripts/backup.sh /data/backups true

# Backup to host machine
docker run --rm -v claw-control-center_clawhub_data:/data \
  -v /data/backups:/backups \
  alpine tar czf /backups/claw-backup-$(date +%s).tar.gz -C /data clawhub
```

#### Systemd

```bash
# Create backup
cd /opt/claw && ./scripts/backup.sh /data/backups true

# Check recent backups
ls -lh /data/backups/
```

### Restore Backup

#### Docker Compose

```bash
# List backups
docker run --rm -v claw-control-center_clawhub_data:/data \
  alpine ls -lh /data/clawhub/backups/

# Restore backup (stop services first)
docker-compose down

# Extract backup
docker run --rm -v claw-control-center_clawhub_data:/data \
  -v /data/backups:/backups \
  alpine tar xzf /backups/claw-backup-2024-02-14-120000.tar.gz -C /data

# Start services
docker-compose up -d
```

#### Systemd

```bash
# List backups
ls -lh /data/backups/

# Stop services
sudo systemctl stop claw-bridge.service claw-ui.service

# Restore backup
cd /opt/claw && ./scripts/restore.sh /data/backups/claw-backup-2024-02-14-120000

# Start services
sudo systemctl start claw-bridge.service claw-ui.service
```

---

## Monitoring & Health Checks

### Health Check Endpoints

Both services provide health check endpoints:

```bash
# Bridge health
curl http://localhost:8787/health

# UI health
curl http://localhost:3000/health

# Expected response:
# {"status": "ok", "timestamp": "2024-02-14T12:00:00Z"}
```

### Docker Compose Health

```bash
# Check service health
docker-compose ps

# Check container logs
docker-compose logs bridge
docker-compose logs ui

# Restart unhealthy service
docker-compose up -d --force-recreate bridge
```

### Systemd Health

```bash
# Check service status
systemctl status claw-bridge.service
systemctl status claw-ui.service

# Monitor in real-time
watch -n 5 'systemctl status claw-bridge.service'

# Check service logs
journalctl -u claw-bridge.service -f
```

### Monitoring Tools

For production monitoring, consider:
- **Prometheus + Grafana:** Metrics collection and visualization
- **ELK Stack:** Log aggregation (Elasticsearch, Logstash, Kibana)
- **DataDog/New Relic:** Cloud-hosted monitoring
- **Sentry:** Error tracking

---

## Nginx Reverse Proxy

For production deployments, use Nginx as a reverse proxy to handle SSL/TLS, compression, caching, etc.

### Docker Compose Setup

Uncomment the `proxy` service in `docker-compose.yml` and create `docker/nginx-proxy.conf`:

```nginx
upstream bridge {
    server bridge:8787;
}

upstream ui {
    server ui:3000;
}

server {
    listen 80;
    listen 443 ssl http2;
    server_name claw.example.com;

    # SSL certificates
    ssl_certificate /etc/nginx/certs/cert.pem;
    ssl_certificate_key /etc/nginx/certs/key.pem;

    # Redirect HTTP to HTTPS
    if ($scheme != "https") {
        return 301 https://$server_name$request_uri;
    }

    # API proxy
    location /api/ {
        proxy_pass http://bridge;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # UI proxy
    location / {
        proxy_pass http://ui;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # SSL settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

### Systemd Setup

Create `/etc/nginx/sites-available/claw`:

```bash
sudo nano /etc/nginx/sites-available/claw
```

Copy the nginx configuration above, then:

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/claw /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart nginx
sudo systemctl restart nginx
```

---

## Troubleshooting

### Bridge Service Won't Start

**Symptom:** `systemctl status claw-bridge.service` shows failed

**Solutions:**

```bash
# Check logs
sudo journalctl -u claw-bridge.service -n 50

# Verify Node.js is installed
node --version

# Check permissions on data directory
ls -ld /var/lib/claw/.clawhub

# Test bridge server manually
cd /opt/claw/bridge
node app/server.mjs

# Fix permissions
sudo chown -R claw:claw /var/lib/claw
sudo chmod 750 /var/lib/claw
```

### UI Service Won't Start

**Symptom:** `systemctl status claw-ui.service` shows failed

**Solutions:**

```bash
# Check logs
sudo journalctl -u claw-ui.service -n 50

# Verify nginx is installed
nginx -v

# Check nginx configuration
sudo nginx -t

# Check port availability
sudo netstat -tuln | grep 3000

# Fix permissions on UI files
sudo chown -R www-data:www-data /var/www/claw-ui
```

### Health Check Failing

**Symptom:** `curl http://localhost:8787/health` returns error

**Solutions:**

```bash
# Check if service is running
ps aux | grep node

# Check port is listening
netstat -tuln | grep 8787

# Check logs
docker-compose logs bridge
# or
sudo journalctl -u claw-bridge.service -f

# Test connectivity
curl -v http://localhost:8787/health
```

### High Memory Usage

**Symptom:** Services using more than expected memory

**Solutions:**

```bash
# Check memory usage
docker stats
# or
ps aux --sort=-%mem | head

# Reduce memory limits in docker-compose.yml or systemd service

# Clear cache and restart
docker-compose restart bridge
```

### Backup Restore Issues

**Symptom:** Backup/restore scripts fail

**Solutions:**

```bash
# Check disk space
df -h

# Ensure .clawhub directory exists
mkdir -p ./.clawhub
sudo mkdir -p /var/lib/claw/.clawhub

# Check backup file
tar -tzf /data/backups/claw-backup-*.tar.gz | head

# Restore with verbose output
./scripts/restore.sh /data/backups/claw-backup-* --force
```

---

## Support

For issues or questions:

1. Check logs: `docker-compose logs -f` or `journalctl -u claw-bridge.service -f`
2. Review this guide's troubleshooting section
3. Check GitHub issues: https://github.com/openclaw/claw-control-center/issues
4. Contact support: https://openclaw.dev/support

---

## License

© 2024 OpenClaw. All rights reserved.
