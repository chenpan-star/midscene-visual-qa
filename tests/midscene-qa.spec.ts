import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from './fixture';

const companyId = process.env.PORTAL_COMPANY_ID ?? '29';
const authState = process.env.PORTAL_AUTH_STATE
  ? resolve(process.cwd(), process.env.PORTAL_AUTH_STATE)
  : resolve(process.cwd(), '.auth/user.json');

const pages = [
  {
    name: 'Home',
    path: `/#/${companyId}`,
    assert: 'The left navigation sidebar is visible and the Home page content is loaded without covering the header',
  },
  {
    name: 'API Product Orders',
    path: `/#/${companyId}/operate-apis/api-product-orders`,
    assert:
      'The API Product Orders page shows a table or list area. Column headers align with the values under them and no primary action button is clipped',
  },
  {
    name: 'Offers',
    path: `/#/${companyId}/pc/offers`,
    assert:
      'The Offers page is visible. Any Create Offer or primary action button is fully legible, and prices or dates shown on screen are properly formatted with no NaN or Invalid Date text',
  },
  {
    name: 'Settings',
    path: `/#/${companyId}/settings/tenant-localization`,
    assert: 'The Settings page content is visible beside the left sidebar with no overlapping panels or cut-off labels',
  },
];

test.describe('Midscene Vision QA against portal-dc02 operator 29', () => {
  test.beforeEach(() => {
    test.skip(
      !existsSync(authState),
      'Run `npm run tour:login` first and sign in against portal-dc02',
    );
  });

  for (const pageDef of pages) {
    test(pageDef.name, async ({ page, aiAssert, aiWaitFor }) => {
      await page.goto(pageDef.path);
      await expect(page, 'Session expired. Run npm run tour:login again.').not.toHaveURL(/#\/login(?:\?|$)/);

      await page.locator('[data-testid="Sidebar"]').waitFor({ state: 'visible', timeout: 60_000 });
      // Wait out the portal page spinner when present.
      await page.locator('.cursor-wait').waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => undefined);
      await aiWaitFor('The main page content has finished loading and is not showing only a Loading spinner');

      await aiAssert(pageDef.assert);
    });
  }
});
