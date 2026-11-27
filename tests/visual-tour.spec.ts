import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

const companyId = process.env.PORTAL_COMPANY_ID ?? '29';
const authState = process.env.PORTAL_AUTH_STATE
  ? resolve(process.cwd(), process.env.PORTAL_AUTH_STATE)
  : resolve(process.cwd(), '.auth/user.json');

const pages = [
  { id: 'home', name: 'Home', path: `/#/${companyId}` },
  { id: 'orders', name: 'API Product Orders', path: `/#/${companyId}/operate-apis/api-product-orders` },
  { id: 'offers', name: 'Offers', path: `/#/${companyId}/pc/offers` },
  { id: 'settings', name: 'Settings', path: `/#/${companyId}/settings/tenant-localization` },
];

test.describe('Playwright pixel-diff tour against portal-dc02', () => {
  test.beforeEach(() => {
    test.skip(
      !existsSync(authState),
      'Run `npm run tour:login` first and sign in against portal-dc02',
    );
  });

  for (const pageDef of pages) {
    test(pageDef.name, async ({ page }) => {
      await page.goto(pageDef.path);
      await expect(page, 'Session expired. Run npm run tour:login again.').not.toHaveURL(/#\/login(?:\?|$)/);
      await page.locator('[data-testid="Sidebar"]').waitFor({ state: 'visible', timeout: 60_000 });
      await page.locator('.cursor-wait').waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => undefined);
      // Give tables/lists a moment after the spinner clears.
      await page.waitForTimeout(1500);
      await expect(page).toHaveScreenshot(`${pageDef.id}.png`);
    });
  }
});
