# Claw Control Center - Comprehensive E2E Test Suite

## Overview

This is a comprehensive Playwright test suite covering all pages, components, and features of the Claw Control Center.

## Test Coverage

### Pages
- ✅ **Mission Control** - Kanban board, agent strip, activity feed, task creation
- ✅ **Intake Page** - Form submission, project selection, AI task generation
- ✅ **Projects Page** - Project list, details, features, project kanban
- ✅ **System Status** - Health indicators, API metrics, system monitoring

### Components
- ✅ **TaskModal** - All 4 tabs (Details, Work Done, Tests, History)
- ✅ **CreateTaskModal** - Form validation, task creation
- ✅ **TaskListModal** - Overflow task display, filtering
- ✅ **NavBar** - Navigation links, active highlighting

### Features
- ✅ Task CRUD operations (Create, Read, Update, Delete)
- ✅ Task lane transitions (queued → development → review → done)
- ✅ Work data display (commits, files, test results, artifacts)
- ✅ Test results integration (pass/fail/skip counts)
- ✅ History timeline with status changes
- ✅ Real-time UI updates
- ✅ Form validation and error handling
- ✅ Responsive UI behavior

## Test Files

```
e2e/
├── mission-control.spec.ts    # Mission Control page tests
├── intake-page.spec.ts        # Intake form tests
├── projects-page.spec.ts      # Projects page tests
├── system-page.spec.ts        # System status tests
├── task-modal.spec.ts         # Task modal component tests
├── components.spec.ts         # Other component tests
├── helpers/
│   └── test-helpers.ts        # Shared test utilities
├── fixtures/
│   ├── test-data.ts          # Test data fixtures
│   └── api-mocks.ts          # API mocking utilities
└── run-all-tests.mjs         # Comprehensive test runner
```

## Running Tests

### Run all tests with reporting
```bash
npm run test:e2e:comprehensive
```

### Run specific test file
```bash
npx playwright test e2e/mission-control.spec.ts
```

### Run with UI mode (interactive)
```bash
npm run test:e2e:ui
```

### Run in headed mode (see browser)
```bash
npm run test:e2e:headed
```

### Debug tests
```bash
npm run test:e2e:debug
```

### Run tests for specific task
```bash
node e2e/run-all-tests.mjs task-43a1360af58ac-1771198970208
```

## Test Result Integration

The test suite automatically:

1. **Runs all tests** using Playwright
2. **Generates JSON report** at `test-results/results.json`
3. **Parses results** to extract pass/fail/skip counts
4. **POSTs to API** at `PUT /api/tasks/:id/work` with:
   ```json
   {
     "testResults": {
       "passed": 45,
       "failed": 2,
       "skipped": 1,
       "total": 48,
       "duration": 12500,
       "timestamp": "2026-02-15T23:00:00Z"
     }
   }
   ```
5. **Displays in UI** via TaskModal Tests tab

## Test Helpers

### Navigation Helpers
```typescript
await navigateToMissionControl(page);
await navigateToIntakePage(page);
await navigateToProjectsPage(page);
await navigateToSystemPage(page);
```

### Task Operations
```typescript
await createTask(page, { title: 'New Task', priority: 'P1' });
await openTask(page, 'Task Title');
await updateTaskLane(page, 'Task Title', 'review');
await deleteTask(page, 'Task Title');
```

### Assertions
```typescript
await assertTaskExists(page, 'Task Title');
await assertTaskInLane(page, 'Task Title', 'development');
await assertModalOpen(page);
await assertModalClosed(page);
```

### Wait Helpers
```typescript
await waitForTaskUpdate(page);
await waitForApiResponse(page, '/api/tasks');
```

## Test Data Fixtures

Pre-defined test data available in `fixtures/test-data.ts`:

```typescript
import { TEST_TASKS, TEST_PROJECTS, TEST_AGENTS } from './fixtures/test-data';

// Use in tests
await createTask(page, TEST_TASKS.basic);
```

## Configuration

Test configuration is in `playwright.config.ts`:

- **Base URL**: `http://localhost:5173`
- **Reporters**: HTML, JSON, List
- **Browsers**: Chromium
- **Retries**: 2 (in CI), 0 (locally)
- **Parallel**: false (for stability)
- **Screenshots**: on failure
- **Video**: on failure
- **Trace**: on retry

## CI/CD Integration

### GitHub Actions
```yaml
- name: Run E2E Tests
  run: npm run test:e2e:comprehensive
  
- name: Upload test results
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: playwright-report/
```

## Debugging Failed Tests

1. **Check screenshots**: `test-results/screenshots/`
2. **View HTML report**: `npx playwright show-report`
3. **Check trace**: `npx playwright show-trace trace.zip`
4. **Run in debug mode**: `npm run test:e2e:debug`

## Best Practices

### ✅ Do's
- Use data-testid attributes for stable selectors
- Wait for network idle before assertions
- Use unique test data (timestamps) to avoid conflicts
- Clean up test data after tests
- Test both happy paths and error cases
- Use descriptive test names

### ❌ Don'ts
- Don't use brittle selectors (CSS classes that change)
- Don't hard-code waits (use waitFor*)
- Don't share state between tests
- Don't test implementation details
- Don't skip error handling tests

## Coverage Goals

- ✅ **Page Load**: Every page should load without errors
- ✅ **Core Functionality**: All CRUD operations work
- ✅ **UI Components**: All modals, forms, and interactive elements
- ✅ **Error Handling**: API failures, network errors, validation
- ✅ **Real-time**: WebSocket updates, polling, live data
- ✅ **Responsive**: Mobile, tablet, desktop viewports

## Test Metrics

Current coverage (as of 2026-02-15):

- **Total Tests**: ~150+
- **Test Files**: 7
- **Pages Covered**: 4
- **Components Covered**: 8
- **Features Covered**: 15+

## Future Enhancements

- [ ] Visual regression testing (Percy/Chromatic)
- [ ] Performance testing (Lighthouse CI)
- [ ] Accessibility testing (axe-core)
- [ ] API contract testing
- [ ] Load testing
- [ ] Cross-browser testing (Firefox, Safari)
- [ ] Mobile device testing

## Contributing

When adding new tests:

1. Follow existing patterns in test files
2. Use test helpers for common operations
3. Add new fixtures to `test-data.ts`
4. Update this README with coverage info
5. Ensure tests are idempotent (can run multiple times)

## Troubleshooting

### Tests timeout
- Increase timeout in `playwright.config.ts`
- Check if services are running (dev server, bridge)
- Check network tab for slow API calls

### Flaky tests
- Add proper waits instead of hard timeouts
- Use `waitForLoadState('networkidle')`
- Increase retry count in CI

### Can't find elements
- Check if element is in viewport
- Wait for element to be visible
- Use `page.locator().first()` for multiple matches
- Add data-testid attributes

## Support

For issues or questions:
- Check test output: `test-results/results.json`
- View HTML report: `playwright-report/index.html`
- Enable debug logging: `DEBUG=pw:api npm run test:e2e`

---

**Last Updated**: 2026-02-15  
**Maintainer**: QA Agent (Sentinel)  
**Coverage**: Comprehensive (All pages, components, features)
