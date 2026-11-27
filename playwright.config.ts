import 'dotenv/config';
import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const authState = process.env.PORTAL_AUTH_STATE
  ? resolve(process.cwd(), process.env.PORTAL_AUTH_STATE)
  : resolve(process.cwd(), '.auth/user.json');

const baseURL = process.env.PORTAL_BASE_URL ?? 'https://portal-dc02.lotusflare.com';

export default defineConfig({
  testDir: './tests',
  timeout: 120_000,
  expect: {
    timeout: 30_000,
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      fullPage: true,
      maxDiffPixelRatio: 0.01,
    },
  },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: process.env.MIDSCENE_REPORT
    ? [
        ['list'],
        ['html', { outputFolder: 'playwright-report', open: 'never' }],
        ['@midscene/web/playwright-reporter'],
      ]
    : [
        ['list'],
        ['html', { outputFolder: 'playwright-report', open: 'never' }],
      ],
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    channel: 'chrome',
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    locale: 'en-US',
    timezoneId: 'UTC',
    ignoreHTTPSErrors: true,
    ...(existsSync(authState) ? { storageState: authState } : {}),
    navigationTimeout: 60_000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
