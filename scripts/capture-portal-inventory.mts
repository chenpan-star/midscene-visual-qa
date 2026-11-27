/**
 * Capture a full portal-dc02 inventory for the Pages visualizer frame:
 * screenshots + live DOM/API rows + measured layout boxes (for Midscene green/red overlays).
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
type LayoutBox = { id: string; left: number; top: number; width: number; height: number };
type PageInventory = {
  id: string;
  label: string;
  path: string;
  url: string;
  title: string | null;
  totalCount: number | null;
  headers: string[];
  rows: Array<Record<string, string | null>>;
  sampleNames: string[];
  bodyExcerpt: string;
  layout: LayoutBox[];
  screenshot: string;
};

async function waitReady(page: Page) {
  await page.locator('[data-testid="Sidebar"]').waitFor({ state: 'visible', timeout: 60_000 });
  await page.locator('.cursor-wait').waitFor({ state: 'hidden', timeout: 60_000 }).catch(() => undefined);
  await page
    .getByText(/^Loading(\.\.\.)?$/)
    .first()
    .waitFor({ state: 'hidden', timeout: 60_000 })
    .catch(() => undefined);
  await page
    .locator('.ant-spin-spinning, .lf-spinner, [class*="Spinner"]')
    .first()
    .waitFor({ state: 'hidden', timeout: 45_000 })
    .catch(() => undefined);
  await page.waitForLoadState('networkidle', { timeout: 45_000 }).catch(() => undefined);
  await page.waitForTimeout(1500);
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

async function measureLayout(page: Page): Promise<LayoutBox[]> {
  // String form avoids tsx injecting __name into the browser context.
  return page.evaluate(`(() => {
    const vpW = window.innerWidth || 1440;
    const vpH = window.innerHeight || 900;
    const pct = (r) => ({
      left: Math.round((r.left / vpW) * 1000) / 10,
      top: Math.round((r.top / vpH) * 1000) / 10,
      width: Math.round((r.width / vpW) * 1000) / 10,
      height: Math.round((r.height / vpH) * 1000) / 10,
    });
    const boxes = [];
    const add = (id, el) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return;
      boxes.push(Object.assign({ id: id }, pct(r)));
    };
    add('sidebar', document.querySelector('[data-testid="Sidebar"]'));
    const headings = Array.from(document.querySelectorAll('h1,h2,[class*="PageTitle"],[class*="page-title"]'));
    let titleEl = headings.find((h) => (h.textContent || '').trim().length > 2) || null;
    if (!titleEl) {
      titleEl = Array.from(document.querySelectorAll('main *, [role="main"] *')).find((el) => {
        const t = (el.textContent || '').trim();
        return t.length > 3 && t.length < 80 && el.children.length === 0;
      }) || null;
    }
    add('title', titleEl);
    const cta = Array.from(document.querySelectorAll('button, a')).find((el) =>
      /\\+?\\s*(Add New|New |Create |Import)/i.test((el.textContent || '').trim())
    );
    add('cta', cta || null);
    const table =
      document.querySelector('table') ||
      document.querySelector('[role="table"]') ||
      document.querySelector('[class*="Table"]') ||
      document.querySelector('[data-tour*="list"]');
    add('table', table);
    const thead = document.querySelector('thead') || document.querySelector('[role="rowgroup"]');
    add('headers', thead);
    const rows = Array.from(document.querySelectorAll('tbody tr, [role="row"]')).filter((el) => {
      const r = el.getBoundingClientRect();
      return r.height > 20 && r.width > 100;
    });
    if (rows[0]) add('row1', rows[0]);
    if (rows[1]) add('row2', rows[1]);
    if (rows[2]) add('row3', rows[2]);
    return boxes;
  })()`) as Promise<LayoutBox[]>;
}

async function scrapeTableHeaders(page: Page): Promise<string[]> {
  return page.evaluate(`(() => {
    const ths = Array.from(document.querySelectorAll('th, [role="columnheader"]'))
      .map((el) => (el.textContent || '').trim().replace(/\\s+/g, ' '))
      .filter((t) => t.length > 0 && t.length < 40);
    return [...new Set(ths)].slice(0, 12);
  })()`) as Promise<string[]>;
}

async function gotoHash(page: Page, path: string) {
  await page.goto(`${baseURL}${path}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  if (/#\/login(?:\?|$)/.test(page.url())) {
    throw new Error(`Session expired on ${path}. Re-run npm run tour:login`);
  }
  await waitReady(page);
}

async function capturePage(
  page: Page,
  def: {
    id: string;
    label: string;
    path: string;
    titleRe: RegExp;
    apiMatch?: RegExp;
    settle?: (page: Page) => Promise<void>;
  },
): Promise<PageInventory> {
  const bags: JsonBag[] = [];
  const stop = def.apiMatch ? attachJsonSniffer(page, bags, def.apiMatch) : () => undefined;

  await gotoHash(page, def.path);
  if (def.settle) await def.settle(page);
  await page
    .waitForFunction(`() => /${def.titleRe.source}/i.test(document.body.innerText)`, null, {
      timeout: 90_000,
    })
    .catch(() => undefined);
  await page.waitForTimeout(1200);
  stop();

  const text = await page.locator('body').innerText();
  const titleMatch = text.match(def.titleRe);
  const title = titleMatch ? titleMatch[0].replace(/\s+/g, ' ').trim() : null;
  const countMatch = title?.match(/\((\d+)\)/);
  const totalCount = countMatch ? Number(countMatch[1]) : null;
  const headers = await scrapeTableHeaders(page);
  const layout = await measureLayout(page);

  const rows: Array<Record<string, string | null>> = [];
  for (const bag of bags) {
    for (const item of asArray(bag.body)) {
      if (!item || typeof item !== 'object') continue;
      const o = item as Record<string, unknown>;
      const name = pick(o, ['name', 'offerName', 'displayName', 'reference', 'id']);
      if (!name) continue;
      rows.push({
        name,
        description: pick(o, ['description']),
        id: pick(o, ['id', 'externalId']),
        state: pick(o, ['lifecycleStatus', 'publishedState', 'state', 'approvalStatus']),
        type: pick(o, ['valueType', '@type', 'type']),
      });
      if (rows.length >= 16) break;
    }
    if (rows.length >= 16) break;
  }

  // DOM fallback: pull plausible name lines from the content area.
  if (rows.length === 0) {
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const skip = new Set([
      'Home',
      'Product Catalog',
      'Filter',
      'Search...',
      'Staging',
      'Name',
      'State',
      'Operations',
      'Approved',
      'Draft',
      'String',
      'Array String',
    ]);
    for (const line of lines) {
      if (skip.has(line)) continue;
      if (line.length < 2 || line.length > 64) continue;
      if (/^\d{4}-\d{2}-\d{2}/.test(line)) continue;
      if (/^(Templates|Offers|Products|Services|Resources|Categories|Facets|Consent|API)/i.test(line)) continue;
      rows.push({ name: line, description: null, id: null, state: null, type: null });
      if (rows.length >= 12) break;
    }
  }

  const shotName = `${def.id}.png`;
  const shotPath = resolve(outDir, shotName);
  await page.screenshot({ path: shotPath, fullPage: false, animations: 'disabled' });
  process.stdout.write(`  wrote ${shotPath} title=${title || '?'} rows=${rows.length} boxes=${layout.length}\n`);

  return {
    id: def.id,
    label: def.label,
    path: def.path,
    url: page.url(),
    title,
    totalCount,
    headers,
    rows,
    sampleNames: rows.map((r) => r.name).filter(Boolean).slice(0, 8) as string[],
    bodyExcerpt: text.replace(/\s+/g, ' ').trim().slice(0, 1200),
    layout,
    screenshot: `assets/portal/${shotName}`,
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

const pageDefs = [
  {
    id: 'home',
    label: 'Home',
    path: `/#/${companyId}`,
    titleRe: /Welcome back,[^\n!]{0,80}!?/i,
  },
  {
    id: 'orders',
    label: 'API Product Orders',
    path: `/#/${companyId}/operate-apis/api-product-orders`,
    titleRe: /API Product Orders\s*\(?\d*\)?/i,
    apiMatch: /productOrder|apiProductOrder|api-product-order/i,
    settle: async (p: Page) => {
      const allTab = p.getByText(/^All$/, { exact: true }).first();
      if (await allTab.isVisible().catch(() => false)) {
        await allTab.click({ force: true }).catch(() => undefined);
        await waitReady(p);
      }
    },
  },
  {
    id: 'offers',
    label: 'Offers',
    path: `/#/${companyId}/pc/offers`,
    titleRe: /Offers\s*\(\d+\)/i,
    apiMatch: /offer|productOffering|product-offering/i,
  },
  {
    id: 'products',
    label: 'Products',
    path: `/#/${companyId}/pc/products`,
    titleRe: /Products\s*\(?\d*\)?/i,
    apiMatch: /product(?!Offering)|\/products/i,
  },
  {
    id: 'templates',
    label: 'Templates',
    path: `/#/${companyId}/pc/templates`,
    titleRe: /Templates\s*\(?\d*\)?/i,
    apiMatch: /template/i,
  },
  {
    id: 'reference-table',
    label: 'Reference Tables',
    path: `/#/${companyId}/pc/reference-table`,
    titleRe: /Reference Tables?\s*\(\d+\)/i,
    apiMatch: /reference|reftable|reference-table/i,
  },
  {
    id: 'settings',
    label: 'Company Settings',
    path: `/#/${companyId}/settings/tenant-localization`,
    titleRe: /Company Settings|Timezone|Date format/i,
  },
];

try {
  await page.goto(`${baseURL}/#/${companyId}`, { waitUntil: 'domcontentloaded' });
  if (/#\/login(?:\?|$)/.test(page.url())) {
    throw new Error('Session expired. Re-run npm run tour:login');
  }

  const pages: PageInventory[] = [];
  for (const def of pageDefs) {
    process.stdout.write(`Capturing ${def.id} → ${baseURL}${def.path}\n`);
    pages.push(await capturePage(page, def));
  }

  // Login (unauthenticated)
  const loginCtx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    ignoreHTTPSErrors: true,
  });
  const loginPage = await loginCtx.newPage();
  await loginPage.goto(`${baseURL}/#/login`, { waitUntil: 'domcontentloaded' });
  await loginPage.waitForTimeout(2500);
  await loginPage.screenshot({
    path: resolve(outDir, 'login.png'),
    fullPage: false,
    animations: 'disabled',
  });
  await loginCtx.close();
  process.stdout.write('  wrote login.png\n');

  const byId = Object.fromEntries(pages.map((p) => [p.id === 'reference-table' ? 'referenceTable' : p.id, p]));

  const payload = {
    capturedAt: new Date().toISOString(),
    portalBaseUrl: baseURL,
    companyId,
    source: 'live portal-dc02 inventory (screenshots + DOM/API + layout boxes)',
    purpose: 'Store full portal page info in the Midscene visualizer frame for AI bug / misalignment scan',
    home: {
      url: byId.home?.url,
      welcome: byId.home?.title,
      operatorLabel: byId.home?.bodyExcerpt.includes('LotusFlareTelecom') ? 'LotusFlareTelecom' : null,
      environment: byId.home?.bodyExcerpt.includes('Staging') ? 'Staging' : null,
    },
    orders: {
      url: byId.orders?.url,
      title: byId.orders?.title,
      totalCount: byId.orders?.totalCount ?? 0,
      rows: byId.orders?.rows ?? [],
      sampleIds: (byId.orders?.rows || []).map((r) => r.id).filter(Boolean).slice(0, 8),
      headers: byId.orders?.headers ?? [],
      layout: byId.orders?.layout ?? [],
    },
    offers: {
      url: byId.offers?.url,
      title: byId.offers?.title,
      totalCount: byId.offers?.totalCount ?? 0,
      rows: byId.offers?.rows ?? [],
      sampleNames: byId.offers?.sampleNames ?? [],
      headers: byId.offers?.headers ?? [],
      layout: byId.offers?.layout ?? [],
    },
    products: {
      url: byId.products?.url,
      title: byId.products?.title,
      totalCount: byId.products?.totalCount ?? 0,
      rows: byId.products?.rows ?? [],
      sampleNames: byId.products?.sampleNames ?? [],
      headers: byId.products?.headers ?? [],
      layout: byId.products?.layout ?? [],
    },
    templates: {
      url: byId.templates?.url,
      title: byId.templates?.title,
      totalCount: byId.templates?.totalCount ?? 0,
      rows: byId.templates?.rows ?? [],
      sampleNames: byId.templates?.sampleNames ?? [],
      headers: byId.templates?.headers ?? [],
      layout: byId.templates?.layout ?? [],
    },
    referenceTable: {
      url: byId.referenceTable?.url,
      title: byId.referenceTable?.title,
      totalCount: byId.referenceTable?.totalCount ?? 0,
      rows: byId.referenceTable?.rows ?? [],
      sampleNames: byId.referenceTable?.sampleNames ?? [],
      headers: byId.referenceTable?.headers ?? [],
      columns: byId.referenceTable?.headers ?? [],
      layout: byId.referenceTable?.layout ?? [],
      bodyExcerpt: byId.referenceTable?.bodyExcerpt ?? '',
    },
    settings: {
      url: byId.settings?.url,
      timezone: byId.settings?.bodyExcerpt.match(/\(GMT[^\)]+\)[^|]{0,40}/)?.[0]?.trim() ?? null,
      dateFormat: byId.settings?.bodyExcerpt.match(/DD-MM-YYYY|MM-DD-YYYY|YYYY-MM-DD/)?.[0] ?? null,
      timeFormat: byId.settings?.bodyExcerpt.match(/12 hour|24 hour/)?.[0] ?? null,
      currency:
        byId.settings?.bodyExcerpt.match(/Canadian Dollar[^|]{0,20}|US Dollar[^|]{0,20}|British Pound[^|]{0,20}/)?.[0]?.trim() ??
        null,
      layout: byId.settings?.layout ?? [],
    },
    pages,
    screenshots: Object.fromEntries([
      ['login', 'assets/portal/login.png'],
      ...pages.map((p) => [p.id === 'reference-table' ? 'referenceTable' : p.id, p.screenshot]),
    ]),
  };

  await writeFile(outFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  process.stdout.write(`Wrote ${outFile} (${pages.length} pages)\n`);
} finally {
  await browser.close();
}
