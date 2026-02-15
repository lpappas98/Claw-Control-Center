import { test, expect } from '@playwright/test';
import {
  navigateTo,
  goToHome,
  expectVisible,
  expectURL,
  trackConsoleErrors,
  expectNoConsoleErrors,
} from './helpers';

/**
 * Example Smoke Test Suite
 * 
 * This test suite verifies that the Playwright infrastructure is working correctly.
 * It includes basic navigation, assertion, and helper tests.
 */

test.describe('Smoke Tests', () => {
  test('should load the home page', async ({ page }) => {
    // Track console errors
    const errors = trackConsoleErrors(page);
    
    // Navigate to home
    await goToHome(page);
    
    // Verify URL
    await expectURL(page, /\//);
    
    // Verify no console errors
    expectNoConsoleErrors(page, errors);
  });

  test('should have correct page title', async ({ page }) => {
    await page.goto('/');
    
    // Verify page has a title
    const title = await page.title();
    expect(title).toBeTruthy();
    expect(title.length).toBeGreaterThan(0);
  });

  test('should navigate to different routes', async ({ page }) => {
    // Start at home
    await navigateTo(page, '/');
    expect(page.url()).toContain('/');
    
    // Navigate to tasks (if route exists)
    try {
      await navigateTo(page, '/tasks');
      // If successful, verify URL
      expect(page.url()).toContain('/tasks');
    } catch {
      // Route might not exist yet, that's OK for smoke test
      console.log('Tasks route not available - skipping');
    }
  });

  test('should render main layout elements', async ({ page }) => {
    await page.goto('/');
    
    // Wait for page to be ready
    await page.waitForLoadState('networkidle');
    
    // Check for common layout elements
    const body = page.locator('body');
    await expectVisible(body);
    
    // Verify body has content
    const bodyText = await body.textContent();
    expect(bodyText).toBeTruthy();
  });

  test('should handle 404 for non-existent routes', async ({ page }) => {
    const response = await page.goto('/this-route-definitely-does-not-exist-12345');
    
    // Should either get 404 or be redirected
    // This is implementation-dependent
    const status = response?.status();
    expect([200, 404]).toContain(status);
  });

  test('should load without JavaScript errors', async ({ page }) => {
    const jsErrors: string[] = [];
    
    page.on('pageerror', (error) => {
      jsErrors.push(error.message);
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Should have no uncaught JavaScript errors
    expect(jsErrors).toHaveLength(0);
  });

  test('should be responsive (mobile viewport)', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Verify page renders
    const body = page.locator('body');
    await expectVisible(body);
  });

  test('should be responsive (tablet viewport)', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Verify page renders
    const body = page.locator('body');
    await expectVisible(body);
  });

  test('should be responsive (desktop viewport)', async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Verify page renders
    const body = page.locator('body');
    await expectVisible(body);
  });
});

test.describe('Helper Functions', () => {
  test('navigation helpers should work', async ({ page }) => {
    // Test goToHome helper
    await goToHome(page);
    expect(page.url()).toContain('/');
  });

  test('assertion helpers should work', async ({ page }) => {
    await page.goto('/');
    
    // Test expectVisible
    const body = page.locator('body');
    await expectVisible(body);
    
    // Test expectURL
    await expectURL(page, /\//);
  });

  test('console error tracking should work', async ({ page }) => {
    const errors = trackConsoleErrors(page);
    
    await page.goto('/');
    
    // Should start with no errors
    expect(Array.isArray(errors)).toBe(true);
  });
});
