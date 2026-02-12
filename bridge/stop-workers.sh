#!/bin/bash

# Stop all Operator Hub workers gracefully

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_DIR="$(dirname "$SCRIPT_DIR")"
PIDS_DIR="$WORKSPACE_DIR/.clawhub/pids"

# Worker slots
WORKERS=("pm" "architect" "dev-1" "dev-2" "qa")

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Graceful shutdown timeout (seconds)
TIMEOUT=10

echo -e "${GREEN}Stopping Operator Hub Workers...${NC}"

# Track workers that need force kill
declare -a STUCK_WORKERS=()

# Function to stop a single worker
stop_worker() {
  local slot=$1
  local pid_file="$PIDS_DIR/worker-$slot.pid"
  
  if [ ! -f "$pid_file" ]; then
    echo -e "${YELLOW}Worker $slot not running (no PID file)${NC}"
    return 0
  fi
  
  local pid=$(cat "$pid_file")
  
  # Check if process is actually running
  if ! kill -0 "$pid" 2>/dev/null; then
    echo -e "${YELLOW}Worker $slot not running (stale PID: $pid)${NC}"
    rm -f "$pid_file"
    return 0
  fi
  
  # Send SIGTERM for graceful shutdown
  echo "Stopping worker $slot (PID: $pid)..."
  kill -TERM "$pid" 2>/dev/null || true
  
  # Wait for graceful shutdown
  local elapsed=0
  while kill -0 "$pid" 2>/dev/null && [ $elapsed -lt $TIMEOUT ]; do
    sleep 0.5
    elapsed=$((elapsed + 1))
  done
  
  # Check if process stopped
  if kill -0 "$pid" 2>/dev/null; then
    echo -e "${YELLOW}Worker $slot did not stop gracefully${NC}"
    STUCK_WORKERS+=("$slot:$pid")
  else
    echo -e "${GREEN}✓ Worker $slot stopped${NC}"
    rm -f "$pid_file"
  fi
}

# Stop all workers
for worker in "${WORKERS[@]}"; do
  stop_worker "$worker"
done

# Force kill any stuck workers
if [ ${#STUCK_WORKERS[@]} -gt 0 ]; then
  echo ""
  echo -e "${YELLOW}Force killing stuck workers...${NC}"
  
  for worker_info in "${STUCK_WORKERS[@]}"; do
    local slot="${worker_info%%:*}"
    local pid="${worker_info##*:}"
    local pid_file="$PIDS_DIR/worker-$slot.pid"
    
    echo "Force killing worker $slot (PID: $pid)..."
    kill -9 "$pid" 2>/dev/null || true
    sleep 0.2
    
    if kill -0 "$pid" 2>/dev/null; then
      echo -e "${RED}✗ Failed to kill worker $slot${NC}"
    else
      echo -e "${GREEN}✓ Worker $slot killed${NC}"
      rm -f "$pid_file"
    fi
  done
fi

echo ""
echo -e "${GREEN}All workers stopped!${NC}"
echo ""
