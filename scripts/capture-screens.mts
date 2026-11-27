/**
 * Capture real portal-dc02 screenshots for the Pages visualizer.
 * Requires a prior `npm run tour:login` (writes .auth/user.json).
 *
 * Waits past Loading spinners and prefers filters that show rows when available.
 */
import { chromium, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const baseURL = process.env.PORTAL_BASE_URL ?? 'https://portal-dc02.lotusflare.com';
const companyId = process.env.PORTAL_COMPANY_ID ?? '29';
const authState = process.env.PORTAL_AUTH_STATE
  ? resolve(process.cwd(), process.env.PORTAL_AUTH_STATE)
  : resolve(process.cwd(), '.auth/user.json');
const outDir = resolve(process.cwd(), 'assets/portal');

if (!existsSync(authState)) {
  console.error('Missing auth. Run: npm run tour:login');
  process.exit(1);
}

type PageDef = {
  id: string;
  path: string;
  ready: string;
  /** Extra wait/selectors after navigation so we don't capture mid-spinner. */
  settle?: (page: Page) => Promise<void>;
};

async function waitOutLoading(page: Page) {
  await page.locator('[data-testid="Sidebar"]').waitFor({ state: 'visible', timeout: 60_000 });
  // Common portal busy cues
  await page.locator('.cursor-wait').waitFor({ state: 'hidden', timeout: 60_000 }).catch(() => undefined);
  await page
    .getByText(/^Loading(\.\.\.)?$/)
    .first()
    .waitFor({ state: 'hidden', timeout: 60_000 })
    .catch(() => undefined);
  // Circular spinners (antd / custom)
  await page
    .locator('.ant-spin-spinning, .lf-spinner, [class*="Spinner"]')
    .first()
    .waitFor({ state: 'hidden', timeout: 45_000 })
    .catch(() => undefined);
  await page.waitForLoadState('networkidle', { timeout: 45_000 }).catch(() => undefined);
  await page.waitForTimeout(1500);
}

async function settleOrders(page: Page) {
  await waitOutLoading(page);
  // Pending Approval can be empty while All still has rows — prefer All for a data-rich demo shot.
  const allTab = page.getByRole('button', { name: /^All$/ }).or(page.getByText(/^All$/, { exact: true }));
  if (await allTab.first().isVisible().catch(() => false)) {
    await allTab.first().click({ force: true }).catch(() => undefined);
    await waitOutLoading(page);
  }
  // Prefer a partner that actually returns rows when the default is empty.
  const partnerSelect = page.getByText(/Select Channel Partner|All Channel Partners/i).first();
  if (await partnerSelect.isVisible().catch(() => false)) {
    // Already on a partner filter — just give the table one more beat.
    await page.waitForTimeout(2000);
  }
  // If we still see the empty state with a spinner, wait a bit more once.
  const spinning = page.locator('text=No data').first();
  if (await spinning.isVisible().catch(() => false)) {
    await page.waitForTimeout(5000);
    await waitOutLoading(page);
  }
}

async function settleOffers(page: Page) {
  await waitOutLoading(page);
  const offersTable = page.locator('[data-tour="pc-offers-list"]');
  await offersTable.waitFor({ state: 'visible', timeout: 60_000 }).catch(() => undefined);
  // Table loading flag drops when rows (or empty) settle.
  await page
    .locator('[data-tour="pc-offers-list"] [class*="loading"], [data-tour="pc-offers-list"] .ant-spin-spinning')
    .first()
    .waitFor({ state: 'hidden', timeout: 60_000 })
    .catch(() => undefined);
  await page.waitForTimeout(2000);
}

async function settleSettings(page: Page) {
  await waitOutLoading(page);
  await page.getByText(/Company Settings|Timezone|Date format/i).first().waitFor({
    state: 'visible',
    timeout: 45_000,
  }).catch(() => undefined);
  await page.waitForTimeout(1000);
}

const pages: PageDef[] = [
  { id: 'home', path: `/#/${companyId}`, ready: '[data-testid="Sidebar"]', settle: waitOutLoading },
  {
    id: 'orders',
    path: `/#/${companyId}/operate-apis/api-product-orders`,
    ready: '[data-testid="Sidebar"]',
    settle: settleOrders,
  },
  {
    id: 'offers',
    path: `/#/${companyId}/pc/offers`,
    ready: '[data-testid="Sidebar"]',
    settle: settleOffers,
  },
  {
    id: 'settings',
    path: `/#/${companyId}/settings/tenant-localization`,
    ready: '[data-testid="Sidebar"]',
    settle: settleSettings,
  },
];

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({
  storageState: authState,
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  ignoreHTTPSErrors: true,
});
const page = await context.newPage();

try {
  for (const def of pages) {
    process.stdout.write(`Capturing ${def.id} → ${baseURL}${def.path}\n`);
    await page.goto(`${baseURL}${def.path}`, { waitUntil: 'domcontentloaded' });
    // Hash routes sometimes need a second tick before Vue picks up the path.
    await page.waitForTimeout(500);
    if (!page.url().includes(def.path.replace(/^\/#/, '#')) && !page.url().includes(def.path.slice(2))) {
      // Force hash again if the SPA landed elsewhere.
      await page.evaluate((hashPath) => {
        window.location.hash = hashPath.replace(/^\/#/, '#');
      }, def.path);
      await page.waitForTimeout(800);
    }
    if (/#\/login(?:\?|$)/.test(page.url())) {
      throw new Error(`Session expired on ${def.id}. Re-run npm run tour:login`);
    }
    await page.locator(def.ready).waitFor({ state: 'visible', timeout: 60_000 });
    if (def.settle) await def.settle(page);
    else await waitOutLoading(page);

    const target = resolve(outDir, `${def.id}.png`);
    await page.screenshot({ path: target, fullPage: false, animations: 'disabled' });
    process.stdout.write(`  url=${page.url()}\n  wrote ${target}\n`);
  }

  const loginCtx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    ignoreHTTPSErrors: true,
  });
  const loginPage = await loginCtx.newPage();
  await loginPage.goto(`${baseURL}/#/login`, { waitUntil: 'domcontentloaded' });
  await loginPage.waitForTimeout(2500);
  const loginTarget = resolve(outDir, 'login.png');
  await loginPage.screenshot({ path: loginTarget, fullPage: false, animations: 'disabled' });
  process.stdout.write(`  wrote ${loginTarget}\n`);
  await loginCtx.close();
} finally {
  await browser.close();
}

process.stdout.write('Done. Visualizer assets updated under assets/portal/\n');
