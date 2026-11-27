import { expect, test } from './fixture';

/**
 * Midscene Vision QA exploration spec.
 *
 * Best practice from our spike:
 * - Use `aiAssert` ONLY for visible screen claims (layout, clipping, formatting, overlaps).
 * - Use Playwright network/response assertions for off-screen claims (HTTP 500, duplicate writes).
 * - For small icons or subtle spacing (< 48px), pass `locatePrompt` or `searchArea` to crop,
 *   or pair with Playwright `toHaveScreenshot` pixel diffs.
 */
test.describe('Midscene Vision QA checks', () => {
  test('detects visible layout, clipping, and formatting defects', async ({ page, aiAssert }) => {
    await page.goto(process.env.PORTAL_START_PATH ?? '/');
    await page.waitForLoadState('networkidle');

    await aiAssert('The main navigation sidebar and page header are aligned without overlapping text');
    await aiAssert('Primary action buttons are fully legible and not clipped by their container');
    await aiAssert('All visible prices and dates are properly formatted with no NaN or undefined strings');

    await expect(page).toHaveTitle(/.+/);
  });
});
