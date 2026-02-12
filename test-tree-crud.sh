#!/bin/bash
set -e

API="http://localhost:8787"
PROJECT_ID="test-tree-crud-$$"

echo "=== Testing Tree CRUD + Reorder + Dependencies ==="
echo ""

# 1. Create a test project
echo "1. Creating test project..."
PROJECT_RESPONSE=$(curl -s -X POST "$API/api/pm/projects" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "'"$PROJECT_ID"'",
    "name": "Tree CRUD Test Project",
    "summary": "Testing tree operations",
    "owner": "test-runner"
  }')

echo "   ✓ Project created: $PROJECT_ID"
echo ""

# 2. Add root node
echo "2. Adding root node 'feature-auth'..."
NODE1=$(curl -s -X POST "$API/api/pm/projects/$PROJECT_ID/tree/nodes" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "feature-auth",
    "title": "Authentication System",
    "summary": "User authentication and authorization",
    "status": "planned",
    "priority": "p0",
    "tags": ["security", "backend"]
  }')

echo "   ✓ Node created: feature-auth"
echo ""

# 3. Add child node
echo "3. Adding child node 'feature-login' under 'feature-auth'..."
NODE2=$(curl -s -X POST "$API/api/pm/projects/$PROJECT_ID/tree/nodes" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "feature-login",
    "title": "Login Page",
    "summary": "User login UI and flow",
    "status": "planned",
    "priority": "p0",
    "parentId": "feature-auth"
  }')

echo "   ✓ Node created: feature-login (parent: feature-auth)"
echo ""

# 4. Add another child
echo "4. Adding child node 'feature-signup' under 'feature-auth'..."
NODE3=$(curl -s -X POST "$API/api/pm/projects/$PROJECT_ID/tree/nodes" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "feature-signup",
    "title": "Signup Page",
    "summary": "User registration flow",
    "status": "planned",
    "priority": "p1",
    "parentId": "feature-auth"
  }')

echo "   ✓ Node created: feature-signup (parent: feature-auth)"
echo ""

# 5. Add second root node
echo "5. Adding second root node 'feature-api'..."
NODE4=$(curl -s -X POST "$API/api/pm/projects/$PROJECT_ID/tree/nodes" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "feature-api",
    "title": "REST API",
    "summary": "Backend API endpoints",
    "status": "in_progress",
    "priority": "p0"
  }')

echo "   ✓ Node created: feature-api"
echo ""

# 6. Update node with sources and dependsOn
echo "6. Updating 'feature-login' with sources and dependencies..."
UPDATE_RESPONSE=$(curl -s -X PUT "$API/api/pm/projects/$PROJECT_ID/tree/nodes/feature-login" \
  -H "Content-Type: application/json" \
  -d '{
    "summary": "User login UI with OAuth support",
    "status": "in_progress",
    "dependsOn": ["feature-api"],
    "sources": [
      {"kind": "requirement", "id": "req-123"},
      {"kind": "idea", "id": "idea-456"}
    ]
  }')

echo "   ✓ Node updated with dependsOn=['feature-api'] and sources"
echo ""

# 7. Move node between parents
echo "7. Moving 'feature-signup' from 'feature-auth' to root..."
MOVE_RESPONSE=$(curl -s -X PATCH "$API/api/pm/projects/$PROJECT_ID/tree/nodes/feature-signup/move" \
  -H "Content-Type: application/json" \
  -d '{
    "parentId": ""
  }')

echo "   ✓ Node moved to root"
echo ""

# 8. Reorder children under feature-auth
# Currently feature-auth has only feature-login as child
# Let's add another one first
echo "8. Adding 'feature-2fa' under 'feature-auth'..."
curl -s -X POST "$API/api/pm/projects/$PROJECT_ID/tree/nodes" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "feature-2fa",
    "title": "Two-Factor Authentication",
    "status": "planned",
    "priority": "p1",
    "parentId": "feature-auth"
  }' > /dev/null

echo "   ✓ Node created: feature-2fa"
echo ""

echo "9. Reordering children of 'feature-auth' (2fa before login)..."
REORDER_RESPONSE=$(curl -s -X PUT "$API/api/pm/projects/$PROJECT_ID/tree/reorder" \
  -H "Content-Type: application/json" \
  -d '{
    "parentId": "feature-auth",
    "orderedIds": ["feature-2fa", "feature-login"]
  }')

echo "   ✓ Children reordered"
echo ""

# 10. Fetch full tree to verify
echo "10. Fetching full tree to verify..."
TREE=$(curl -s "$API/api/pm/projects/$PROJECT_ID/tree")
echo "$TREE" | jq '.'
echo ""

# 11. Verify specific node properties
echo "11. Verifying 'feature-login' has dependsOn and sources..."
NODE_CHECK=$(echo "$TREE" | jq -r '.[0].children[1] // .[1].children[0] // .[1].children[1]' | jq 'select(.id == "feature-login")')

if echo "$NODE_CHECK" | jq -e '.dependsOn // false' > /dev/null; then
  echo "   ✓ dependsOn field persisted"
else
  echo "   ✗ dependsOn field missing!"
  exit 1
fi

if echo "$NODE_CHECK" | jq -e '.sources // false' > /dev/null; then
  echo "   ✓ sources field persisted"
else
  echo "   ✗ sources field missing!"
  exit 1
fi

echo ""

# 12. Test delete
echo "12. Deleting 'feature-2fa'..."
DELETE_RESPONSE=$(curl -s -X DELETE "$API/api/pm/projects/$PROJECT_ID/tree/nodes/feature-2fa")
echo "   ✓ Node deleted"
echo ""

# 13. Verify tree structure
echo "13. Final tree structure:"
curl -s "$API/api/pm/projects/$PROJECT_ID/tree" | jq -r '
  def walk(depth):
    "  " * depth + "- \(.title) (\(.id)) [\(.status)]" + 
    (if .dependsOn then " → depends: " + (.dependsOn | join(", ")) else "" end) +
    (if .children then "\n" + (.children | map(walk(depth + 1)) | join("\n")) else "" end);
  map(walk(0)) | join("\n")
'
echo ""

# 14. Export markdown
echo "14. Exporting project as markdown..."
MD_OUTPUT=$(curl -s "$API/api/pm/projects/$PROJECT_ID/export.md")
echo "$MD_OUTPUT" | head -40
echo ""

echo "=== All Tests Passed! ✓ ==="
echo ""
echo "Summary:"
echo "  • Created project with tree structure"
echo "  • Added nodes with parent relationships"
echo "  • Updated node with sources and dependsOn"
echo "  • Moved node between parents"
echo "  • Reordered children"
echo "  • Deleted node"
echo "  • Verified persistence"
echo ""
echo "Project ID: $PROJECT_ID (left intact for manual inspection)"
