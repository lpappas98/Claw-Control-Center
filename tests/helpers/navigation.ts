import { Page } from '@playwright/test';

/**
 * Navigation helper utilities
 */

/**
 * Navigate to a specific route and wait for it to load
 * @param page - Playwright page instance
 * @param path - Route path
 */
export async function navigateTo(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}

/**
 * Navigate to the home page
 * @param page - Playwright page instance
 */
export async function goToHome(page: Page): Promise<void> {
  await navigateTo(page, '/');
}

/**
 * Navigate to the dashboard
 * @param page - Playwright page instance
 */
export async function goToDashboard(page: Page): Promise<void> {
  await navigateTo(page, '/dashboard');
}

/**
 * Navigate to tasks page
 * @param page - Playwright page instance
 */
export async function goToTasks(page: Page): Promise<void> {
  await navigateTo(page, '/tasks');
}

/**
 * Navigate to a specific task by ID
 * @param page - Playwright page instance
 * @param taskId - Task ID
 */
export async function goToTask(page: Page, taskId: string): Promise<void> {
  await navigateTo(page, `/tasks/${taskId}`);
}

/**
 * Navigate to settings page
 * @param page - Playwright page instance
 */
export async function goToSettings(page: Page): Promise<void> {
  await navigateTo(page, '/settings');
}

/**
 * Navigate using a named link/button
 * @param page - Playwright page instance
 * @param linkText - Text content of the link or button
 */
export async function clickNavLink(page: Page, linkText: string): Promise<void> {
  const link = page.locator(`a:has-text("${linkText}"), button:has-text("${linkText}")`).first();
  await link.click();
  await page.waitForLoadState('networkidle');
}

/**
 * Go back in browser history
 * @param page - Playwright page instance
 */
export async function goBack(page: Page): Promise<void> {
  await page.goBack();
  await page.waitForLoadState('networkidle');
}

/**
 * Go forward in browser history
 * @param page - Playwright page instance
 */
export async function goForward(page: Page): Promise<void> {
  await page.goForward();
  await page.waitForLoadState('networkidle');
}

/**
 * Reload the current page
 * @param page - Playwright page instance
 */
export async function reload(page: Page): Promise<void> {
  await page.reload();
  await page.waitForLoadState('networkidle');
}

/**
 * Wait for a specific URL pattern
 * @param page - Playwright page instance
 * @param pattern - URL pattern (string or regex)
 */
export async function waitForURL(page: Page, pattern: string | RegExp): Promise<void> {
  await page.waitForURL(pattern);
}

/**
 * Get the current URL
 * @param page - Playwright page instance
 * @returns Current URL
 */
export function getCurrentURL(page: Page): string {
  return page.url();
}

/**
 * Check if the current URL matches a pattern
 * @param page - Playwright page instance
 * @param pattern - URL pattern (string or regex)
 * @returns true if URL matches, false otherwise
 */
export function isOnPage(page: Page, pattern: string | RegExp): boolean {
  const url = page.url();
  if (typeof pattern === 'string') {
    return url.includes(pattern);
  }
  return pattern.test(url);
}
