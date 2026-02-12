#!/bin/bash

# Start all Operator Hub workers
# Each worker runs as a separate process and logs to its own file

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_DIR="$(dirname "$SCRIPT_DIR")"
LOGS_DIR="$WORKSPACE_DIR/logs"
PIDS_DIR="$WORKSPACE_DIR/.clawhub/pids"

# Worker slots
WORKERS=("pm" "architect" "dev-1" "dev-2" "qa")

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting Operator Hub Workers...${NC}"

# Create directories if they don't exist
mkdir -p "$LOGS_DIR"
mkdir -p "$PIDS_DIR"

# Function to start a single worker
start_worker() {
  local slot=$1
  local log_file="$LOGS_DIR/worker-$slot.log"
  local pid_file="$PIDS_DIR/worker-$slot.pid"
  
  # Check if worker is already running
  if [ -f "$pid_file" ]; then
    local old_pid=$(cat "$pid_file")
    if kill -0 "$old_pid" 2>/dev/null; then
      echo -e "${YELLOW}Worker $slot already running (PID: $old_pid)${NC}"
      return 0
    else
      # Stale PID file, remove it
      rm -f "$pid_file"
    fi
  fi
  
  # Start worker in background
  nohup node "$SCRIPT_DIR/workerService.mjs" "$slot" >> "$log_file" 2>&1 &
  local pid=$!
  
  # Save PID
  echo "$pid" > "$pid_file"
  
  # Wait a moment to check if process started successfully
  sleep 0.5
  
  if kill -0 "$pid" 2>/dev/null; then
    echo -e "${GREEN}✓ Worker $slot started (PID: $pid)${NC}"
  else
    echo -e "${YELLOW}✗ Worker $slot failed to start${NC}"
    rm -f "$pid_file"
    return 1
  fi
}

# Start all workers
for worker in "${WORKERS[@]}"; do
  start_worker "$worker"
done

echo ""
echo -e "${GREEN}All workers started!${NC}"
echo ""
echo "View logs:"
for worker in "${WORKERS[@]}"; do
  echo "  tail -f $LOGS_DIR/worker-$worker.log"
done
echo ""
echo "Stop workers:"
echo "  bash $SCRIPT_DIR/stop-workers.sh"
echo ""
