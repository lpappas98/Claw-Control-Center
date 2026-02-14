#!/bin/bash

################################################################################
# Claw Control Center - Deployment Script
#
# Simplifies deploying the Claw Control Center using Docker Compose
#
# Usage: ./scripts/deploy.sh [command] [options]
#
# Commands:
#   init          Initialize deployment (configure .env)
#   build         Build Docker images
#   start         Start services in background
#   stop          Stop services
#   restart       Restart services
#   logs          View service logs
#   status        Check service status
#   health        Run health checks
#   backup        Create backup of data
#   restore       Restore from backup
#   clean         Stop and remove containers (keeps data)
#   destroy       Stop and remove everything (⚠️ deletes data)
#   setup         Run full setup (init + build + start)
#   update        Pull latest code and restart services
#
# Examples:
#   ./scripts/deploy.sh init
#   ./scripts/deploy.sh setup
#   ./scripts/deploy.sh start
#   ./scripts/deploy.sh logs
#   ./scripts/deploy.sh backup
################################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Functions
log_info() {
    echo -e "${BLUE}ℹ️  $@${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $@${NC}"
}

log_warn() {
    echo -e "${YELLOW}⚠️  $@${NC}"
}

log_error() {
    echo -e "${RED}❌ $@${NC}"
}

# Initialize .env
cmd_init() {
    log_info "Initializing deployment..."
    
    if [ -f "$PROJECT_DIR/.env" ]; then
        log_warn ".env file already exists"
        read -p "Overwrite? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            return
        fi
    fi
    
    cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"
    log_success ".env file created"
    log_info "Edit .env file to configure services:"
    log_info "  nano .env"
}

# Build Docker images
cmd_build() {
    log_info "Building Docker images..."
    cd "$PROJECT_DIR"
    docker-compose build
    log_success "Docker images built successfully"
}

# Start services
cmd_start() {
    log_info "Starting services..."
    cd "$PROJECT_DIR"
    docker-compose up -d
    
    # Wait for services to be ready
    log_info "Waiting for services to be ready..."
    sleep 5
    
    log_success "Services started"
    cmd_status
}

# Stop services
cmd_stop() {
    log_info "Stopping services..."
    cd "$PROJECT_DIR"
    docker-compose down
    log_success "Services stopped"
}

# Restart services
cmd_restart() {
    log_info "Restarting services..."
    cd "$PROJECT_DIR"
    docker-compose restart
    log_success "Services restarted"
    cmd_status
}

# View logs
cmd_logs() {
    SERVICE="${1:-}"
    log_info "Viewing logs (press Ctrl+C to stop)..."
    cd "$PROJECT_DIR"
    
    if [ -z "$SERVICE" ]; then
        docker-compose logs -f
    else
        docker-compose logs -f "$SERVICE"
    fi
}

# Check service status
cmd_status() {
    log_info "Service status:"
    cd "$PROJECT_DIR"
    docker-compose ps
}

# Run health checks
cmd_health() {
    log_info "Running health checks..."
    echo ""
    
    # Check bridge health
    log_info "Bridge server health..."
    if curl -sf http://localhost:8787/health > /dev/null 2>&1; then
        log_success "Bridge server: OK"
    else
        log_error "Bridge server: FAILED"
    fi
    
    # Check UI health
    log_info "UI server health..."
    if curl -sf http://localhost:3000/health > /dev/null 2>&1; then
        log_success "UI server: OK"
    else
        log_error "UI server: FAILED"
    fi
    
    # Check Redis health
    log_info "Redis health..."
    cd "$PROJECT_DIR"
    if docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; then
        log_success "Redis: OK"
    else
        log_error "Redis: FAILED"
    fi
    
    echo ""
    log_success "Health check complete"
}

# Create backup
cmd_backup() {
    log_info "Creating backup..."
    cd "$PROJECT_DIR"
    
    BACKUP_DIR="${1:-.clawhub/backups}"
    mkdir -p "$BACKUP_DIR"
    
    # Run backup
    docker-compose exec -T bridge bash /app/scripts/backup.sh "$BACKUP_DIR" true
    log_success "Backup created"
}

