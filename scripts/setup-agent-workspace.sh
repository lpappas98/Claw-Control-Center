#!/bin/bash

##
# Agent Workspace Setup Script
#
# Creates a complete workspace directory for an agent.
# Sets up HEARTBEAT.md, SOUL.md, and .claw/config.json
#
# Usage:
#   ./scripts/setup-agent-workspace.sh dev-agent "💻" "backend-dev,frontend-dev"
#   ./scripts/setup-agent-workspace.sh pixel "🎬" "qa" --bridge http://192.168.1.100:8787
#   ./scripts/setup-agent-workspace.sh designer "🎨" "design" --workspace /custom/path
##

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BRIDGE_URL="${BRIDGE_URL:-http://localhost:8787}"
AGENTS_WORKSPACE_BASE="${AGENTS_WORKSPACE_BASE:-$HOME/.openclaw/agents}"
TEMPLATES_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/templates"

# Helper functions
print_help() {
  cat <<EOF
Agent Workspace Setup
=====================

Creates a complete workspace directory for an agent with all necessary files.

Usage:
  ./scripts/setup-agent-workspace.sh <agent-id> <emoji> <roles> [options]

Arguments:
  <agent-id>    Agent identifier (e.g., dev-1, pixel, qa-agent)
  <emoji>       Agent avatar emoji (e.g., 🔧, 🎬, 🎨)
  <roles>       Comma-separated roles (e.g., backend-dev,api or qa,testing)

Options:
  --bridge <url>      Bridge server URL (default: http://localhost:8787)
  --workspace <path>  Custom workspace base path (default: ~/.openclaw/agents)
  --name <name>       Display name (default: agent-id)
  --help              Show this help

Examples:
  Setup backend developer:
    ./scripts/setup-agent-workspace.sh dev-1 "💻" "backend-dev,api"

  Setup QA agent:
    ./scripts/setup-agent-workspace.sh qa-1 "🧪" "qa,testing" --name "QA Team"

  With custom bridge:
    ./scripts/setup-agent-workspace.sh pixel "🎬" "design" \\
      --bridge http://192.168.1.100:8787

  With custom workspace:
    ./scripts/setup-agent-workspace.sh prod-agent "⚙️" "devops" \\
      --workspace /var/lib/agents

Environment Variables:
  BRIDGE_URL                Bridge server URL
  AGENTS_WORKSPACE_BASE     Base directory for agent workspaces
  TEMPLATES_DIR             Directory containing templates

Files Created:
  \$AGENT_WORKSPACE/
    ├── HEARTBEAT.md           Template for agent heartbeat workflows
    ├── SOUL.md                Agent identity and capabilities
    ├── .claw/
    │   ├── config.json        Bridge configuration and metadata
    │   └── agent-id.txt       Agent ID (for quick reference)
    └── .gitignore             Git ignore rules

EOF
}

# Parse arguments
if [[ $# -lt 3 ]]; then
  echo -e "${RED}Error: Missing required arguments${NC}"
  print_help
  exit 1
fi

if [[ "$1" == "--help" || "$1" == "-h" ]]; then
  print_help
  exit 0
fi

AGENT_ID="$1"
EMOJI="$2"
ROLES="$3"
shift 3

# Parse options
AGENT_NAME="$AGENT_ID"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --bridge)
      BRIDGE_URL="$2"
      shift 2
      ;;
    --workspace)
      AGENTS_WORKSPACE_BASE="$2"
      shift 2
      ;;
    --name)
      AGENT_NAME="$2"
      shift 2
      ;;
    --help|-h)
      print_help
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      print_help
      exit 1
      ;;
  esac
done

# Validate inputs
if [[ -z "$AGENT_ID" || -z "$EMOJI" || -z "$ROLES" ]]; then
  echo -e "${RED}Error: Agent ID, emoji, and roles are required${NC}"
  exit 1
fi

if ! command -v jq &> /dev/null; then
  echo -e "${YELLOW}Warning: jq not found. JSON output will be formatted with node${NC}"
fi

