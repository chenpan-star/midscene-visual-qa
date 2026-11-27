import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from './fixture';

const companyId = process.env.PORTAL_COMPANY_ID ?? '29';
const authState = process.env.PORTAL_AUTH_STATE
  ? resolve(process.cwd(), process.env.PORTAL_AUTH_STATE)
  : resolve(process.cwd(), '.auth/user.json');

/**
 * Live Midscene Vision QA against portal-dc02 operator 29.
 * Ready once Gemini/OpenAI quota is available — no code changes needed tomorrow:
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
      await expect(page, 'Session expired. Run npm run tour:login again.').not.toHaveURL(/#\/login(?:\?|$)/);

      await page.locator('[data-testid="Sidebar"]').waitFor({ state: 'visible', timeout: 60_000 });
      await page.locator('.cursor-wait').waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => undefined);
      await aiWaitFor('The main page content has finished loading and is not showing only a Loading spinner');

      await aiAssert(pageDef.assert);
    });
  }

  /**
   * Verifies Storybook DataTable "Column Configuration" contract on a live catalog page.
   * Code: Table can-select-columns + table-key → ColumnSelectionDropdown (ConfigureColumnIcon).
   * Storybook: Basic Components / DataTable / Configure Columns
   *   https://portal-components-storybook.dc02-2.lotusflare.info/?path=/story/basic-components-datatable--configure-columns
   */
  test('Reference Table — Column Configuration', async ({ page, ai, aiAssert, aiWaitFor }) => {
    test.setTimeout(240_000);
    await page.goto(`/#/${companyId}/pc/reference-table`);
    await expect(page, 'Session expired. Run npm run tour:login again.').not.toHaveURL(/#\/login(?:\?|$)/);

    await page.locator('[data-testid="Sidebar"]').waitFor({ state: 'visible', timeout: 60_000 });
    await page.locator('.cursor-wait').waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => undefined);
    await aiWaitFor('The Reference Tables page has finished loading and the data table is visible');

    await aiAssert(
      'In the table header row, near the right edge after the Last Updated column, there is a Column configuration control (gear / configure-columns icon). It is fully visible and not clipped.',
    );

    await ai('Click the Column configuration icon (gear / configure columns) in the table header');
    await aiWaitFor(
      'A Column configuration panel or dropdown is open. It shows a title like "Column configuration", a list of column names with checkboxes, and optionally a Reset action',
    );

    await aiAssert(
      'The open Column configuration panel lists the Reference Table columns (such as Reference Key, Name, Value Type, State, Values Count, Created Time, Last Updated) with checkboxes. The panel title stays visible above the list. No overlapping or clipped controls.',
    );
  });
});
