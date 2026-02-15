# Task Implementation Summary: Extract Duration/Tokens from Sub-Agent Transcripts

**Task ID:** task-491a2b73a55ef-1771195846965  
**Priority:** P1  
**Status:** Complete ✅

## Overview

Implemented comprehensive transcript parsing to extract performance metrics from sub-agent sessions and expose them via the API.

## Changes Made

### 1. Created `transcriptParser.mjs`
**Path:** `/home/openclaw/.openclaw/workspace/bridge/transcriptParser.mjs`

New module that parses `.jsonl` transcript files to extract:
- **Duration:** Time from first to last message (in milliseconds)
- **Total Tokens:** Sum of token usage across all assistant messages
- **Model:** Model identifier used for the session
- **Status:** Success/failure based on stop reason and message content

**Key Features:**
- Graceful error handling for missing files
- Handles malformed JSON gracefully
- Returns null values for missing/incomplete data
- Exports `parseTranscript()` and `parseTranscriptBySessionKey()` functions

### 2. Updated `subAgentRegistry.mjs`
**Path:** `/home/openclaw/.openclaw/workspace/bridge/subAgentRegistry.mjs`

**Added Fields:**
```javascript
{
  duration: number | null,      // Session duration in milliseconds
  totalTokens: number | null,   // Total tokens consumed
  model: string | null          // Model identifier
}
```

**Modified Methods:**
- `register()`: Initialize new fields to `null`
- `markComplete()`: Parse transcript and populate metrics
- `markCompleteByTaskId()`: Parse transcript and populate metrics

**Behavior:**
- Automatically extracts metrics when marking sessions as complete
- Falls back gracefully if transcript is missing or unparseable
- Logs detailed information about extracted metrics

### 3. Updated API Endpoints
**Path:** `/home/openclaw/.openclaw/workspace/bridge/server.mjs`

**Modified Endpoints:**
- `GET /api/agents/status`: Now includes `duration`, `totalTokens`, and `model` in `currentTask` object
- `GET /api/agents/active`: Now includes the same metrics for active agents

**Response Format:**
```json
{
  "agents": [{
    "currentTask": {
      "duration": 4000,
      "totalTokens": 47422,
      "model": "claude-haiku-4-5",
      // ... other existing fields
    }
  }]
}
```

### 4. Updated TypeScript Types
**Path:** `/home/openclaw/.openclaw/workspace/src/adapters/bridgeAdapter.ts`

Updated inline type definition to include new fields:
```typescript
currentTask: {
  // ... existing fields
  duration: number | null;
  totalTokens: number | null;
  model: string | null;
}
```

### 5. Created Backfill Script
**Path:** `/home/openclaw/.openclaw/workspace/bridge/backfill-transcript-metrics.mjs`

Utility script to retroactively parse transcripts for existing registry entries.
- Processes all entries in the registry
- Extracts metrics from historical transcripts
- Updates registry with extracted data
- Reports statistics (updated/skipped/errors)

### 6. Comprehensive Test Coverage

**Created Tests:**
1. `transcriptParser.test.mjs` - Tests for transcript parsing logic
   - ✅ Handles missing files gracefully
   - ✅ Parses valid transcripts correctly
   - ✅ Handles empty files gracefully
   - ✅ Handles malformed JSON gracefully

2. `subAgentRegistry.test.mjs` - Tests for registry integration
   - ✅ Initializes new entries with null metrics
   - ✅ Extracts metrics when marking complete
   - ✅ Handles missing transcripts gracefully

**Test Results:**
```
# tests 7
# pass 7
# fail 0
```

## Acceptance Criteria Status

- ✅ **Parse sub-agent session transcripts** - `transcriptParser.mjs` extracts all required metrics
- ✅ **Extract duration** - Calculated as `lastMessageTimestamp - firstMessageTimestamp`
- ✅ **Extract token usage** - Sums `usage.totalTokens` from all assistant messages
- ✅ **Extract model** - Reads from `model_change` or message events
- ✅ **Extract success/failure status** - Based on `stopReason` and message content
- ✅ **Store in SubAgentRegistry** - New fields added: `duration`, `totalTokens`, `model`
- ✅ **Update /api/agents/status** - Endpoint returns new fields
- ✅ **Handle missing/incomplete transcripts** - Returns null values, logs warnings
- ✅ **0 TypeScript/ESM errors** - Build completes successfully

## Verification

### Build Verification
```bash
npm run build
✓ built in 1.17s (no errors)
```

### Test Verification
```bash
node --test bridge/transcriptParser.test.mjs
# pass 4

node --test bridge/subAgentRegistry.test.mjs
# pass 3
```

### Runtime Verification
- Docker image rebuilt: `e26b304fbb91`
- Container restarted successfully
- API endpoint tested and working
- Transcript parsing tested with real session files

### Sample Output
```javascript
// Parsed transcript example
{
  duration: 2909,
  totalTokens: 47422,
  model: "claude-haiku-4-5",
  status: "completed"
}
```

## Deployment

1. ✅ Code changes committed to workspace
2. ✅ Docker image rebuilt
3. ✅ Container restarted with new image
4. ✅ API endpoints verified working

## Files Modified

- `bridge/transcriptParser.mjs` (new)
- `bridge/transcriptParser.test.mjs` (new)
- `bridge/subAgentRegistry.mjs` (modified)
- `bridge/subAgentRegistry.test.mjs` (new)
- `bridge/backfill-transcript-metrics.mjs` (new)
- `bridge/server.mjs` (modified)
- `src/adapters/bridgeAdapter.ts` (modified)

## Notes

- Existing registry entries will have `null` values for metrics until they complete
- The backfill script can be run to populate metrics for historical sessions (if transcripts still exist)
- Most old transcripts have been pruned, so historical data may be limited
- All error cases are handled gracefully with appropriate logging

## Next Steps

1. Monitor API endpoint in production
2. Consider adding metrics to the UI dashboard
3. Potentially add aggregated statistics (avg duration, total tokens per agent)
