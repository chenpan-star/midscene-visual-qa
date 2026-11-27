import { expect, test } from '@playwright/test';

const targetPath = process.env.PORTAL_START_PATH ?? '/';

test.describe('Playwright pixel-diff tour', () => {
  test('captures a stable baseline for the target screen', async ({ page }) => {
    await page.goto(targetPath);
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('target-screen.png');
  });
});
