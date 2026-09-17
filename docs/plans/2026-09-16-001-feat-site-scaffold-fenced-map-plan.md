---
title: "feat: Scaffold the one-page site with an HTML/CSS banner and a Redlands-fenced Leaflet map"
type: feat
status: active
date: 2026-09-16
issue: 2
origin: docs/spec/PRD.md
---

# feat: Scaffold the one-page site + Redlands-fenced map

## Summary
Create the static GitHub Pages site at the repo root: `index.html` with a CSS-only retro banner, a Leaflet map fenced to ZIP 92373/92374 that plots `data/networks.json`, a themed `privacy.html` stub, the committed boundary GeoJSON, an empty seed database, and a Playwright smoke test driven by fixtures under `tests/fixtures/`.

## Problem Frame
The repo has a spec and an inbox of raw logs but no site. Every later issue (ingest #3, CI #4, daily job #5, privacy #6, polish #7) builds on this shell and on the database schema it fixes. (see origin: docs/spec/PRD.md — R1, R2, R7, R8.2, R8.3)

## Requirements
- R1.1–R1.6 — one page + linked privacy page, HTML/CSS banner, retro palette, no horizontal scroll ≥360 px, visible privacy link, no trackers/cookies.
- R2.1–R2.7 — one marker per network, pan/zoom fenced to the ZCTA bbox, popup fields, open-vs-encrypted colors + legend, count + last-updated stats, keyless tiles with attribution, on-page error on load failure.
- R7 — no secrets; only `data/networks.json` as long-lived data.
- R8.2 / R8.3 — Playwright smoke test from a fixture database; fixtures never under `ingest/`.

## Key Technical Decisions
- **No build step; Leaflet 1.9.4 from cdnjs with SRI + `crossorigin`.** Matches the constitution's stack. Hashes verified against both cdnjs and unpkg copies.
- **Tiles: standard OpenStreetMap** (`tile.openstreetmap.org`, keyless, OSM attribution) darkened with a CSS filter. CARTO `dark_all` was tried first but now watermarks tiles "API KEY REQUIRED", which violates R2.6. Tiles are third-party requests but not trackers; the page sets no cookies.
- **Boundary: Census TIGERweb `tigerWMS_Census2020` layer 84 (ZCTA5 IN 92373, 92374), `outSR=4326`, 5-decimal precision** → ~49 KB, under the 200 KB cap, so no simplification. Source query documented in `data/README.md`.
- **Fence = boundary bbox padded ~10%, `maxBoundsViscosity: 1`, `minZoom` computed from `getBoundsZoom(bounds)`** after the boundary loads, so it adapts to viewport width instead of a hard-coded number.
- **Encryption classification:** `auth` containing `WEP`, `WPA`, or `RSN` (case-insensitive) = encrypted; empty / `[ESS]` / `OPEN` / anything else = open. WiGLE `AuthMode` strings look like `[WPA2_PSK]` or `[OPEN]`.
- **Markers: `L.circleMarker`** (SVG, no icon image assets) colored green (encrypted) / amber (open); legend is HTML.
- **Rendering safety:** SSIDs are untrusted broadcast strings — popups are built with DOM nodes / `textContent`, never HTML interpolation.
- **Error path (R2.7):** a fetch failure or invalid JSON shows a visible `role="alert"` panel; the boundary is still drawn if it loaded. A boundary failure also shows the alert and falls back to a hard-coded bbox.
- **Test fixture swap:** Playwright serves the repo root with `python3 -m http.server` (stdlib; no extra dependency) via `webServer`, and uses `page.route('**/data/networks.json')` to fulfil from `tests/fixtures/networks-3.json`. Tile requests are aborted in tests to keep them offline and deterministic.
- **`tests/__init__.py` exists** so `python3 -m unittest discover -s tests` (the constitution `ci_command`) runs cleanly before issue #3 adds unit tests.

## Implementation Units

### U1. Data files
**Goal:** Boundary GeoJSON, empty seed database, and source documentation.
**Requirements:** R2.2, R2.1, R7.2
**Dependencies:** none
**Files:** `data/redlands-boundary.geojson`, `data/networks.json`, `data/README.md`
**Approach:** Commit the TIGERweb FeatureCollection as fetched (properties: `ZCTA5`). Seed `{"updated_at": <ISO-8601>, "count": 0, "networks": []}`; README documents the schema fields (`bssid, ssid, auth, channel, first_seen, lat, lon`), the boundary source URL, and that the ingest job owns `networks.json`.
**Test expectation:** exercised by U3's smoke test (the real seed renders 0 networks).
**Verification:** both files parse as JSON; boundary has exactly two features, 92373 and 92374.

### U2. Site shell and map
**Goal:** `index.html` (inline CSS/JS is fine at this size, or `assets/site.css` + `assets/map.js`) and a `privacy.html` stub sharing the theme.
**Requirements:** R1.1–R1.6, R2.1–R2.7, R6.1 (stub link only)
**Dependencies:** U1
**Files:** `index.html`, `privacy.html`, `assets/site.css`, `assets/map.js`
**Approach:** Banner is a heading element styled with monospace, phosphor-green glow, CSS scanlines, blinking cursor. Layout is a single column with `max-width` and `min-width: 0` children; map height in `vh` with a floor. Stats line (`#stats`) shows count and `updated_at`; legend lists "encrypted" and "open". Footer carries the privacy link. No cookies, storage, analytics, or external fonts.
**Test scenarios:**
- Page loads with the empty seed: banner text "Redlands Wifi Project" is present as text (not an image); stats reads 0 networks; privacy link is visible and points to `privacy.html`; boundary outline path renders.
- Fixture of 3 networks (2 encrypted, 1 open, one with blank SSID): 3 markers render; 2 use the encrypted color and 1 the open color.
- Clicking the blank-SSID marker opens a popup containing "hidden", its BSSID, auth, channel, and first-seen.
- An SSID containing `<img src=x onerror=...>` renders as literal text (no element injected).
- `networks.json` returns 500 → an alert with an error message is visible and no marker renders.
- At a 360×740 viewport, `document.documentElement.scrollWidth <= clientWidth`, on both pages.
- The map's `maxBounds` is set and `minZoom` is > 0.
- `privacy.html` has a link back to `index.html`.
**Verification:** all scenarios pass in U3.

### U3. Playwright smoke test and tooling
**Goal:** Browser smoke test runnable as `npx playwright test`.
**Requirements:** R8.2, R8.3
**Dependencies:** U2
**Files:** `package.json`, `package-lock.json`, `playwright.config.js`, `tests/e2e/site.spec.js`, `tests/fixtures/networks-3.json`, `tests/__init__.py`, `.gitignore`
**Approach:** Chromium-only project; `webServer` runs `python3 -m http.server` on a fixed port from the repo root; `testDir: tests/e2e`. Ignore `test-results/` and `playwright-report/`. The map exposes a small read-only test hook (e.g. `window.__rwp` with marker count / map instance) only if selector-based counting proves flaky — prefer counting `path.leaflet-interactive` by class.
**Test scenarios:** as listed in U2.
**Verification:** `npx playwright test` green locally; `python3 -m unittest discover -s tests` exits 0.

## Scope Boundaries
- Privacy page content (issue #6), visual polish pass (#7), CI workflow (#4), ingest script (#3), daily job (#5) are out of scope.
- `ingest/` is not touched. GitHub Pages settings are not touched.

### Deferred to Follow-Up Work
- Marker clustering if the database grows into the thousands (PRD lists no clustering requirement; revisit at backfill #8).

## Risks
- **Leaflet CDN outage** → the map fails. Acceptable for v1; the alert panel covers a `L` undefined case.
- **Pages serves from repo root**, so `node_modules/` must stay ignored and never committed; `package.json` at root is harmless to Pages (Jekyll ignores nothing relevant; add `.nojekyll` to avoid Jekyll processing of `_`-prefixed paths).

## Assumptions
- Headless/unattended run: no repo research agents were dispatched because the repo contains no code yet; external facts (Leaflet SRI, TIGERweb layer id) were verified directly.
- `first_seen` is displayed as stored (the ingest issue decides its exact string format).
