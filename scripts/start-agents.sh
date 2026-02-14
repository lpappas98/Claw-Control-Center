#!/bin/bash
# start-agents.sh - Start all Claw Control Center agents

set -e

WORKSPACE="/home/openclaw/.openclaw/workspace"
SCRIPT_DIR="$WORKSPACE/scripts"

echo "🚀 Starting Claw Control Center Agents..."
echo ""

# Check if bridge is running
if ! curl -s http://localhost:8787/api/status > /dev/null 2>&1; then
    echo "❌ Bridge is not running!"
    echo "   Start it with: cd $WORKSPACE && npm run bridge"
    exit 1
fi

echo "✅ Bridge is running"
echo ""

# Start the heartbeat manager (manages all agent processes)
echo "📡 Starting heartbeat manager..."
node "$SCRIPT_DIR/heartbeat-manager.mjs"
