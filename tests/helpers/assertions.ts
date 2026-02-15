import { expect, Page, Locator } from '@playwright/test';

/**
 * Custom assertion utilities
 */

/**
 * Assert that an element is visible
 * @param locator - Playwright locator
 * @param message - Optional custom error message
 */
export async function expectVisible(locator: Locator, message?: string): Promise<void> {
  await expect(locator, message).toBeVisible();
}

/**
 * Assert that an element is hidden
 * @param locator - Playwright locator
 * @param message - Optional custom error message
 */
export async function expectHidden(locator: Locator, message?: string): Promise<void> {
  await expect(locator, message).toBeHidden();
}

/**
 * Assert that an element contains specific text
 * @param locator - Playwright locator
 * @param text - Expected text (string or regex)
 * @param message - Optional custom error message
 */
export async function expectText(
  locator: Locator,
  text: string | RegExp,
  message?: string
): Promise<void> {
  await expect(locator, message).toContainText(text);
}

/**
 * Assert that an element has exact text
 * @param locator - Playwright locator
 * @param text - Expected text (string or regex)
 * @param message - Optional custom error message
 */
export async function expectExactText(
  locator: Locator,
  text: string | RegExp,
  message?: string
): Promise<void> {
  await expect(locator, message).toHaveText(text);
}

/**
 * Assert that an input has a specific value
 * @param locator - Playwright locator
 * @param value - Expected value
 * @param message - Optional custom error message
 */
export async function expectValue(
  locator: Locator,
  value: string,
  message?: string
): Promise<void> {
  await expect(locator, message).toHaveValue(value);
}

/**
 * Assert that an element is enabled
 * @param locator - Playwright locator
 * @param message - Optional custom error message
 */
export async function expectEnabled(locator: Locator, message?: string): Promise<void> {
  await expect(locator, message).toBeEnabled();
}

/**
 * Assert that an element is disabled
 * @param locator - Playwright locator
 * @param message - Optional custom error message
 */
export async function expectDisabled(locator: Locator, message?: string): Promise<void> {
  await expect(locator, message).toBeDisabled();
}

/**
 * Assert that a checkbox/radio is checked
 * @param locator - Playwright locator
 * @param message - Optional custom error message
 */
export async function expectChecked(locator: Locator, message?: string): Promise<void> {
  await expect(locator, message).toBeChecked();
}

/**
 * Assert that a checkbox/radio is unchecked
 * @param locator - Playwright locator
 * @param message - Optional custom error message
 */
export async function expectUnchecked(locator: Locator, message?: string): Promise<void> {
  await expect(locator, message).not.toBeChecked();
}

/**
 * Assert that the page URL matches a pattern
 * @param page - Playwright page instance
 * @param pattern - URL pattern (string or regex)
 * @param message - Optional custom error message
 */
export async function expectURL(
  page: Page,
  pattern: string | RegExp,
  message?: string
): Promise<void> {
  await expect(page, message).toHaveURL(pattern);
}

/**
 * Assert that the page title matches expected text
 * @param page - Playwright page instance
 * @param title - Expected title (string or regex)
 * @param message - Optional custom error message
 */
export async function expectTitle(
  page: Page,
  title: string | RegExp,
  message?: string
): Promise<void> {
  await expect(page, message).toHaveTitle(title);
}

/**
 * Assert that an element count matches expected
 * @param locator - Playwright locator
 * @param count - Expected count
 * @param message - Optional custom error message
 */
export async function expectCount(
  locator: Locator,
  count: number,
  message?: string
): Promise<void> {
  await expect(locator, message).toHaveCount(count);
}

/**
 * Assert that an element has a specific CSS class
 * @param locator - Playwright locator
 * @param className - Expected CSS class
 * @param message - Optional custom error message
 */
export async function expectClass(
  locator: Locator,
  className: string,
  message?: string
): Promise<void> {
  await expect(locator, message).toHaveClass(new RegExp(className));
}

/**
 * Assert that an element has a specific attribute with a value
 * @param locator - Playwright locator
 * @param name - Attribute name
 * @param value - Expected attribute value
 * @param message - Optional custom error message
 */
export async function expectAttribute(
  locator: Locator,
  name: string,
  value: string | RegExp,
  message?: string
): Promise<void> {
  await expect(locator, message).toHaveAttribute(name, value);
}

/**
 * Assert that the page has no console errors
 * @param page - Playwright page instance
 * @param errors - Array to collect errors
 */
export function expectNoConsoleErrors(page: Page, errors: string[] = []): void {
  expect(errors, 'Page should have no console errors').toHaveLength(0);
}

/**
 * Setup console error tracking for a page
 * @param page - Playwright page instance
 * @returns Array that will collect error messages
 */
export function trackConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  return errors;
}
