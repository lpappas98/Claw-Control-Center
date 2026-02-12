# Tree CRUD + Reorder + Dependencies - Implementation Complete

**Task ID**: task-faa2b33ecdf8d-1770789344734  
**Status**: ✅ COMPLETE (moved to "review")  
**Agent**: Blueprint  
**Date**: 2026-02-12

## Summary

Successfully implemented and tested complete tree CRUD operations with node reordering and dependency tracking for PM Projects.

## What Was Implemented

### 1. Tree Node CRUD Endpoints ✅
All CRUD operations were already implemented and working:
- ✅ **POST** `/api/pm/projects/:id/tree/nodes` - Create node (with optional `parentId`)
- ✅ **PUT** `/api/pm/projects/:id/tree/nodes/:nodeId` - Update node properties
- ✅ **DELETE** `/api/pm/projects/:id/tree/nodes/:nodeId` - Delete node

### 2. NEW: Move Node Between Parents ✅
**Implementation**: Added `moveTreeNode()` function and endpoint
- ✅ **PATCH** `/api/pm/projects/:id/tree/nodes/:nodeId/move`
- Body: `{ "parentId": "new-parent-id" }` (empty string for root)
- Validates against cycles (can't move node to its own descendant)
- Properly extracts node and re-inserts under new parent

### 3. NEW: Reorder Children ✅
**Implementation**: Added `reorderTreeChildren()` function and endpoint
- ✅ **PUT** `/api/pm/projects/:id/tree/reorder`
- Body: `{ "parentId": "parent-id", "orderedIds": ["child-1", "child-2"] }`
- Works for both root-level nodes and children of any parent
- Validates all IDs exist and count matches

### 4. Data Persistence ✅
Both `sources` and `dependsOn` arrays:
- ✅ Normalized via `normalizeSources()` and `normalizeDependsOn()`
- ✅ Persisted correctly in `tree.json`
- ✅ Validated in tests with real data

## Testing

Comprehensive testing performed with multiple scenarios:

```
Test Project: test-tree-crud-140142
Final Test: final-test-140479
```

### Test Coverage
1. ✅ Create project with tree nodes
2. ✅ Add nodes with parent-child relationships
3. ✅ Update node with `dependsOn` and `sources` arrays
4. ✅ Move node from child to root
5. ✅ Move node between different parents
6. ✅ Reorder children within parent
7. ✅ Reorder root-level nodes
8. ✅ Delete nodes
9. ✅ Verify persistence across operations

### Sample Test Results

**Tree structure after all operations:**
```
- Signup Page (feature-signup) [planned]
- REST API (feature-api) [in_progress]
- Authentication System (feature-auth) [planned]
  - Login Page (feature-login) [in_progress] 
    → depends: feature-api 
    [sources: 2]
  - Two-Factor Authentication (feature-2fa) [planned]
```

**Data integrity verified:**
```json
{
  "id": "feature-login",
  "title": "Login Page",
  "status": "in_progress",
  "dependsOn": ["feature-api"],
  "sources": [
    {"kind": "requirement", "id": "req-123"},
    {"kind": "idea", "id": "idea-456"}
  ]
}
```

## Files Modified

1. **bridge/pmProjectsStore.mjs**
   - Added `moveTreeNode(rootDir, projectId, nodeId, newParentId)`
   - Added `reorderTreeChildren(rootDir, projectId, parentId, orderedIds)`
   - Cycle detection logic for move operations
   - Validation logic for reorder operations

2. **bridge/server.mjs**
   - Added PATCH `/api/pm/projects/:id/tree/nodes/:nodeId/move` endpoint
   - Added PUT `/api/pm/projects/:id/tree/reorder` endpoint
   - Imported new functions from pmProjectsStore

## Git Commit

```
commit 0b05a15
feat(pm-projects): add tree node move and reorder endpoints

- Add moveTreeNode() to support moving nodes between parents
- Add reorderTreeChildren() to reorder children within a parent
- Implement PATCH /api/pm/projects/:id/tree/nodes/:nodeId/move endpoint
- Implement PUT /api/pm/projects/:id/tree/reorder endpoint
- Validate against cycles when moving nodes
- Verify sources and dependsOn arrays persist correctly
- Tested all CRUD operations, move, and reorder functionality

Closes task-faa2b33ecdf8d-1770789344734
```

## API Examples

### Create Node with Dependencies
```bash
curl -X POST http://localhost:8787/api/pm/projects/my-project/tree/nodes \
  -H "Content-Type: application/json" \
  -d '{
    "id": "feature-login",
    "title": "Login Page",
    "parentId": "feature-auth",
    "dependsOn": ["feature-api"],
    "sources": [{"kind": "requirement", "id": "req-123"}]
  }'
```

### Move Node
```bash
curl -X PATCH http://localhost:8787/api/pm/projects/my-project/tree/nodes/feature-login/move \
  -H "Content-Type: application/json" \
  -d '{"parentId": ""}'  # Move to root
```

### Reorder Children
```bash
curl -X PUT http://localhost:8787/api/pm/projects/my-project/tree/reorder \
  -H "Content-Type: application/json" \
  -d '{
    "parentId": "feature-auth",
    "orderedIds": ["feature-2fa", "feature-login"]
  }'
```

## Next Steps

Task is now in **review** status and ready for:
1. Code review by team
2. Integration with UI components
3. Deployment to production

## Notes

- Server must be restarted after code changes to pick up new endpoints
- All operations properly update `updatedAt` timestamps
- Atomic writes ensure data consistency
- Test projects created: `test-tree-crud-140142`, `final-test-140479`
