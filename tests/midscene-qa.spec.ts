import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from './fixture';

const companyId = process.env.PORTAL_COMPANY_ID ?? '29';
const authState = process.env.PORTAL_AUTH_STATE
  ? resolve(process.cwd(), process.env.PORTAL_AUTH_STATE)
  : resolve(process.cwd(), '.auth/user.json');

/**
 * Live Midscene Vision QA against portal-dc02 operator 29.
 * Ready once Gemini/OpenAI quota is available:
 *   npm run check:ready && npm run test:midscene
 */
const pages = [
  {
    name: 'Home',
    path: `/#/${companyId}`,
    assert:
      'The left navigation sidebar is visible and the Home page content is loaded without covering the header. No overlapping text or clipped labels.',
  },
  {
    name: 'API Product Orders',
    path: `/#/${companyId}/operate-apis/api-product-orders`,
    assert:
      'The API Product Orders page shows a table or list area. Column headers align vertically with the values under them. No primary action button is clipped and there is no overlapping text.',
  },
  {
    name: 'Offers',
    path: `/#/${companyId}/pc/offers`,
    assert:
      'The Offers page is visible. Column headers align with the cells under them. Any Create Offer or primary action button is fully legible. Prices or dates are properly formatted with no NaN or Invalid Date text.',
  },
  {
    name: 'Products',
    path: `/#/${companyId}/pc/products`,
    assert:
      'The Products page is visible beside the left sidebar. Column headers align with the values under them and no primary action button is clipped.',
  },
  {
    name: 'Templates',
    path: `/#/${companyId}/pc/templates`,
    assert:
      'The Templates page is visible. Column headers align with the values under them. No overlapping panels or clipped primary actions.',
  },
  {
    name: 'Product Catalog Reference Table',
    path: `/#/${companyId}/pc/reference-table`,
    assert:
      'The Product Catalog Reference Table page is visible beside the left sidebar. The table is loaded with rows. Column headers (Reference Key, Name, Value Type, State, Values Count, Created Time) align with the values under them. Approved state badges sit in the State column. The + Add New button is fully legible and not clipped.',
  },
  {
    name: 'Settings',
    path: `/#/${companyId}/settings/tenant-localization`,
    assert:
      'The Settings page content is visible beside the left sidebar with no overlapping panels, cut-off labels, or misaligned form fields.',
  },
];

async function settlePortalPage(page: import('@playwright/test').Page) {
  await expect(page, 'Session expired. Run npm run tour:login again.').not.toHaveURL(/#\/login(?:\?|$)/);
  await page.locator('[data-testid="Sidebar"]').waitFor({ state: 'visible', timeout: 60_000 });
  await page.locator('.cursor-wait').waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => undefined);
}

test.describe('Midscene Vision QA against portal-dc02 operator 29', () => {
  test.beforeEach(() => {
    test.skip(
      !existsSync(authState),
      'Run `npm run tour:login` first and sign in against portal-dc02',
    );
  });

  for (const pageDef of pages) {
    test(pageDef.name, async ({ page, aiAssert, aiWaitFor }) => {
      test.setTimeout(180_000);
      await page.goto(pageDef.path);
      await settlePortalPage(page);
      await aiWaitFor('The main page content has finished loading and is not showing only a Loading spinner');
      await aiAssert(pageDef.assert);
    });
  }

  /**
   * ASRT-007 control case: Reports sets `:can-select-columns="false"`.
   * Stays red if DataTable drops the canSelectColumns gate and always shows the gear.
   */
  test('Reports — Column configuration control absent when disabled', async ({ page, aiAssert, aiWaitFor }) => {
    test.setTimeout(180_000);
    await page.goto(`/#/${companyId}/reports`);
    await settlePortalPage(page);
    await aiWaitFor('The Reports page has finished loading and a table or list area is visible');

    await aiAssert(
      'The Reports table does NOT show a Column configuration control (gear / configure-columns icon) in the table header. There is no column-config gear at the right edge of the header row.',
    );
  });

  /**
   * Storybook DataTable "Configure Columns" contract on live Reference Table:
   * open panel, hide Values Count, Reset restores it.
   */
  test('Reference Table — Column Configuration show hide and Reset', async ({ page, ai, aiAssert, aiWaitFor }) => {
    test.setTimeout(300_000);
    await page.goto(`/#/${companyId}/pc/reference-table`);
    await settlePortalPage(page);
    await aiWaitFor('The Reference Tables page has finished loading and the data table is visible');

    await aiAssert(
      'In the table header row, near the right edge after the Last Updated column, there is a Column configuration control (gear / configure-columns icon). It is fully visible and not clipped. A Values Count column header is visible.',
    );

    await ai('Click the Column configuration icon (gear / configure columns) in the table header');
    await aiWaitFor(
      'A Column configuration panel or dropdown is open. It shows a title like "Column configuration", a list of column names with checkboxes including Values Count, and a Reset action',
    );

    await aiAssert(
      'The open Column configuration panel lists Reference Table columns (Reference Key, Name, Value Type, State, Values Count, Created Time, Last Updated) with checkboxes. The panel title stays visible above the list.',
    );

    await ai('In the Column configuration panel, uncheck the Values Count checkbox to hide that column');
    await aiWaitFor(
      'The Values Count column header is no longer visible in the table header row (the column was hidden)',
    );

    await ai('Click Reset in the Column configuration panel');
    await aiWaitFor('The Values Count column header is visible again in the table header row');

    await aiAssert(
      'After Reset, the Values Count column header is visible again in the Reference Tables header row, and the Column configuration control remains available.',
    );
  });
});
