---
title: "feat: Retro polish and responsive QA pass"
type: feat
status: active
date: 2026-09-17
issue: 7
---

# feat: Retro polish and responsive QA pass

## Summary

Finish the retro terminal look and check it at phone, tablet, and desktop widths. The QA pass found one real bug: **map popups get cut off at the map edges.** On a 360 px phone, popups start 19–53 px above the top of the map, one is wider than the map, and they sit under the zoom buttons. This plan fixes that bug, themes the two Leaflet states that still use Leaflet's light defaults, adds a small pure-CSS "typing" effect to the banner prompt, and adds browser tests that check the issue's acceptance criteria.

## Problem Frame

Issue #7 asks for the CRT/terminal look, a dark Leaflet theme, a header and footer that work on phones, keyboard-accessible controls, and WCAG AA text contrast. It is accepted with screenshots at 360, 768, and 1280 px, no horizontal scrolling, readable popups on phones, and a banner that stays pure HTML/CSS. A comment on the issue adds `privacy.html` to the pass (PRD R1.3, R1.4, R2.3, R6.7).

The audit (Playwright on `tests/fixtures/networks-3.json`) found:
- Most of the theme is already built in `assets/site.css`: scanlines, glow, a blinking cursor, and the green and amber colors. Every text/background pair is at least 5.5:1, so contrast passes AA.
- **Popup clipping.** When a popup opens, Leaflet's `Popup._adjustPan` fires `autopanstart` and then calls `map.panBy`. But `setMaxBounds` registers a `moveend` handler (`_panInsideMaxBounds`) that pans the map straight back inside the fence. With the fence removed, auto-pan places every popup fully inside the map. On a tall phone screen the fence is shorter than the map view, so the map has no room to pan up or down.
- Leaflet's own CSS still wins over ours in two places. At minimum zoom, the zoom-out button is light grey (`.leaflet-bar a.leaflet-disabled`). The popup close button turns #585858 grey on hover and focus.

## Requirements

- R1.3 / R6.7: the retro palette is used everywhere, including Leaflet controls in every state.
- R1.4: no horizontal scrolling at 360, 768, or 1280 px on either page.
- R2.3 plus the issue's "popups readable on mobile": a popup opened at 360 px is fully inside the map and does not cover the zoom control.
- R2.2 stays true: the fence and the minimum zoom work as before whenever no popup is open.
- R1.2: the banner stays text. No image files are added.

## Key Technical Decisions

- **Loosen the fence only while a popup is open.** On `autopanstart`, widen `maxBounds` by the open popup's size in pixels plus the auto-pan padding, measured at the current zoom. On `popupclose`, restore the exact fence, which pans the map back inside. This keeps the extra panning room to about one popup's size, and only while a popup is open. Rejected alternatives:
  - A permanently larger fence would weaken R2.2, and the R2.2 test's north limit (34.12) leaves almost no margin.
  - A custom details panel would replace Leaflet popups and change R2.3's interaction.
  - Showing the popup below the marker is not supported by Leaflet popups.
- **Keep popups clear of the zoom control** with `autoPanPaddingTopLeft`. Leaflet's map pane is its own stacking context below the controls, so no z-index change can lift a popup above them.
- **Cap popup width with CSS** (`max-width` on `.leaflet-popup-content`, based on viewport width). Leaflet measures `offsetWidth` after CSS applies, so its layout and auto-pan use the capped width. No inline styles are added, so the CSP is unchanged.
- **Make the typing effect pure CSS** (`steps()` width animation on the decorative, `aria-hidden` prompt). It is turned off under `prefers-reduced-motion`.
- **Store PR screenshots on an orphan `pr-assets` branch**, never on `main`. Pages serves `main`, so screenshots there would ship with the site. The tests also attach screenshots to the Playwright report.

## Implementation Units

### U1. Popups stay fully inside the fenced map

**Goal:** A popup opened near any edge pans into view, and the fence comes back when the popup closes.
**Requirements:** R2.3, R2.2
**Dependencies:** none
**Files:** `assets/map.js`, `assets/site.css`, `tests/e2e/site.spec.js`
**Approach:**
- Add `autopanstart` and `popupclose` handlers to the map.
- Measure the popup element in the popup pane, and grow the fence's pixel bounds on every side at the current zoom.
- Bind popups with top-left padding that clears the zoom control.
- Add a CSS width cap on the popup content.
- Leave `fenceBounds` and `updateMinZoom` untouched.
**Test scenarios:**
- At 360 px, open each of the 3 fixture popups in turn. Each popup's rectangle is inside `#map` and does not overlap `.leaflet-control-zoom`.
- After the popup closes, `map.options.maxBounds` equals the original fence again, and the view is back inside it.
- At 360 px, the long-SSID popup is no wider than the map.
- The existing R2.2 fence and minimum-zoom test still passes.

### U2. Theme the remaining Leaflet states and finish the retro touches

**Goal:** Leaflet controls use the palette in every state. Add the typing effect on the prompt, `color-scheme: dark`, `::selection`, and a `theme-color` meta tag on both pages.
**Requirements:** R1.3, R6.7, R1.2
**Dependencies:** none
**Files:** `assets/site.css`, `index.html`, `privacy.html`, `tests/e2e/site.spec.js`
**Approach:**
- Write selectors that are more specific than Leaflet's for `.leaflet-disabled` and the close button's `:hover` and `:focus`.
- Add the typing animation to `.prompt`. Clip it, never wrap it, and switch it off under reduced motion.
**Test scenarios:**
- At minimum zoom, the disabled zoom-out button's background is the panel color, not #f4f4f4.
- The close button's color when focused is not grey (#585858).
- Under `reducedMotion: 'reduce'`, the prompt has no animation.
- The banner still contains no `img` or `svg`.

### U3. Responsive QA test with screenshots

**Goal:** Turn the issue's acceptance criteria into a test.
**Requirements:** R1.4
**Dependencies:** U1, U2
**Files:** `tests/e2e/site.spec.js`
**Approach:** Replace the partial overflow loop with a full matrix: both pages at 360, 768, and 1280 px. Assert no horizontal overflow and attach a full-page screenshot to the report.
**Test scenarios:** Six cases (two pages × three widths). Each has `scrollWidth <= clientWidth` and a screenshot attachment.

## Scope Boundaries

- No change to the fence size, the minimum-zoom rule, the tile source, or the CSP.
- Keyboard access to individual markers is out of scope. The map will hold about 18k SVG markers, which is far too many tab stops. #11 (canvas/clustering) owns how markers render. The zoom buttons, links, and keyboard panning on the map are already keyboard accessible.

### Deferred to Follow-Up Work
- Rendering many markers smoothly: #11. Stats columns: #12 and #13. Footer credit: #20.

## Assumptions

- The PR's screenshots use the 3-network fixture. `data/networks.json` is still empty because the backfill (#8) has not run.
