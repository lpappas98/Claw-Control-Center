// @ts-check
const config = {
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 1,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:8787',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        headless: true,
      },
    },
  ],

  webServer: [
    {
      command: 'npm run bridge',
      port: 8787,
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
  ],
};

export default config;
