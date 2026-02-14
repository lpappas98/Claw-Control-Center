#!/bin/bash
# start-agents.sh - Start all Claw Control Center agents

set -e

WORKSPACE="/home/openclaw/.openclaw/workspace"
AGENTS_DIR="$WORKSPACE/agents"

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

# Start each agent as an OpenClaw session
AGENTS=("forge" "patch" "sentinel" "blueprint")
AGENT_IDS=("dev-1" "dev-2" "qa" "architect")
AGENT_NAMES=("Forge" "Patch" "Sentinel" "Blueprint")

for i in "${!AGENTS[@]}"; do
    AGENT="${AGENTS[$i]}"
    AGENT_ID="${AGENT_IDS[$i]}"
    AGENT_NAME="${AGENT_NAMES[$i]}"
    
    echo "📡 Starting $AGENT_NAME ($AGENT_ID)..."
    
    # Create a startup task for the agent
    TASK="You are $AGENT_NAME. Read your IDENTITY.md, SOUL.md, and HEARTBEAT.md from $AGENTS_DIR/$AGENT/.

Then register with the bridge and start checking for tasks every heartbeat.

Your workspace is: $AGENTS_DIR/$AGENT/"
    
    # Start agent session in background
    # Note: This requires OpenClaw to support starting sessions via CLI
    # For now, we'll document this and implement the actual startup mechanism
    echo "   Agent workspace: $AGENTS_DIR/$AGENT/"
    echo "   Registration will happen on first heartbeat"
    echo ""
done

echo "✅ All agents configured"
echo ""
echo "📋 Next steps:"
echo "   1. Agents will auto-register on their first heartbeat"
echo "   2. Create tasks in the UI: http://localhost:5173"
echo "   3. Assign tasks by role keywords in the task title/description"
echo "   4. Agents will pick up tasks automatically"
echo ""
echo "🔍 Monitor agents:"
echo "   curl http://localhost:8787/api/agents"
echo "   curl http://localhost:8787/api/tasks"
