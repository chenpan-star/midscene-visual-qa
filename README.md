# Midscene Visual QA — LotusFlare Portal (dc02 / operator 29)

**Framework kept. Portal frame = your real portal.**

Target: **`https://portal-dc02.lotusflare.com/#/29`**

**Live Web Visualizer:** https://chenpan-star.github.io/midscene-visual-qa/

The Pages demo keeps the Midscene Vision QA chrome (YAML steps, Observe → Plan → Verify, AI cursor, report timeline, bug-sim toggle). The **browser frame** shows real captures from operator 29 — not a mock portal shell.

GitHub Pages cannot iframe the live site (`X-Frame-Options: deny`). Midscene against the live portal runs on your machine.

## Tomorrow (when Gemini quota resets)

Your `.env` already has the Gemini key. No code changes needed:

```bash
cd ~/midscene-visual-qa
npm run check:ready          # no AI call — verifies key + session
npm run tour:login           # only if check:ready says session expired
npm run test:midscene        # live Vision QA on 7 portal pages
npm run capture:inventory    # optional — refresh Pages frame assets
# then commit+push if you want Pages updated
```

Open the Midscene HTML report under `midscene_run/report/` when the run finishes.

## Setup (already done on this machine)

```bash
npm install
cp .env.example .env         # Gemini key already in .env (gitignored)
npm run tour:login           # Chrome → portal-dc02 /#/29
```

## Commands

```bash
npm run check:ready         # preflight (auth + model key, no AI)
npm run tour:login          # save portal session → .auth/user.json
npm run test:midscene       # Midscene on the LIVE portal (needs quota)
npm run test:visual         # Playwright pixel tour on the LIVE portal
npm run capture:inventory   # screenshots + live-data.json + layout boxes
npm run capture:all         # alias for capture:inventory
npm run web                 # serve visualizer locally on :4173
```

## Model config (`.env`)

Gemini (current):

```bash
MIDSCENE_MODEL_FAMILY=gemini
MIDSCENE_MODEL_NAME=gemini-3.5-flash
MIDSCENE_MODEL_API_KEY=...
MIDSCENE_MODEL_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
```

OpenAI (optional alternate):

```bash
MIDSCENE_MODEL_API_KEY=sk-...
MIDSCENE_MODEL_NAME=gpt-4.1
MIDSCENE_MODEL_BASE_URL=https://api.openai.com/v1
# comment out MIDSCENE_MODEL_FAMILY=gemini
```

| Variable | Default |
| --- | --- |
| `PORTAL_BASE_URL` | `https://portal-dc02.lotusflare.com` |
| `PORTAL_COMPANY_ID` | `29` |
| `PORTAL_AUTH_STATE` | `.auth/user.json` (gitignored) |

## Pages scanned by Midscene

1. Home (`/#/29`)
2. API Product Orders
3. Offers
4. Products
5. Templates
6. Reference Table
7. Settings (tenant localization)

Each assert checks alignment, clipped CTAs, and obvious layout defects.

## Layout

| Path | Purpose |
| --- | --- |
| `index.html` | Midscene framework UI + portal inventory in the frame |
| `assets/portal/*.png` | Captures from operator 29 |
| `assets/portal/live-data.json` | Scraped pages, headers, rows, layout boxes |
| `tests/midscene-qa.spec.ts` | Midscene against live dc02 |
| `tests/visual-tour.spec.ts` | Pixel tour against live dc02 |
| `scripts/check-ready.mts` | Preflight without calling the model |
| `scripts/capture-portal-inventory.mts` | Full inventory capture |
| `midscene-yaml/portal-qa.yaml` | Declarative Midscene flow |
