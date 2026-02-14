#!/bin/bash
# Helper: Update agent currentTask when picking up work

AGENT_ID="${1:-dev-2}"
TASK_ID="${2:-null}"
TASK_TITLE="${3:-}"
BRIDGE_URL="http://localhost:8787"

if [ "$TASK_ID" = "null" ]; then
  # Clearing current task
  curl -s -X PUT "$BRIDGE_URL/api/agents/$AGENT_ID" \
    -H "Content-Type: application/json" \
    -d '{"currentTask": null}' | python3 -m json.tool | head -10
else
  # Setting current task
  PAYLOAD=$(cat <<EOJ
{
  "currentTask": {
    "id": "$TASK_ID",
    "title": "$TASK_TITLE"
  }
}
EOJ
)
  curl -s -X PUT "$BRIDGE_URL/api/agents/$AGENT_ID" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" | python3 -m json.tool | head -10
fi
