# Midscene Visual QA — Live Visualizer & Exploration Kit

Interactive web visualizer and starter kit for exploring [Midscene.js](https://github.com/web-infra-dev/midscene) alongside deterministic Playwright pixel-diff screenshot tours.

**Live Web Visualizer:** https://chenpan-star.github.io/midscene-visual-qa/

## What is in this repo

- **`index.html`** — Zero-dependency interactive 3-pane live visualizer:
  - Toggle between **Midscene Vision AI** and **Playwright Pixel Diff** modes.
  - Toggle **Simulate UI Bugs** to inject a `+22px` misaligned table column header, a clipped CTA button, and an unformatted `$NaN/mo` price.
  - Step through live (`Run QA Scan`, `Next Step`, `Reset`) and click any card in the **Visual HTML Report** to time-travel back to that screen and inspect bounding boxes.
- **`tests/visual-tour.spec.ts`** — Deterministic Playwright full-page screenshot diff tour (`toHaveScreenshot`).
- **`tests/midscene-qa.spec.ts`** & **`tests/fixture.ts`** — Midscene `@midscene/web/playwright` fixture and semantic `aiAssert` examples.
- **`midscene-yaml/portal-qa.yaml`** — Declarative Midscene YAML flow mirroring the web visualizer.

## Quick Start

### 1. Open the web visualizer locally

Open `index.html` directly in any browser, or serve it:

```bash
npm run web
```

### 2. Run Playwright + Midscene locally

```bash
npm install
npx playwright install chromium
cp .env.example .env
# Fill OPENAI_API_KEY and MIDSCENE_MODEL_NAME in .env

# Deterministic screenshot baseline + diff
npm run test:visual:update
npm run test:visual

# Midscene Vision QA assertions
npm run test:midscene

# View Playwright HTML report
npm run test:report
```

## Key Spike Takeaways: Midscene vs. Playwright Pixel Diff

| Defect Type | Playwright `toHaveScreenshot` | Midscene `aiAssert` |
| --- | --- | --- |
| Small misalignment (2–20px), spacing drift, icon orientation | Strong (exact pixel diff) | Weak on full-screen shots (small icons ~10% uncropped, ~70% cropped with `searchArea`/`locatePrompt`) |
| Obvious layout breakage, clipped text, `$NaN`, wrong visible math | Catches via pixel diff (requires baseline) | Strong without baselines (natural-language claim on screen) |
| Off-screen bugs (silent HTTP 500 behind optimistic toast, double submit) | Check via Playwright network assertions | Misses (cannot see network; only reads screenshot) |
| Data privacy / model cost | Local, zero external upload | Sends each screenshot to configured VLM (use test/staging tenants only) |

**Recommended hybrid workflow:** Use Playwright pixel diffs for stable layout/alignment baselines on core screens, and add targeted Midscene `aiAssert` checks where visual intent matters more than pixel-identical data.
