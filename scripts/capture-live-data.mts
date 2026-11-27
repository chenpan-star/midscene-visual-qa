/**
 * Capture real operator-29 data from portal-dc02 into assets/portal/live-data.json.
 * Prefers JSON from the portal's own API responses (not mock), with DOM text as fallback.
 *
 * Requires: npm run tour:login
 */
import { chromium, type Page, type Response } from '@playwright/test';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const baseURL = process.env.PORTAL_BASE_URL ?? 'https://portal-dc02.lotusflare.com';
const companyId = process.env.PORTAL_COMPANY_ID ?? '29';
const authState = process.env.PORTAL_AUTH_STATE
  ? resolve(process.cwd(), process.env.PORTAL_AUTH_STATE)
  : resolve(process.cwd(), '.auth/user.json');
const outDir = resolve(process.cwd(), 'assets/portal');
const outFile = resolve(outDir, 'live-data.json');

if (!existsSync(authState)) {
  console.error('Missing auth. Run: npm run tour:login');
  process.exit(1);
}

type JsonBag = { url: string; status: number; body: unknown };

async function waitReady(page: Page) {
  await page.locator('[data-testid="Sidebar"]').waitFor({ state: 'visible', timeout: 60_000 });
  await page.locator('.cursor-wait').waitFor({ state: 'hidden', timeout: 60_000 }).catch(() => undefined);
  await page.getByText(/^Loading(\.\.\.)?$/).first().waitFor({ state: 'hidden', timeout: 60_000 }).catch(() => undefined);
  await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => undefined);
  await page.waitForTimeout(2000);
}

function attachJsonSniffer(page: Page, bags: JsonBag[], match: RegExp) {
  const handler = async (res: Response) => {
    try {
      const url = res.url();
      if (!match.test(url)) return;
      if (res.status() >= 400) return;
      const ct = res.headers()['content-type'] || '';
      if (!ct.includes('json')) return;
      const body = await res.json().catch(() => null);
      if (body != null) bags.push({ url, status: res.status(), body });
    } catch {
      /* ignore */
    }
  };
  page.on('response', handler);
  return () => page.off('response', handler);
}

function asArray(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;
  if (body && typeof body === 'object') {
    const o = body as Record<string, unknown>;
    for (const key of ['data', 'items', 'content', 'results', 'productOffering', 'apiProductOrder']) {
      if (Array.isArray(o[key])) return o[key] as unknown[];
    }
    // nested common shapes
    for (const v of Object.values(o)) {
      if (Array.isArray(v) && v.length && typeof v[0] === 'object') return v as unknown[];
    }
  }
  return [];
}

function pick(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (v == null) continue;
    if (typeof v === 'string' || typeof v === 'number') return String(v);
    if (typeof v === 'object' && v && 'name' in (v as object)) return String((v as { name: unknown }).name);
  }
  return null;
}

