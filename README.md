# Midscene Visual QA — LotusFlare Portal (dc02 / operator 29)

**Framework kept. Portal frame = your real portal.**

Target: **`https://portal-dc02.lotusflare.com/#/29`**

**Live Web Visualizer:** https://chenpan-star.github.io/midscene-visual-qa/

The Pages demo keeps the Midscene Vision QA chrome (YAML steps, Observe → Plan → Verify, AI cursor, report timeline, bug-sim toggle). The **browser frame** shows real captures from operator 29 — not a mock portal shell.

GitHub Pages cannot iframe the live site (`X-Frame-Options: deny`). Midscene against the live portal runs on your machine.

## Live Midscene against your portal

```bash
npm install
cp .env.example .env   # OPENAI_API_KEY (+ optional MIDSCENE_MODEL_NAME)

npm run tour:login          # Chrome → portal-dc02 /#/29
npm run test:midscene       # Midscene on the LIVE portal
npm run test:visual         # Playwright pixel tour on the LIVE portal
npm run capture:live        # scrape your real Home/Orders/Offers/Settings into live-data.json
npm run capture:screens     # refresh assets/portal/*.png used in the frame
npm run capture:all         # live-data.json + screenshots
```

The Pages visualizer loads `assets/portal/live-data.json` (your operator-29 scrape) into the Midscene report steps — not mock KPI/offer rows.

| Variable | Default |
| --- | --- |
| `PORTAL_BASE_URL` | `https://portal-dc02.lotusflare.com` |
| `PORTAL_COMPANY_ID` | `29` |
| `PORTAL_AUTH_STATE` | `.auth/user.json` (gitignored) |

## Layout

| Path | Purpose |
| --- | --- |
| `index.html` | Midscene framework UI + real portal screenshots in the frame |
| `assets/portal/*.png` | Captures from operator 29 (login / Home / Orders / Offers / Settings) |
| `assets/portal/live-data.json` | Scraped live counts/names/settings from your dc02 session |
| `tests/midscene-qa.spec.ts` | Midscene against live dc02 |
| `tests/visual-tour.spec.ts` | Pixel tour against live dc02 |
| `scripts/capture-live-data.mts` | Scrape live portal JSON for the visualizer |
| `scripts/capture-screens.mts` | Refresh frame screenshots from a logged-in session |
| `midscene-yaml/portal-qa.yaml` | Declarative Midscene flow for the same URLs |
