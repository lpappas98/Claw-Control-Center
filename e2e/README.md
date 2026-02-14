# E2E Tests for Claw Control Center (Phase 6.1)

End-to-end testing suite using Node.js native test runner and Playwright for comprehensive testing of the Claw Control Center backend and API.

## Overview

The E2E test suite covers 22+ test scenarios across task management, project workflows, API endpoints, and performance testing.

## Test Files

- **task-tests.mjs** - Core API integration tests (22 scenarios)
  - Task creation and management
  - API endpoints validation
  - Task workflow transitions
  - Performance and load testing
  
- **api.spec.ts** - Playwright API tests (10 scenarios)
  - Bridge API endpoint coverage
  - Task operations
  - Project management
  
- **kanban.spec.ts** - Kanban board and task operations (10 scenarios)
  - Task creation and board appearance
  - Drag and drop between lanes
  - Task templates
  - AI task generation
  - Task dependencies
  - Recurring tasks
  - GitHub integration
  
- **task-workflow.spec.ts** - Advanced task workflows (10 scenarios)
  - Task status lifecycle
  - Priority and filtering
  - Task assignment and collaboration
  - Due dates and reminders
  - Batch operations
  - Export/import
  
- **sanity.spec.ts** - Sanity checks (3 scenarios)
  - Basic connectivity
  - Bridge server health
  - UI server availability

## Test Infrastructure

### Configuration Files

- **playwright.config.ts** - Playwright configuration
  - Headless Chrome browser
  - Bridge server auto-start on port 8787
  - Screenshot on failure
  - HTML reporter
  
- **fixtures/api-mocks.ts** - API mocking fixtures
  - GitHub API mocking
  - Telegram API mocking
  - Calendar API mocking

### Test Runners

- **run-e2e-tests.mjs** - Main test orchestrator
  - Auto-starts bridge server
  - Runs Node.js API tests
  - Handles cleanup and process management
  
- **run-tests.mjs** - Playwright test runner
  - Server lifecycle management
  - Test execution coordination

## Running Tests

### Run all API tests
```bash
npm run test:e2e:api
```

### Run Playwright tests
```bash
npm run test:e2e:playwright
```

### Run with UI
```bash
npm run test:e2e:ui
```

### Run in debug mode
```bash
npm run test:e2e:debug
```

### Run tests with browser visible
```bash
npm run test:e2e:headed
```

### Run orchestrated tests (recommended)
```bash
npm run test:e2e
```

## Test Coverage

### 1. Task Creation & Management (5 tests)
- ✅ Creates a new task successfully
- ✅ Retrieves tasks list
- ✅ Updates a task
- ✅ Creates task with dependencies
- ✅ Batch creates multiple tasks

### 2. API Endpoints (10 tests)
- ✅ GET /api/status
- ✅ GET /api/projects
- ✅ GET /api/workers
- ✅ GET /api/blockers
- ✅ GET /api/activity
- ✅ GET /api/models
- ✅ GET /api/rules
- ✅ GET /api/live
- ✅ GET /api/pm/projects
- ✅ GET /api/intake/projects

### 3. Task Workflow (5 tests)
- ✅ Creates task for workflow test
- ✅ Transitions task to in-progress
- ✅ Transitions task to completed
- ✅ Creates recurring task
- ✅ Adds task notes/comments

### 4. Performance & Load (2 tests)
- ✅ Creates 10+ tasks rapidly
- ✅ Server remains responsive under load

## Test Results

When tests run successfully, you should see:
- Green check marks for passing tests
- Proper task creation and updates in the API
- Server responding within acceptable timeframes (<5s)
- All 22+ tests passing or being skipped (not failed)

## Debugging

### Bridge Server Issues

If bridge server fails to start:
1. Check if port 8787 is already in use
2. Look for errors in `/tmp/bridge.log`
3. Verify Node.js version >= 20

### Connection Issues

If tests timeout:
1. Ensure bridge server is running
2. Check network connectivity to localhost:8787
3. Review server logs for errors

### Test Failures

- Take screenshots (enabled on failure)
- Check test output for specific error messages
- Review API responses in test logs

## CI/CD Integration

Tests are designed to run in CI environments:
- Headless mode enabled
- No TTY required
- Timeouts configured appropriately
- Error messages are descriptive

To run in CI:
```bash
npm run test:e2e
```

## Performance Benchmarks

Expected performance:
- Single task creation: <100ms
- Task list retrieval: <500ms
- Batch task creation (10): <1s
- API response time under load: <5s

## Future Enhancements

- [ ] Full UI testing with visual regression
- [ ] Load testing with 100+ tasks
- [ ] Integration testing with actual GitHub/Telegram
- [ ] Multi-user concurrent task operations
- [ ] Database performance testing
- [ ] Memory leak detection

## Notes

- Tests use mocked external APIs (GitHub, Telegram, Calendar)
- Tests are idempotent and can be run multiple times
- Bridge server state persists between test runs
- Screenshots of failures saved to `test-results/`

## Contributing

When adding new tests:
1. Add test cases to appropriate test file
2. Follow existing test patterns
3. Use descriptive test names
4. Include error handling
5. Document any new API endpoints tested