# Setup directories
AGENT_WORKSPACE="$AGENTS_WORKSPACE_BASE/$AGENT_ID"
CLAW_DIR="$AGENT_WORKSPACE/.claw"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Agent Workspace Setup${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${GREEN}📋 Configuration:${NC}"
echo "   Agent ID:    $AGENT_ID"
echo "   Name:        $AGENT_NAME"
echo "   Emoji:       $EMOJI"
echo "   Roles:       $ROLES"
echo "   Workspace:   $AGENT_WORKSPACE"
echo "   Bridge:      $BRIDGE_URL"
echo ""

# Create directories
echo -e "${GREEN}📁 Creating directories...${NC}"
mkdir -p "$CLAW_DIR"
echo "   ✅ Created: $AGENT_WORKSPACE"
echo "   ✅ Created: $CLAW_DIR"
echo ""

# Copy HEARTBEAT.md template
echo -e "${GREEN}📋 Setting up HEARTBEAT.md...${NC}"
if [[ -f "$TEMPLATES_DIR/agent-heartbeat.md" ]]; then
  cp "$TEMPLATES_DIR/agent-heartbeat.md" "$AGENT_WORKSPACE/HEARTBEAT.md"
  echo "   ✅ Copied: HEARTBEAT.md"
else
  echo -e "${YELLOW}⚠️  Template not found: $TEMPLATES_DIR/agent-heartbeat.md${NC}"
  echo "   Creating minimal HEARTBEAT.md..."
  cat > "$AGENT_WORKSPACE/HEARTBEAT.md" << 'HEARTBEAT_EOF'
# Agent Heartbeat

This is a placeholder. See the main templates/agent-heartbeat.md for the full template.

## Quick Checklist

- [ ] Check for new tasks: `claw check`
- [ ] List queued tasks: `claw tasks --status queued`
- [ ] Pick a task: `claw task:start <id>`
- [ ] Work on it
- [ ] Mark done: `claw task:done <id>`

If no tasks: reply `HEARTBEAT_OK`
HEARTBEAT_EOF
  echo "   ✅ Created: HEARTBEAT.md (minimal)"
fi
echo ""

# Create SOUL.md (agent identity)
echo -e "${GREEN}💫 Setting up SOUL.md...${NC}"
cat > "$AGENT_WORKSPACE/SOUL.md" << SOUL_EOF
# $EMOJI $AGENT_NAME - Agent Identity

**Agent ID:** \`$AGENT_ID\`
**Name:** $AGENT_NAME
**Emoji:** $EMOJI
**Status:** Online

## Capabilities

**Roles:** $ROLES

Your expertise:
- $(echo "$ROLES" | tr ',' '\n' | sed 's/^/  - /')

## Personality

You are a focused, efficient agent. You:
- Pick high-priority tasks that match your skills
- Log time accurately and regularly
- Communicate blockers immediately
- Complete what you start
- Help others when you have capacity

## Workspace

- Location: \`$AGENT_WORKSPACE\`
- Bridge: \`$BRIDGE_URL\`
- Config: \`.claw/config.json\`

## Daily Routine

**Every 15 minutes:**
1. Read HEARTBEAT.md
2. Check for tasks: \`claw check\`
3. Pick highest priority unblocked task
4. Work until done or stuck
5. Log time and report status

## Current Tasks

(Updated by heartbeat workflow)

- None (standby)

---

*This file helps you remember who you are and what you're good at.*
SOUL_EOF
echo "   ✅ Created: SOUL.md"
echo ""

# Create .claw/config.json
echo -e "${GREEN}⚙️  Setting up .claw/config.json...${NC}"

# Convert roles to JSON array
IFS=',' read -ra ROLES_ARRAY <<< "$ROLES"
ROLES_JSON="["
for i in "${!ROLES_ARRAY[@]}"; do
  ROLE="${ROLES_ARRAY[$i]// /}"
  if [[ $i -gt 0 ]]; then
    ROLES_JSON+=","
  fi
  ROLES_JSON+="\"$ROLE\""
done
ROLES_JSON+="]"

# Create config file
cat > "$CLAW_DIR/config.json" << CONFIG_EOF
{
  "agentId": "$AGENT_ID",
  "name": "$AGENT_NAME",
  "emoji": "$EMOJI",
  "roles": $ROLES_JSON,
  "bridgeUrl": "$BRIDGE_URL",
  "workspace": "$AGENT_WORKSPACE",
  "createdAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "heartbeatInterval": 900000,
  "maxConcurrentTasks": 3,
  "statusCheckInterval": 300000
}
CONFIG_EOF
echo "   ✅ Created: .claw/config.json"
echo ""

# Create agent-id.txt for quick reference
echo "$AGENT_ID" > "$CLAW_DIR/agent-id.txt"
echo "   ✅ Created: .claw/agent-id.txt"
echo ""

# Create .gitignore
echo -e "${GREEN}🔒 Setting up .gitignore...${NC}"
cat > "$AGENT_WORKSPACE/.gitignore" << GITIGNORE_EOF
# Agent workspace local files
.claw/agent-id.txt
.claw/.env
.claw/logs/

# Task tracking
tasks.cache.json
notifications.cache.json

# System files
.DS_Store
*.log
*.tmp
Thumbs.db

# Node modules
node_modules/

# Build artifacts
dist/
build/
GITIGNORE_EOF
echo "   ✅ Created: .gitignore"
echo ""

# Summary
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Workspace setup complete!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${YELLOW}📌 Next Steps:${NC}"
echo ""
echo "1. Register the agent with the bridge:"
echo "   ${BLUE}node scripts/register-agent.mjs --agent $AGENT_ID --roles \"${ROLES// /}\" --emoji $EMOJI${NC}"
echo ""
echo "2. Start using the workspace:"
echo "   ${BLUE}cd $AGENT_WORKSPACE${NC}"
echo ""
echo "3. Test heartbeat manually:"
echo "   ${BLUE}cd $AGENT_WORKSPACE && cat HEARTBEAT.md${NC}"
echo ""
echo "4. Setup cron for automatic heartbeats:"
echo "   ${BLUE}node scripts/setup-heartbeats.mjs --agent $AGENT_ID${NC}"
echo ""
echo -e "${YELLOW}📂 Workspace Contents:${NC}"
tree -a -L 2 "$AGENT_WORKSPACE" 2>/dev/null || find "$AGENT_WORKSPACE" -type f -o -type d | sed 's|'"$AGENT_WORKSPACE"'|.|g' | sort
echo ""
echo -e "${BLUE}ℹ️  Configuration stored in: .claw/config.json${NC}"
echo ""
