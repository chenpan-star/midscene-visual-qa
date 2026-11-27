/**
 * Capture real portal-dc02 screenshots for the Pages visualizer.
 * Requires a prior `npm run tour:login` (writes .auth/user.json).
 */
import { chromium } from '@playwright/test';
import { existsSync } from 'node:fs';
import { mkdir, copyFile } from 'node:fs/promises';
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

const pages = [
  { id: 'home', path: `/#/${companyId}`, ready: '[data-testid="Sidebar"]' },
  {
    id: 'orders',
    path: `/#/${companyId}/operate-apis/api-product-orders`,
    ready: '[data-testid="Sidebar"]',
  },
  { id: 'offers', path: `/#/${companyId}/pc/offers`, ready: '[data-testid="Sidebar"]' },
  {
    id: 'settings',
    path: `/#/${companyId}/settings/tenant-localization`,
    ready: '[data-testid="Sidebar"]',
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
    if (/#\/login(?:\?|$)/.test(page.url())) {
      throw new Error(`Session expired on ${def.id}. Re-run npm run tour:login`);
    }
    await page.locator(def.ready).waitFor({ state: 'visible', timeout: 60_000 });
    // Wait out page spinner; keep going if the page never uses .cursor-wait.
    await page.locator('.cursor-wait').waitFor({ state: 'hidden', timeout: 45_000 }).catch(() => undefined);
    // Extra settle for Vue route content.
    await page.waitForTimeout(2500);
    const target = resolve(outDir, `${def.id}.png`);
    await page.screenshot({ path: target, fullPage: false });
    process.stdout.write(`  wrote ${target}\n`);
  }

  // Login frame without auth cookies (public look of the sign-in screen).
  const loginCtx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    ignoreHTTPSErrors: true,
  });
  const loginPage = await loginCtx.newPage();
  await loginPage.goto(`${baseURL}/#/login`, { waitUntil: 'domcontentloaded' });
  await loginPage.waitForTimeout(2000);
  const loginTarget = resolve(outDir, 'login.png');
  await loginPage.screenshot({ path: loginTarget, fullPage: false });
  process.stdout.write(`  wrote ${loginTarget}\n`);
  await loginCtx.close();
} finally {
  await browser.close();
}

process.stdout.write('Done. Visualizer assets updated under assets/portal/\n');
