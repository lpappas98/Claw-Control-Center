# Component Tests

This directory contains Playwright end-to-end tests for UI components.

## TaskModal.spec.ts

Comprehensive test coverage for the TaskModal component, including:

### Test Coverage

**Modal Behavior (8 tests)**
- Opens/closes correctly (backdrop, X button, Cancel button)
- Delete confirmation dialog workflow
- Tab switching functionality

**Details Tab (20 tests)**
- All form fields display correctly
- Status dropdown (5 lane options: Proposed, Queued, Development, Review, Done)
- Priority dropdown (P0-P3)
- Owner dropdown (fetches from API, displays agent names)
- Project dropdown (fetches from API)
- Text fields (Problem, Scope, Acceptance Criteria)
- Lane change note field (conditional)
- Save button state management
- Form validation
- Task metadata display

**Work Done Tab (10 tests)**
- Loading states
- Summary cards (commits, files changed, artifacts)
- Commit display (hash, message, timestamp)
- Files changed display (path, additions/deletions)
- Artifacts display (name, size, path)
- Empty state handling

**Tests Tab (10 tests)**
- Loading states
- Test summary display
- Pass rate percentage calculation
- Progress bar visualization
- Test breakdown (passed/failed/skipped counts)
- Success/failure messages
- Empty state handling
- Color coding

**History Tab (9 tests)**
- Status transition timeline
- Timeline icons (different per lane)
- Timestamps and formatting
- Transition notes
- Empty state handling

**Integration Tests (7 tests)**
- Saving changes via API
- Form validation
- State persistence across tab switches
- Discarding unsaved changes
- Delete workflow
- Multi-field editing

### Running the Tests

**Prerequisites:**
- Dev server must be running on port 5173
- API server must be running on port 8787
- Test data available via API

**Run all component tests:**
```bash
npm test tests/components/
```

**Run TaskModal tests only:**
```bash
npm test tests/components/TaskModal.spec.ts
```

**Run in headed mode (see the browser):**
```bash
npm run test:headed tests/components/TaskModal.spec.ts
```

**Debug mode (step through tests):**
```bash
npm run test:debug tests/components/TaskModal.spec.ts
```

**UI mode (interactive test runner):**
```bash
npm run test:ui
```

### Test Environment Setup

If running locally, ensure:

1. **Start the dev server:**
   ```bash
   npm run dev
   ```
   (Should start on http://localhost:5173)

2. **Ensure API server is running:**
   ```bash
   # Check if API is responding
   curl http://localhost:8787/api/tasks
   ```

3. **Run tests:**
   ```bash
   npm test
   ```

### CI/CD

Playwright config (`playwright.config.ts`) automatically starts the dev server when tests run. In CI environments, tests run headlessly with retries.

### Test Structure

All tests follow this pattern:
1. Navigate to the app
2. Open a task modal by clicking a task card
3. Interact with the modal (switch tabs, fill forms, etc.)
4. Assert expected behavior
5. Clean up (close modal)

Tests use:
- `data-testid` attributes for reliable element selection
- Playwright's auto-waiting for better stability
- Multiple browser support (Chromium, Firefox, WebKit)

### Coverage

**Total: 64 tests** covering all critical user flows and edge cases.
