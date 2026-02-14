import { test as baseTest, Page, expect } from '@playwright/test';

interface MockedAPIs {
  mockGitHubAPI: () => Promise<void>;
  mockTelegramAPI: () => Promise<void>;
  mockCalendarAPI: () => Promise<void>;
  cleanupMocks: () => Promise<void>;
}

export const test = baseTest.extend<MockedAPIs>({
  mockGitHubAPI: async ({ page }, use) => {
    await use(async () => {
      await page.route('**/api/github/**', (route) => {
        route.abort();
      });
    });
  },

  mockTelegramAPI: async ({ page }, use) => {
    await use(async () => {
      await page.route('**/api/telegram/**', (route) => {
        route.abort();
      });
    });
  },

  mockCalendarAPI: async ({ page }, use) => {
    await use(async () => {
      await page.route('**/api/calendar/**', (route) => {
        route.abort();
      });
    });
  },

  cleanupMocks: async ({ page }, use) => {
    await use(async () => {
      // Cleanup function for test data
      try {
        await page.goto('/');
      } catch (e) {
        // Ignore errors during cleanup
      }
    });
  },
});

export { expect };
