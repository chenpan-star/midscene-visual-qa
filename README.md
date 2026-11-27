# Midscene Visual QA — LotusFlare Portal (dc02 / operator 29)

Interactive web visualizer and runnable Midscene.js + Playwright kit targeted at:

**`https://portal-dc02.lotusflare.com/#/29`**

**Live Web Visualizer:** https://chenpan-star.github.io/midscene-visual-qa/

The Pages demo uses a sanitized LotusFlare-style mock of Home / API Product Orders / Offers. Live Midscene and pixel-diff runs against the real dc02 portal happen on your machine only — auth cookies and screenshots stay local (gitignored).

## Quick start against portal-dc02

```bash
npm install
npx playwright install chromium   # or rely on channel: chrome
cp .env.example .env
# Fill OPENAI_API_KEY + MIDSCENE_MODEL_NAME in .env

# 1) Sign in once (opens Chrome against portal-dc02)
npm run tour:login

# 2) Midscene Vision AI assertions on Home / Orders / Offers / Settings
npm run test:midscene

# 3) Deterministic Playwright pixel baselines (optional)
npm run test:visual:update
npm run test:visual

# 4) Open the Playwright / Midscene HTML report
npm run test:report
```

Environment defaults (override in `.env`):

| Variable | Default |
| --- | --- |
| `PORTAL_BASE_URL` | `https://portal-dc02.lotusflare.com` |
| `PORTAL_COMPANY_ID` | `29` |
| `PORTAL_AUTH_STATE` | `.auth/user.json` |
| `MIDSCENE_MODEL_NAME` | `gpt-4.1` |

## Web visualizer (GitHub Pages)

```bash
npm run web
# or open https://chenpan-star.github.io/midscene-visual-qa/
```

Controls:

- **Midscene Vision AI / Playwright Pixel Diff** — switch how the simulated scan narrates each step.
- **Simulate UI Bugs** — inject a +22px Status-column misalignment, a clipped Create Offer CTA, and `$NaN/mo`.
- **Run QA Scan / Next Step / Reset** — step through the flow; click a report card to inspect boxes.

## What's in the repo

| Path | Purpose |
| --- | --- |
| `index.html` | Zero-dependency interactive visualizer (LF shell, operator 29 URLs) |
| `tests/midscene-qa.spec.ts` | Live Midscene `aiAssert` / `aiWaitFor` against portal-dc02 |
| `tests/visual-tour.spec.ts` | Live Playwright `toHaveScreenshot` tour against portal-dc02 |
| `tests/fixture.ts` | Midscene Playwright fixture |
| `scripts/capture-auth.mts` | One-time Chrome login → `.auth/user.json` |
| `midscene-yaml/portal-qa.yaml` | Declarative Midscene YAML for the same pages |

## Midscene vs pixel-diff (spike notes)

| Defect | Playwright screenshot | Midscene `aiAssert` |
| --- | --- | --- |
| 2–20px misalignment / spacing | Strong | Weak unless you crop with `locatePrompt` / `searchArea` |
| Clipped CTA, `$NaN`, obvious overlap | Via baseline | Strong as natural-language screen claims |
| Silent HTTP 500 / double submit | Network assertions | Misses (screenshot only) |

Use Midscene for visible intent checks. Keep Playwright pixel diffs for alignment baselines. Never point either at production tenants — every Midscene assert uploads a screenshot to your configured model.
