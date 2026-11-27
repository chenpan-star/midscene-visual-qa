import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const baseURL = process.env.PORTAL_BASE_URL ?? 'https://portal-dc02.lotusflare.com';
const companyId = process.env.PORTAL_COMPANY_ID ?? '29';
const output = process.env.PORTAL_AUTH_STATE
  ? resolve(process.cwd(), process.env.PORTAL_AUTH_STATE)
  : resolve(root, '.auth/user.json');

await mkdir(dirname(output), { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: false });
const context = await browser.newContext({ ignoreHTTPSErrors: true });
const page = await context.newPage();

try {
  await page.goto(`${baseURL}/#/login`);
  process.stdout.write(
    `Sign in in the Chrome window for operator ${companyId}.\nTarget: ${baseURL}\nThe session is saved after the portal cookie appears.\n`,
  );
  await page.waitForFunction(
    () =>
      document.cookie.includes('lf-portal-authenticated=') ||
      document.cookie.includes('lf-portal-session='),
    undefined,
    { timeout: 10 * 60_000 },
  );
  // Land on the operator home so the saved session includes company context.
  await page.goto(`${baseURL}/#/${companyId}`);
  await page.waitForTimeout(1500);
  await context.storageState({ path: output });
  process.stdout.write(`Saved session to ${output}\n`);
} finally {
  await browser.close();
}