async function scrapeHome(page: Page) {
  await page.goto(`${baseURL}/#/${companyId}`, { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  const text = await page.locator('body').innerText();
  return {
    url: page.url(),
    welcome: text.match(/Welcome back,[^\n!]+!?/)?.[0] ?? null,
    operatorLabel: text.includes('LotusFlareTelecom') ? 'LotusFlareTelecom' : null,
    environment: text.includes('Staging') ? 'Staging' : null,
  };
}

async function scrapeOrders(page: Page) {
  const bags: JsonBag[] = [];
  const stop = attachJsonSniffer(page, bags, /productOrder|apiProductOrder|api-product-order|operate/i);

  await page.goto(`${baseURL}/#/${companyId}/operate-apis/api-product-orders`, {
    waitUntil: 'domcontentloaded',
  });
  await waitReady(page);

  for (const tab of ['Pending Approval', 'All'] as const) {
    const t = page.getByText(tab, { exact: true }).first();
    if (await t.isVisible().catch(() => false)) {
      await t.click({ force: true }).catch(() => undefined);
      await waitReady(page);
    }
  }
  stop();

  const text = await page.locator('body').innerText();
  const countMatch = text.match(/API Product Orders\s*\n?\((\d+)\)/i);
  const totalCount = countMatch ? Number(countMatch[1]) : 0;

  const rows: Array<Record<string, string | null>> = [];
  for (const bag of bags) {
    for (const item of asArray(bag.body)) {
      if (!item || typeof item !== 'object') continue;
      const o = item as Record<string, unknown>;
      rows.push({
        id: pick(o, ['id', 'orderId', 'externalId']),
        description: pick(o, ['description', 'name']),
        type: pick(o, ['@type', 'type', 'orderType']),
        approvalStatus: pick(o, ['approvalStatus', 'state', 'status']),
        application: pick(o, ['application', 'applicationName']),
      });
      if (rows.length >= 10) break;
    }
    if (rows.length >= 10) break;
  }

  // DOM fallback ids
  const sampleIds = [...text.matchAll(/\b([0-9a-f]{8}-[0-9a-f]{1,4})\b/gi)].map((m) => m[1]).slice(0, 8);

  return {
    url: page.url(),
    title: countMatch ? `API Product Orders (${totalCount})` : 'API Product Orders',
    totalCount,
    apiResponseCount: bags.length,
    rows,
    sampleIds,
  };
}

async function scrapeOffers(page: Page) {
  const bags: JsonBag[] = [];
  const stop = attachJsonSniffer(page, bags, /offer|productOffering|product-offering|catalog/i);

  await page.goto(`${baseURL}/#/${companyId}/pc/offers`, { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  await page.waitForFunction(() => /Offers\s*\n?\(\d+\)/i.test(document.body.innerText), null, {
    timeout: 90_000,
  }).catch(() => undefined);
  await page.waitForTimeout(3000);
  stop();

  const text = await page.locator('body').innerText();
  const countMatch = text.match(/Offers\s*\n?\((\d+)\)/i);
  const totalCount = countMatch ? Number(countMatch[1]) : 0;

  const rows: Array<Record<string, string | null>> = [];
  for (const bag of bags) {
    for (const item of asArray(bag.body)) {
      if (!item || typeof item !== 'object') continue;
      const o = item as Record<string, unknown>;
      const name = pick(o, ['name', 'offerName', 'displayName']);
      if (!name) continue;
      rows.push({
        name,
        description: pick(o, ['description']),
        id: pick(o, ['id', 'externalId']),
        lifecycleStatus: pick(o, ['lifecycleStatus', 'publishedState', 'state']),
        price: pick(o, ['price', 'amount']),
      });
      if (rows.length >= 12) break;
    }
    if (rows.length >= 12) break;
  }

  // DOM fallback: lines after title that look like offer names (before a date line).
  if (rows.length === 0) {
    const chunk = text.split(/Offers\s*\n?\(\d+\)/i)[1] || '';
    const lines = chunk.split('\n').map((l) => l.trim()).filter(Boolean);
    const skip = new Set([
      'Filter', 'Import', 'All Channel Partners', 'New offer', 'Name', 'Description', 'Update time',
      'Published state', 'External ID', 'Draft state', 'Operations', 'Price type', 'Price', 'Currency',
      'N/A', '-', 'Flat', 'Draft', 'Published', 'Unapproved', 'Paused', 'Running', 'Expired', 'MONETARY', 'GBP',
    ]);
    for (const line of lines) {
      if (skip.has(line)) continue;
      if (/^\d{2}-\d{2}-\d{4}/.test(line) || /^£/.test(line) || /^[0-9a-f]{32}$/i.test(line)) continue;
      if (line.length < 3 || line.length > 90) continue;
      if (/^(Home|Product Catalog|Consent|API Management)$/.test(line)) continue;
      rows.push({ name: line, description: null, id: null, lifecycleStatus: null, price: null });
      if (rows.length >= 12) break;
    }
  }

  return {
    url: page.url(),
    title: countMatch ? `Offers (${totalCount})` : 'Offers',
    totalCount,
    apiResponseCount: bags.length,
    rows,
    sampleNames: rows.map((r) => r.name).filter(Boolean).slice(0, 12) as string[],
  };
}

async function scrapeSettings(page: Page) {
  await page.goto(`${baseURL}/#/${companyId}/settings/tenant-localization`, {
    waitUntil: 'domcontentloaded',
  });
  await waitReady(page);
  const text = await page.locator('body').innerText();
  return {
    url: page.url(),
    timezone: text.match(/\(GMT[^\)]+\)[^\n]*/)?.[0]?.trim() ?? null,
    dateFormat: text.match(/DD-MM-YYYY|MM-DD-YYYY|YYYY-MM-DD/)?.[0] ?? null,
    timeFormat: text.match(/12 hour|24 hour/)?.[0] ?? null,
    currency: text.match(/Canadian Dollar[^\n]*|US Dollar[^\n]*|British Pound[^\n]*/)?.[0]?.trim() ?? null,
  };
}

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
  await page.goto(`${baseURL}/#/${companyId}`, { waitUntil: 'domcontentloaded' });
  if (/#\/login(?:\?|$)/.test(page.url())) {
    throw new Error('Session expired. Re-run npm run tour:login');
  }

  const home = await scrapeHome(page);
  const orders = await scrapeOrders(page);
  const offers = await scrapeOffers(page);
  const settings = await scrapeSettings(page);

  const payload = {
    capturedAt: new Date().toISOString(),
    portalBaseUrl: baseURL,
    companyId,
    source: 'live portal-dc02 API + DOM (Playwright)',
    home,
    orders,
    offers,
    settings,
    screenshots: {
      login: 'assets/portal/login.png',
      home: 'assets/portal/home.png',
      orders: 'assets/portal/orders.png',
      offers: 'assets/portal/offers.png',
      settings: 'assets/portal/settings.png',
    },
  };

  await writeFile(outFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  process.stdout.write(`Wrote ${outFile}\n`);
  process.stdout.write(`  welcome=${home.welcome}\n`);
  process.stdout.write(`  orders=${orders.title} apiBags=${orders.apiResponseCount} rows=${orders.rows.length}\n`);
  process.stdout.write(`  offers=${offers.title} apiBags=${offers.apiResponseCount} samples=${offers.sampleNames.slice(0, 3).join(' | ')}\n`);
  process.stdout.write(`  settings tz=${settings.timezone} currency=${settings.currency}\n`);
} finally {
  await browser.close();
}
