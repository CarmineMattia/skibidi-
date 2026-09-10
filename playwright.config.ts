/**
 * Playwright Test Configuration
 * E2E Testing for SKIBIDI ORDERS POS System
 */

import { defineConfig, devices } from '@playwright/test';
import os from 'os';

const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: './tests',
  testIgnore: ['**/unit/**'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : Math.min(4, Math.max(1, Math.floor(os.cpus().length / 2))),
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],
  use: {
    baseURL: externalBaseURL || 'http://localhost:8081',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: externalBaseURL
    ? undefined
    : {
        command: 'npm start',
        url: 'http://localhost:8081',
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
      },
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.1,
      threshold: 0.2,
    },
  },
});