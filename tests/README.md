# Playwright Test Infrastructure

This directory contains the Playwright end-to-end testing infrastructure for the Claw Control Center.

## Overview

The test infrastructure includes:
- **Playwright configuration** (`playwright.config.ts`)
- **Test helpers** (`tests/helpers/`)
- **Example smoke tests** (`tests/example.spec.ts`)

## Quick Start

```bash
# Run all tests (headless)
npm test

# Run tests in headed mode (see browser)
npm run test:headed

# Run tests in debug mode (step through)
npm run test:debug

# Run tests in UI mode (interactive)
npm run test:ui
```

## Configuration

The Playwright configuration (`playwright.config.ts`) includes:

- **Base URL**: `http://localhost:5173`
- **Browsers**: Chromium, Firefox, WebKit
- **Test timeout**: 30 seconds
- **Reporters**: HTML, JSON, List
- **Screenshots**: On failure
- **Videos**: On failure
- **JSON output**: `test-results/results.json`

## Test Helpers

All test helpers are located in `tests/helpers/`:

### Auth Helpers (`auth.ts`)
- `login(page, credentials)` - Log in a user
- `logout(page)` - Log out current user
- `isLoggedIn(page)` - Check auth status
- `getAuthToken(page)` - Get auth token
- `setAuthToken(page, token)` - Set auth token

### Navigation Helpers (`navigation.ts`)
- `navigateTo(page, path)` - Navigate to a route
- `goToHome(page)` - Navigate to home
- `goToDashboard(page)` - Navigate to dashboard
- `goToTasks(page)` - Navigate to tasks
- `goToTask(page, taskId)` - Navigate to specific task
- `clickNavLink(page, text)` - Click a navigation link
- `goBack(page)` / `goForward(page)` / `reload(page)` - Browser navigation
- `getCurrentURL(page)` - Get current URL
- `isOnPage(page, pattern)` - Check current page

### Assertion Helpers (`assertions.ts`)
- `expectVisible(locator)` / `expectHidden(locator)` - Visibility checks
- `expectText(locator, text)` / `expectExactText(locator, text)` - Text content
- `expectValue(locator, value)` - Input value
- `expectEnabled(locator)` / `expectDisabled(locator)` - Element state
- `expectChecked(locator)` / `expectUnchecked(locator)` - Checkbox state
- `expectURL(page, pattern)` - URL matching
- `expectTitle(page, title)` - Page title
- `expectCount(locator, count)` - Element count
- `expectClass(locator, className)` - CSS class
- `expectAttribute(locator, name, value)` - Attribute value
- `trackConsoleErrors(page)` - Track console errors
- `expectNoConsoleErrors(page, errors)` - Verify no errors

### Fixtures (`fixtures.ts`)
- `createUser(overrides)` - Generate test user
- `createTask(overrides)` - Generate test task
- `createAgent(overrides)` - Generate test agent
- `createTasks(count, overrides)` - Generate multiple tasks
- `createUsers(count, overrides)` - Generate multiple users
- `createAgents(count, overrides)` - Generate multiple agents
- `generateId()` - Generate unique ID
- `randomText(length)` / `randomEmail()` / `randomNumber(min, max)` - Random data
- `randomItem(array)` - Pick random item

### API Helpers (`api.ts`)
- `createAPIContext(baseURL)` - Create API context
- `apiGet(context, endpoint, options)` - GET request
- `apiPost(context, endpoint, body, options)` - POST request
- `apiPut(context, endpoint, body, options)` - PUT request
- `apiDelete(context, endpoint, options)` - DELETE request
- `createTaskViaAPI(context, task)` - Create task via API
- `deleteTaskViaAPI(context, taskId)` - Delete task via API
- `getTaskViaAPI(context, taskId)` - Get task via API
- `updateTaskViaAPI(context, taskId, updates)` - Update task via API
- `cleanupTestData(context, testIds)` - Cleanup test data
- `waitForAPI(baseURL)` - Wait for API to be ready

## Writing Tests

### Basic Test Structure

```typescript
import { test, expect } from '@playwright/test';
import { goToHome, expectVisible } from './helpers';

test.describe('Feature Name', () => {
  test('should do something', async ({ page }) => {
    await goToHome(page);
    
    const element = page.locator('[data-testid="something"]');
    await expectVisible(element);
  });
});
```

### Using API Helpers for Setup/Teardown

```typescript
import { test } from '@playwright/test';
import { createAPIContext, createTaskViaAPI, deleteTaskViaAPI } from './helpers';
import { createTask } from './helpers';

test.describe('Task Management', () => {
  test('should display created task', async ({ page }) => {
    const apiContext = await createAPIContext();
    const task = createTask({ title: 'Test Task' });
    
    // Setup: Create task via API
    await createTaskViaAPI(apiContext, task);
    
    // Test: Verify in UI
    await page.goto('/tasks');
    await expect(page.locator(`text=${task.title}`)).toBeVisible();
    
    // Teardown: Delete task
    await deleteTaskViaAPI(apiContext, task.id);
    await apiContext.dispose();
  });
});
```

## Test Results

- **HTML Report**: `playwright-report/index.html` (auto-opens on failure)
- **JSON Results**: `test-results/results.json` (for CI/CD parsing)
- **Screenshots**: `test-results/` (on failure)
- **Videos**: `test-results/` (on failure)

## CI/CD Integration

The JSON reporter outputs structured test results to `test-results/results.json`, which can be parsed by CI/CD systems for automated verification.

## Troubleshooting

### Browser Installation Issues

If browsers fail to install, run:
```bash
npx playwright install chromium firefox webkit
```

For system dependencies:
```bash
npx playwright install-deps
```

### Tests Failing Locally

1. Ensure dev server is running on `localhost:5173`
2. Check test timeout (default 30s)
3. Run in headed mode to see what's happening: `npm run test:headed`
4. Use debug mode to step through: `npm run test:debug`

### Slow Tests

- Reduce browser count in `playwright.config.ts`
- Disable video/screenshot capture for faster runs
- Use `test.skip()` for tests you're not working on

## Best Practices

1. **Use helpers** - Don't repeat navigation/assertion logic
2. **Generate test data** - Use fixtures instead of hardcoded data
3. **Clean up** - Use API helpers to create/delete test data
4. **Track errors** - Use `trackConsoleErrors()` to catch JS errors
5. **Wait properly** - Use Playwright's auto-waiting, avoid `wait(ms)`
6. **Isolate tests** - Each test should be independent
7. **Use data-testid** - Add `data-testid` attributes for stable selectors
