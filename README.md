# portal-dc02 Vision QA (operator 29)

Target: **`https://portal-dc02.lotusflare.com/#/29`**

This kit drives **your live LotusFlare portal** with Midscene + Playwright. There is no mock portal app.

**Pages site:** https://chenpan-star.github.io/midscene-visual-qa/  
Shows real screenshots captured from operator 29 only. It cannot embed the live portal — dc02 sends `X-Frame-Options: deny` — so open the portal in a normal browser or run the local Midscene suite.

## Live Midscene (real portal)

```bash
npm install
cp .env.example .env   # OPENAI_API_KEY + optional MIDSCENE_MODEL_NAME

npm run tour:login     # Chrome → portal-dc02 /#/29 — sign in once
npm run test:midscene  # Midscene aiAssert / aiWaitFor on the LIVE site
npm run test:visual    # Playwright toHaveScreenshot on the LIVE site
```

Defaults:

| Variable | Default |
| --- | --- |
| `PORTAL_BASE_URL` | `https://portal-dc02.lotusflare.com` |
| `PORTAL_COMPANY_ID` | `29` |
| `PORTAL_AUTH_STATE` | `.auth/user.json` (gitignored) |

## Refresh Pages screenshots

```bash
npm run tour:login
npm run capture:screens   # writes assets/portal/*.png from the live session
```

## Layout

| Path | Purpose |
| --- | --- |
| `index.html` | Real-screenshot viewer for Pages (no mock UI) |
| `assets/portal/` | Captures from operator 29 |
| `tests/midscene-qa.spec.ts` | Midscene against live dc02 |
| `tests/visual-tour.spec.ts` | Pixel tour against live dc02 |
| `scripts/capture-auth.mts` | Save login cookies locally |
| `scripts/capture-screens.mts` | Refresh real screenshots |
| `midscene-yaml/portal-qa.yaml` | Declarative Midscene flow for the same URLs |
