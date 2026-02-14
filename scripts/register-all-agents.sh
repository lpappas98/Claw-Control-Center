#!/bin/bash
# register-all-agents.sh - Manually register all agents with the bridge

set -e

BRIDGE_URL="http://localhost:8787"

echo "📡 Registering all Claw Control Center agents..."
echo ""

# Check if bridge is running
if ! curl -s $BRIDGE_URL/api/status > /dev/null 2>&1; then
    echo "❌ Bridge is not running at $BRIDGE_URL"
    echo "   Start it with: cd ~/.openclaw/workspace && npm run bridge"
    exit 1
fi

echo "✅ Bridge is running"
echo ""

# Register TARS (PM)
echo "🧠 Registering TARS (Project Manager)..."
curl -s -X POST $BRIDGE_URL/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "id": "tars",
    "name": "TARS",
    "emoji": "🧠",
    "roles": ["pm", "architect", "coordinator"],
    "model": "ollama/llama3.1:8b@http://192.168.1.21:11434",
    "workspace": "/home/openclaw/.openclaw/workspace"
  }' | jq -r '.name // "Already registered"'

# Register Forge (Backend Dev)
echo "🛠️  Registering Forge (Backend Developer)..."
curl -s -X POST $BRIDGE_URL/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "id": "dev-1",
    "name": "Forge",
    "emoji": "🛠️",
    "roles": ["backend-dev", "api", "database", "node", "express"],
    "model": "ollama/llama3.1:8b@http://192.168.1.21:11434",
    "workspace": "/home/openclaw/.openclaw/workspace"
  }' | jq -r '.name // "Already registered"'

# Register Patch (Frontend Dev)
echo "🧩 Registering Patch (Frontend Developer)..."
curl -s -X POST $BRIDGE_URL/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "id": "dev-2",
    "name": "Patch",
    "emoji": "🧩",
    "roles": ["frontend-dev", "ui", "react", "typescript", "css"],
    "model": "ollama/llama3.1:8b@http://192.168.1.21:11434",
    "workspace": "/home/openclaw/.openclaw/workspace"
  }' | jq -r '.name // "Already registered"'

# Register Sentinel (QA)
echo "🛡️  Registering Sentinel (QA Engineer)..."
curl -s -X POST $BRIDGE_URL/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "id": "qa",
    "name": "Sentinel",
    "emoji": "🛡️",
    "roles": ["qa", "testing", "review", "validation", "e2e"],
    "model": "ollama/llama3.1:8b@http://192.168.1.21:11434",
    "workspace": "/home/openclaw/.openclaw/workspace"
  }' | jq -r '.name // "Already registered"'

# Register Blueprint (Architect)
echo "🏗️  Registering Blueprint (System Architect)..."
curl -s -X POST $BRIDGE_URL/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "id": "architect",
    "name": "Blueprint",
    "emoji": "🏗️",
    "roles": ["architect", "design", "planning", "system-design"],
    "model": "ollama/llama3.1:8b@http://192.168.1.21:11434",
    "workspace": "/home/openclaw/.openclaw/workspace"
  }' | jq -r '.name // "Already registered"'

echo ""
echo "✅ All agents registered!"
echo ""
echo "📊 View agents:"
echo "   curl $BRIDGE_URL/api/agents | jq"
echo "   UI: http://localhost:5173 → Agents tab"
echo ""
echo "📋 Next steps:"
echo "   1. Create tasks in the UI"
echo "   2. Agents will pick up tasks matching their roles"
echo "   3. Monitor progress in the Agents tab"