# Restore backup
cmd_restore() {
    BACKUP_PATH="${1:-.}"
    
    if [ "$BACKUP_PATH" = "." ]; then
        log_error "Backup path required"
        echo "Usage: ./scripts/deploy.sh restore <backup_path>"
        exit 1
    fi
    
    log_warn "Restoring from backup: $BACKUP_PATH"
    read -p "Continue? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        return
    fi
    
    cd "$PROJECT_DIR"
    docker-compose down
    
    # Restore
    docker run --rm -v claw-control-center_clawhub_data:/data \
        -v $(cd "$BACKUP_PATH" && pwd):/backup \
        alpine tar xzf /backup/$(basename $BACKUP_PATH).tar.gz -C /data 2>/dev/null || \
        docker run --rm -v claw-control-center_clawhub_data:/data \
        -v $(cd "$BACKUP_PATH" && pwd):/backup \
        alpine tar xzf /backup -C /data
    
    docker-compose up -d
    log_success "Restore complete"
}

# Clean up (stop but keep data)
cmd_clean() {
    log_warn "Cleaning up containers..."
    read -p "Continue? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        return
    fi
    
    cd "$PROJECT_DIR"
    docker-compose down
    log_success "Containers removed (data preserved)"
}

# Destroy everything (⚠️ deletes data!)
cmd_destroy() {
    log_error "DANGER: This will delete all data!"
    read -p "Type 'destroy' to confirm: " CONFIRM
    
    if [ "$CONFIRM" != "destroy" ]; then
        log_info "Cancelled"
        return
    fi
    
    cd "$PROJECT_DIR"
    docker-compose down -v
    log_success "Everything removed (including data)"
}

# Full setup
cmd_setup() {
    log_info "Running full setup..."
    cmd_init
    cmd_build
    cmd_start
    log_success "Setup complete!"
    
    echo ""
    echo "📖 Next steps:"
    echo "  1. Access the UI at: http://localhost:3000"
    echo "  2. API available at: http://localhost:8787"
    echo "  3. View logs with: ./scripts/deploy.sh logs"
    echo "  4. Create backup with: ./scripts/deploy.sh backup"
}

# Update code and restart
cmd_update() {
    log_info "Updating code..."
    cd "$PROJECT_DIR"
    
    git pull origin main
    log_success "Code updated"
    
    cmd_build
    cmd_restart
    log_success "Services updated and restarted"
}

# Main
COMMAND="${1:-help}"

case "$COMMAND" in
    init)
        cmd_init
        ;;
    build)
        cmd_build
        ;;
    start)
        cmd_start
        ;;
    stop)
        cmd_stop
        ;;
    restart)
        cmd_restart
        ;;
    logs)
        cmd_logs "$2"
        ;;
    status)
        cmd_status
        ;;
    health)
        cmd_health
        ;;
    backup)
        cmd_backup "$2"
        ;;
    restore)
        cmd_restore "$2"
        ;;
    clean)
        cmd_clean
        ;;
    destroy)
        cmd_destroy
        ;;
    setup)
        cmd_setup
        ;;
    update)
        cmd_update
        ;;
    help|--help|-h)
        echo "Claw Control Center - Deployment Script"
        echo ""
        echo "Usage: ./scripts/deploy.sh [command] [options]"
        echo ""
        echo "Commands:"
        echo "  init              Initialize deployment (.env)"
        echo "  build             Build Docker images"
        echo "  start             Start services"
        echo "  stop              Stop services"
        echo "  restart           Restart services"
        echo "  logs [service]    View logs (bridge, ui, redis)"
        echo "  status            Check service status"
        echo "  health            Run health checks"
        echo "  backup [dir]      Create backup"
        echo "  restore [path]    Restore from backup"
        echo "  clean             Stop containers (keep data)"
        echo "  destroy           Stop and delete everything ⚠️"
        echo "  setup             Full setup (init + build + start)"
        echo "  update            Update code and restart"
        echo ""
        echo "Examples:"
        echo "  ./scripts/deploy.sh setup"
        echo "  ./scripts/deploy.sh logs bridge"
        echo "  ./scripts/deploy.sh backup /data/backups"
        echo ""
        ;;
    *)
        log_error "Unknown command: $COMMAND"
        echo "Use './scripts/deploy.sh help' for usage"
        exit 1
        ;;
esac
