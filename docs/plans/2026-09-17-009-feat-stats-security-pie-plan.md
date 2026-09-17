---
title: "feat: Stats section under the map with a security pie chart"
type: feat
status: active
date: 2026-09-17
issue: 12
---

# feat: Stats section under the map with a security pie chart

## Summary

Add a two-column section directly under the map. The left column is a hand-built inline SVG pie of how the plotted networks are secured, with a "default-looking SSID" slice that takes precedence over the security type. The right column is a placeholder that #13 fills with the category list. A pure classifier in a new plain script, `assets/stats.js`, is shared by both columns. `assets/map.js` hands the stats module the exact set of networks it plotted, so the pie total always equals the marker count.

## Requirements

- #12 acceptance: classifier test with exact counts and a 100% total, pie render test, empty and error states, 360 / 768 / 1280 px screenshots with no horizontal overflow, existing tests green.
- R1.3 (retro palette, Open in amber), R1.4 (no horizontal scroll at 360 px), R1.6 (no new third-party requests), R2.7 (load failure shows an error, never a broken chart).
- #14 security note: build SVG with `createElementNS`, set text with `textContent`, no inline `style` attributes (CSP `style-src 'self'`), no CSP change.
- #15 note: count the networks the map plots (valid coordinates, first record per BSSID), not `db.networks`.

## Key Technical Decisions

- **One global, `window.RWPStats`,** from `assets/stats.js`, loaded before `map.js`. It exposes `CATEGORIES`, `DEFAULT_SSID_PATTERNS`, `classify(net)`, `countCategories(nets)`, `percentages(counts)`, `render(nets)` and `fail(message)`. `map.js` calls `render` with its plotted list, and `fail` on every failure path (Leaflet missing, database failed). No second fetch.
- **Classifier order.** A non-blank SSID that matches a factory-name pattern is `default`. Otherwise the auth string decides. Anything the map colours as open (`isEncrypted` false: `[OPEN]`, `[ESS]`, empty) is `open`, so the amber slice matches the amber markers. Encrypted strings are looked up exactly after stripping brackets: `WEP`, `WPA_PSK`, `WPA_WPA2_PSK`, `WPA2_PSK`, `WPA2` (enterprise), `WPA2_WPA3_PSK`, `WPA3_PSK` / `WPA3`. Anything containing `EAP` or `ENTERPRISE` is enterprise, and any other encrypted string is `other`.
- **Factory-name patterns** are anchored at the start, case-insensitive, and require the factory id part (for example `NETGEAR` + 2 digits), so renamed networks such as "Frontier Speedy" are not counted. The list lives only in `stats.js` and is documented in `data/README.md`.
- **Percentages use the largest-remainder method** at one decimal, so the legend always adds up to exactly 100.0%.
- **Colours live in CSS.** Each category has a class `cat-<id>` that sets `--cat`. Slices use `fill: var(--cat)` and legend swatches use `background: var(--cat)`, so the JS never writes a style attribute.
- **A single-category pie is a full circle** (an arc cannot span 360°).
- **Zero-count categories are left out** of both the pie and the legend. Tiny slices (under 1%) still get a legend row.
- **Right column placeholder.** It has its heading and a "coming soon" line until #13 lands, so the two-column layout exists now.

## Implementation Units

### U1. Classifier and renderer (`assets/stats.js`)

**Files:** `assets/stats.js`, `index.html`, `assets/site.css`, `data/README.md`
**Approach:** Write a pure classifier and counting helpers, then the DOM renderer. The section starts with a "> loading…" status line. `render` replaces it with the pie (`svg role="img"`, `<title>`, and `aria-describedby` pointing at a visually hidden summary), the legend (`label  12.3%  (1,234)`), and the total. For zero networks it shows an empty-state line and no SVG. `fail` shows "> security breakdown unavailable" and no SVG. Layout: a CSS grid with two equal columns at 720 px and wider, one column below that.

### U2. Wire into `map.js`

**Files:** `assets/map.js`
**Approach:** Collect each plotted network in the marker loop. After the markers are added, call `RWPStats.render(plotted)` inside its own try/catch, so a stats bug never replaces the map's stats line with "database unavailable". Call `RWPStats.fail()` in the database catch and on the Leaflet-missing path.

### U3. Tests

**Files:** `tests/e2e/site.spec.js`, `tests/fixtures/networks-categories.json`
**Test scenarios:**
- The classifier (through `page.evaluate`) on the categories fixture: exact counts for every category, a hidden SSID on WPA2 lands in WPA2, a factory name on WPA2 lands in default, and the percentages sum to 100.0.
- Pattern table: factory names match and renamed look-alikes do not.
- Render with the categories fixture: the section is below the map, the slice count equals the number of non-zero categories, the legend text matches the computed percentages, the total equals the marker count (a duplicate BSSID and a bad-coordinate record are excluded), and the Open slice is amber.
- A single-category database renders one full-circle slice at 100.0%.
- Empty database: the empty-state line shows and there is no SVG. Database failure and Leaflet failure: the unavailable line shows and there is no SVG.
- The XSS fixture still sets no `window.__xss` after the stats render.
- The existing overflow tests at 360 / 768 / 1280 px cover the new section.

## Verification

`python3 -m unittest discover -s tests -v && npx playwright test` passes. The real database gives a default-looking share of about 3,000, per the issue's estimate. Screenshots at 360 / 768 / 1280 px go on the `pr-assets` branch.
