import { Page } from '@playwright/test';

/**
 * Authentication helper utilities
 */

export interface LoginCredentials {
  username: string;
  password: string;
}

/**
 * Log in a user with the provided credentials
 * @param page - Playwright page instance
 * @param credentials - User credentials
 */
export async function login(page: Page, credentials: LoginCredentials): Promise<void> {
  await page.goto('/login');
  
  // Fill in login form
  await page.fill('input[name="username"], input[type="email"]', credentials.username);
  await page.fill('input[name="password"], input[type="password"]', credentials.password);
  
  // Submit form
  await page.click('button[type="submit"]');
  
  // Wait for navigation or success indicator
  await page.waitForURL(/^(?!.*login).*$/);
}

/**
 * Log out the current user
 * @param page - Playwright page instance
 */
export async function logout(page: Page): Promise<void> {
  // Look for logout button/link
  const logoutButton = page.locator('button:has-text("Logout"), a:has-text("Logout"), button:has-text("Sign Out"), a:has-text("Sign Out")').first();
  
  if (await logoutButton.isVisible({ timeout: 5000 }).catch(() => false)) {
    await logoutButton.click();
    await page.waitForURL(/login/);
  }
}

/**
 * Check if user is currently logged in
 * @param page - Playwright page instance
 * @returns true if logged in, false otherwise
 */
export async function isLoggedIn(page: Page): Promise<boolean> {
  // Check for common auth indicators
  const authIndicators = [
    page.locator('[data-testid="user-menu"]'),
    page.locator('button:has-text("Logout")'),
    page.locator('a:has-text("Logout")'),
    page.locator('[data-auth="true"]'),
  ];
  
  for (const indicator of authIndicators) {
    if (await indicator.isVisible({ timeout: 1000 }).catch(() => false)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Get authentication token from local storage or cookies
 * @param page - Playwright page instance
 * @returns Authentication token or null
 */
export async function getAuthToken(page: Page): Promise<string | null> {
  // Try localStorage first
  const localStorageToken = await page.evaluate(() => {
    return localStorage.getItem('authToken') || localStorage.getItem('token') || null;
  });
  
  if (localStorageToken) {
    return localStorageToken;
  }
  
  // Try cookies
  const cookies = await page.context().cookies();
  const authCookie = cookies.find(c => c.name === 'authToken' || c.name === 'token');
  
  return authCookie?.value || null;
}

/**
 * Set authentication token directly (useful for API-based auth)
 * @param page - Playwright page instance
 * @param token - Authentication token
 */
export async function setAuthToken(page: Page, token: string): Promise<void> {
  await page.evaluate((t) => {
    localStorage.setItem('authToken', t);
  }, token);
}
