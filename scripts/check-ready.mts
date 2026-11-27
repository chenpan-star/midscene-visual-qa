/**
 * Preflight for tomorrow's Midscene run — no AI calls.
 * Checks .env model config + saved portal session.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import 'dotenv/config';

const root = process.cwd();
const authState = process.env.PORTAL_AUTH_STATE
  ? resolve(root, process.env.PORTAL_AUTH_STATE)
  : resolve(root, '.auth/user.json');
const liveData = resolve(root, 'assets/portal/live-data.json');

const problems: string[] = [];
const notes: string[] = [];

const apiKey = process.env.MIDSCENE_MODEL_API_KEY || process.env.OPENAI_API_KEY;
const modelName = process.env.MIDSCENE_MODEL_NAME || '(midscene default)';
const family = process.env.MIDSCENE_MODEL_FAMILY || '(unset)';
const baseUrl = process.env.MIDSCENE_MODEL_BASE_URL || process.env.OPENAI_BASE_URL || '(default)';

if (!apiKey || apiKey.includes('your-') || apiKey.length < 16) {
  problems.push('Missing model API key in .env (MIDSCENE_MODEL_API_KEY or OPENAI_API_KEY)');
} else {
  notes.push(`Model key present (${apiKey.slice(0, 6)}…${apiKey.slice(-4)})`);
}
notes.push(`MIDSCENE_MODEL_FAMILY=${family}`);
notes.push(`MIDSCENE_MODEL_NAME=${modelName}`);
notes.push(`BASE_URL=${baseUrl}`);

if (!existsSync(authState)) {
  problems.push('No saved portal session. Run: npm run tour:login');
} else {
  try {
    const state = JSON.parse(readFileSync(authState, 'utf8')) as {
      cookies?: Array<{ name: string; expires?: number }>;
    };
    const cookies = state.cookies || [];
    const authCookie = cookies.find(
      (c) => c.name === 'lf-portal-authenticated' || c.name === 'lf-portal-session',
    );
    notes.push(`Auth file OK (${cookies.length} cookies)`);
    // Playwright uses expires=-1 for session cookies; only flag real past expiry timestamps.
    if (
      authCookie &&
      typeof authCookie.expires === 'number' &&
      authCookie.expires > 0 &&
      authCookie.expires * 1000 < Date.now()
    ) {
      problems.push('Portal session cookie looks expired. Re-run: npm run tour:login');
    } else if (!authCookie) {
      notes.push('No lf-portal-* cookie found — re-login if Midscene hits /#/login');
    }
  } catch {
    problems.push(`Could not parse ${authState}`);
  }
}

if (!existsSync(liveData)) {
  notes.push('No live-data.json yet — optional for live Midscene; needed for Pages frame. Run: npm run capture:inventory');
} else {
  try {
    const data = JSON.parse(readFileSync(liveData, 'utf8')) as {
      capturedAt?: string;
      pages?: unknown[];
    };
    notes.push(`Inventory: ${data.pages?.length ?? 0} pages · captured ${data.capturedAt ?? '?'}`);
  } catch {
    problems.push('assets/portal/live-data.json is invalid JSON');
  }
}

process.stdout.write('\nMidscene ready check (no AI call)\n');
process.stdout.write('─────────────────────────────────\n');
for (const n of notes) process.stdout.write(`  ✓ ${n}\n`);
if (problems.length) {
  process.stdout.write('\nFix before test:midscene:\n');
  for (const p of problems) process.stdout.write(`  ✕ ${p}\n`);
  process.stdout.write('\n');
  process.exit(1);
}

process.stdout.write('\nReady. Tomorrow (quota reset):\n');
process.stdout.write('  1) npm run check:ready\n');
process.stdout.write('  2) npm run tour:login   # only if session expired\n');
process.stdout.write('  3) npm run test:midscene\n');
process.stdout.write('  4) optional: npm run capture:inventory  # refresh Pages frame\n\n');
process.exit(0);
