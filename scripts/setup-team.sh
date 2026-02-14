#!/bin/bash

#############################################################################
# OpenClaw Team Setup Script
# 
# Quickly set up a preconfigured team with all agents, workspaces, and configs.
# 
# Usage:
#   ./setup-team.sh alpha [bridge-url] [--force]
#   ./setup-team.sh beta
#   ./setup-team.sh solo
# 
# Options:
#   --force       Skip confirmation and overwrite existing setup
#   --bridge URL  Custom bridge URL (default: http://localhost:8787)
#   --help        Show this help message
#
# This script is idempotent - safe to run multiple times.
#############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TEMPLATES_DIR="$WORKSPACE_ROOT/templates"
TEAMS_DIR="$TEMPLATES_DIR/teams"
SOULS_DIR="$TEMPLATES_DIR/souls"

BRIDGE_URL="${BRIDGE_URL:-http://localhost:8787}"
TEAM_NAME=""
FORCE=false

# Functions
print_header() {
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

print_step() {
    echo -e "${YELLOW}→${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

show_help() {
    echo "OpenClaw Team Setup Script"
    echo ""
    echo "Usage: setup-team.sh <team-name> [options]"
    echo ""
    echo "Teams available:"
    echo "  alpha   - General Development (PM + Dev + Designer)"
    echo "  beta    - QA & Content (QA + Content + Scout)"
    echo "  solo    - Single PM (Lightweight coordination)"
    echo ""
    echo "Options:"
    echo "  --bridge URL   Custom bridge URL (default: http://localhost:8787)"
    echo "  --force        Skip confirmation, overwrite existing setup"
    echo "  --help         Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./setup-team.sh alpha"
    echo "  ./setup-team.sh beta --bridge http://192.168.1.100:8787"
    echo "  ./setup-team.sh solo --force"
}

parse_arguments() {
    # Check for help first
    for arg in "$@"; do
        if [[ "$arg" == "--help" || "$arg" == "-h" ]]; then
            show_help
            exit 0
        fi
    done
    
    if [[ $# -eq 0 ]]; then
        print_error "Team name is required"
        show_help
        exit 1
    fi
    
    # First positional arg is team name (if not an option)
    if [[ "$1" == -* ]]; then
        print_error "Team name must be provided"
        show_help
        exit 1
    fi
    
    TEAM_NAME="$1"
    shift
    
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --bridge)
                BRIDGE_URL="$2"
                shift 2
                ;;
            --force)
                FORCE=true
                shift
                ;;
            *)
                print_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
}

validate_team() {
    local team_file="$TEAMS_DIR/team-${TEAM_NAME}.json"
    
    if [[ ! -f "$team_file" ]]; then
        print_error "Team config not found: $team_file"
        echo ""
        echo "Available teams:"
        ls -1 "$TEAMS_DIR"/team-*.json | xargs -I {} basename {} | sed 's/team-//;s/.json//' | sed 's/^/  - /'
        exit 1
    fi
}

validate_dependencies() {
    print_step "Checking dependencies..."
    
    # Check bash version (need 4+)
    if [[ ${BASH_VERSINFO[0]} -lt 4 ]]; then
        print_error "Bash 4.0+ required (you have ${BASH_VERSION})"
        exit 1
    fi
    
    # Check OpenClaw is installed (optional, many are using this standalone)
    if command -v openclaw &> /dev/null; then
        print_success "Found openclaw CLI"
    else
        print_success "Note: openclaw CLI not found (will be needed to start agents)"
    fi
    
    # Check jq for JSON validation (optional, will do basic validation without it)
    if command -v jq &> /dev/null; then
        print_success "Found jq (JSON validator)"
    else
        print_success "Note: jq not found (using basic validation)"
    fi
}

validate_json() {
    local file=$1
    
    # Try jq if available
    if command -v jq &> /dev/null; then
        if ! jq empty "$file" 2>/dev/null; then
            print_error "Invalid JSON in $file"
            exit 1
        fi
    else
        # Basic validation without jq - just check it can be parsed
        if ! python3 -m json.tool "$file" &> /dev/null; then
            if ! cat "$file" | grep -q '"agents"'; then
                print_error "Invalid JSON in $file"
                exit 1
            fi
        fi
    fi
}

create_agent_workspace() {
    local agent_id=$1
    local agent_name=$2
    local agent_role=$3
    local soul_file=$4
    
    local workspace_dir="$HOME/.openclaw/agents/$agent_id"
    
    # Create workspace directory
    mkdir -p "$workspace_dir"
    mkdir -p "$workspace_dir/.claw"
    mkdir -p "$workspace_dir/memory"
    
    # Copy SOUL.md if it exists
    if [[ -f "$soul_file" ]]; then
        cp "$soul_file" "$workspace_dir/SOUL.md"
        print_success "Created SOUL.md for $agent_name"
    fi
    
    # Create HEARTBEAT.md if it doesn't exist
    if [[ ! -f "$workspace_dir/HEARTBEAT.md" ]]; then
        cat > "$workspace_dir/HEARTBEAT.md" << EOF
# HEARTBEAT.md - $agent_name Tasks

Quick periodic checks during active work:

- [ ] Check for new messages from team
- [ ] Review recent memory/notes
- [ ] Check for blockers from other agents
- [ ] Update team on progress

Report \`HEARTBEAT_OK\` if nothing urgent.
EOF
        print_success "Created HEARTBEAT.md for $agent_name"
    fi
    
    # Create basic .claw/config.json
    if [[ ! -f "$workspace_dir/.claw/config.json" ]]; then
        cat > "$workspace_dir/.claw/config.json" << EOF
{
  "id": "$agent_id",
  "name": "$agent_name",
  "workspace": "$workspace_dir",
  "model": "anthropic/claude-haiku-4-5",
  "bridge": {
    "url": "$BRIDGE_URL",
    "retryIntervalMs": 5000,
    "maxRetries": 10
  },
  "roles": ["$agent_role"],
  "heartbeatIntervalMs": 30000
}
EOF
        print_success "Created .claw/config.json for $agent_name"
    fi
}

setup_team() {
    local team_file="$TEAMS_DIR/team-${TEAM_NAME}.json"
    
    print_header "Setting up Team $TEAM_NAME"
    
    # Helper function to extract JSON values (compatible with jq or without)
    extract_json() {
        local file=$1
        local path=$2
        
        if command -v jq &> /dev/null; then
            jq -r "$path" "$file"
        else
            # Fallback: basic grep/sed parsing (limited but works for simple cases)
            python3 << EOF
import json
with open('$file', 'r') as f:
    data = json.load(f)
result = data
for key in '$path'.replace('.[', '[').split('.'):
    if key.startswith('[') and key.endswith(']'):
        idx = int(key[1:-1])
        result = result[idx]
    elif key:
        result = result[key]
print(result if isinstance(result, str) else json.dumps(result))
EOF
        fi
    }
    
    # Parse team config and set up each agent
    local agent_list=$(python3 -c "
import json
with open('$team_file', 'r') as f:
    data = json.load(f)
    for i, agent in enumerate(data['agents']['list']):
        print(f\"{i}|{agent['id']}|{agent['name']}|{agent['roles'][0]}\")
    ")
    
    print_step "Creating workspaces for each agent..."
    
    while IFS='|' read -r i agent_id agent_name agent_roles; do
        # Determine SOUL.md based on role
        local soul_file=""
        case "$agent_roles" in
            pm|architect|coordination)
                soul_file="$SOULS_DIR/pm-soul.md"
                ;;
            backend-dev|frontend-dev|api)
                soul_file="$SOULS_DIR/dev-soul.md"
                ;;
            designer|ui|ux)
                soul_file="$SOULS_DIR/designer-soul.md"
                ;;
            qa|testing|verification)
                soul_file="$SOULS_DIR/qa-soul.md"
                ;;
            content|documentation|writing)
                soul_file="$SOULS_DIR/content-soul.md"
                ;;
            research|seo|analysis)
                soul_file="$SOULS_DIR/research-soul.md"
                ;;
        esac
        
        print_step "Setting up $agent_name ($agent_id)..."
        create_agent_workspace "$agent_id" "$agent_name" "$agent_roles" "$soul_file"
    done <<< "$agent_list"
}

startup_instructions() {
    print_header "Team Setup Complete! ✓"
    
    echo "Team: ${BLUE}$TEAM_NAME${NC}"
    echo "Bridge: ${BLUE}$BRIDGE_URL${NC}"
    echo ""
    
    # List agents
    echo "Agents:"
    local team_file="$TEAMS_DIR/team-${TEAM_NAME}.json"
    
    python3 << EOF
import json
with open('$team_file', 'r') as f:
    data = json.load(f)
    for agent in data['agents']['list']:
        print(f"  {agent['emoji']} {agent['name']} ({agent['id']})")
EOF
    
    echo ""
    echo "Next steps:"
    echo ""
    echo "1. ${YELLOW}Start the bridge:${NC}"
    echo "   ${BLUE}openclaw bridge start${NC}"
    echo ""
    echo "2. ${YELLOW}In separate terminals, start each agent:${NC}"
    
    python3 << EOF
import json
with open('$team_file', 'r') as f:
    data = json.load(f)
    for agent in data['agents']['list']:
        print(f"   openclaw --agent {agent['id']}")
EOF
    
    echo ""
    echo "3. ${YELLOW}Verify agents registered:${NC}"
    echo "   ${BLUE}curl http://localhost:8787/api/agents${NC}"
    echo ""
    echo "Team files:"
    echo "  Config: ${BLUE}$team_file${NC}"
    echo "  SOUL templates: ${BLUE}$SOULS_DIR/${NC}"
    echo ""
}

confirm_setup() {
    if $FORCE; then
        return 0
    fi
    
    echo "This will create/update agent workspaces at ${BLUE}~/.openclaw/agents/...${NC}"
    echo ""
    echo "Team: ${GREEN}$TEAM_NAME${NC}"
    echo "Bridge: ${GREEN}$BRIDGE_URL${NC}"
    echo ""
    read -p "Continue? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_error "Cancelled"
        exit 1
    fi
}

# Main
main() {
    parse_arguments "$@"
    validate_dependencies
    validate_team
    validate_json "$TEAMS_DIR/team-${TEAM_NAME}.json"
    confirm_setup
    setup_team
    startup_instructions
}

main "$@"
