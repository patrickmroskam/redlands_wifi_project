---
title: "perf: Draw network markers on a canvas so ~18k networks stay smooth"
type: perf
status: active
date: 2026-09-17
issue: 11
---

# perf: Draw network markers on a canvas so ~18k networks stay smooth

## Summary

`assets/map.js` draws every network as an SVG `L.circleMarker`. The first backfill (#8) will publish about 18,152 networks, which means about 18k SVG nodes. Move the markers to a dedicated Leaflet canvas renderer. Build popup content only when a popup opens, and add all markers to the map in one step. Popups, colours, BSSID dedupe, and the #7 fence/auto-pan behaviour stay the same. The e2e suite now reads marker state through the `window.__rwp` test hook instead of `path.net-marker`, and it gains an 18k-network performance check.

## Problem Frame

A test run on 2026-09-17 used a 360×740 viewport, 6× CPU throttling, and 18k generated networks:

| Renderer | First render (goto → stats) | Pan/zoom p95 frame | DOM nodes |
|---|---|---|---|
| SVG (today) | 2151 ms | 700 ms | 18,076 |
| Canvas + lazy popups | 749 ms | 33 ms | 81 |

With SVG, the p95 frame is 700 ms, which is visible jank. The canvas numbers are smooth enough, so clustering is not needed (issue #11 treats clustering as optional).

## Requirements

- R2.1 / R1.4 (PRD): the map is usable at phone widths with the full database.
- R2.3 / R2.4: each marker has a popup with the network's details, and markers are coloured by encrypted or open.
- #11 acceptance: about 18k networks pan and zoom without jank at 360 px, stats are correct, and the existing e2e tests stay green.
- #7 constraint: `autopanstart`, `popupopen`, and `popupclose` still fire, and the corner-popup tests still pass.

## Key Technical Decisions

- **A dedicated `L.canvas` renderer for markers only.** The Redlands boundary stays SVG, because it is 2 paths and the `path.boundary` tests depend on it. A small `tolerance` makes taps easier on phones, and `padding` reduces redraws during a pan.
- **Lazy popup content.** `bindPopup` takes a function, so the `<dl>` is built only when a popup opens. Today 18k detached `<dl>` trees are built at load.
- **Markers go into one `L.layerGroup`, which is added once.** `window.__rwp.markers` stays as the test hook.
- **No clustering and no plugin.** The CSP is `'self'`-only and Leaflet is vendored, so any plugin would have to be vendored too. The measurements show it isn't needed.
- **Test hook.** Each marker keeps its kind (`encrypted`/`open`) in its options, and `window.__rwp` exposes it. SVG `className` does nothing on canvas, so the tests assert kind and `fillColor` through the hook. A real click uses the marker's container point.

## Implementation Units

### U1. Canvas renderer, lazy popups, single layer group

**Goal:** Render the markers on a canvas without changing what a visitor sees.
**Requirements:** R2.1, R2.3, R2.4, #7 constraint.
**Files:** `assets/map.js`, `tests/e2e/site.spec.js`
**Approach:** Create one canvas renderer next to the map. Pass it to each `circleMarker` and store the marker kind in the options. Bind the popup with a content function. Collect the markers in a layer group and add it after the loop. Leave the fence and popup handlers unchanged.
**Test scenarios:**
- The 3-network fixture gives 3 markers: 2 encrypted `#33ff66` and 1 open `#ffb000`, read through the hook.
- A real mouse click at the open marker's pixel opens its popup, which shows `hidden` and the BSSID.
- The duplicate fixture still gives 5 markers, and the first record for each BSSID wins. Popup content is resolved through the content function.
- The XSS fixture still renders every field as text after a real click.
- Edge fixture: 2 markers (1 encrypted, 1 open). Failure paths: 0 markers.
- Corner and phone popup tests are unchanged apart from the marker-count assertion: the popup stays inside the map, and the fence is restored.
- No `path.net-marker` elements exist, and the map has one `canvas` element.
**Verification:** The full e2e suite passes.

### U2. 18k performance regression test

**Goal:** Prevent a return to per-marker DOM nodes and catch a slow first render.
**Files:** `tests/e2e/site.spec.js`
**Approach:** At test time, generate a deterministic 18,000-network database inside the Redlands bbox and serve it through `page.route` (never `ingest/`). Use a 360 px viewport.
**Test scenarios:**
- The stats line reads `18,000 networks mapped` within a generous time budget, so CI runners don't flake.
- The hook reports 18,000 markers, and the counts per kind match the generator.
- The document has far fewer elements than markers (a DOM-size ceiling).
- A pan followed by a zoom in and out completes (`moveend`/`zoomend` fire) within the budget, and a real click on a generated marker opens its popup.
**Verification:** The test passes locally and in CI. With the SVG renderer restored it fails on the DOM ceiling.

## Scope Boundaries

- Keyboard access to individual markers is out of scope, since canvas markers are not focusable. A per-marker tab stop would not work at 18k anyway (noted on #11 by #7).
- The #29 popup-pan edge cases stay a separate issue.

## Risks

- Canvas hit-testing is a loop over every marker on each mouse move, throttled by Leaflet. The measurement above includes it, and it is acceptable.
- A timing-based assertion can flake in CI. Use generous budgets. The DOM-size ceiling is the structural guard.
