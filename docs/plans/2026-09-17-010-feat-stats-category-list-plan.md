---
title: "feat: Category list with counts beside the security pie"
type: feat
status: active
date: 2026-09-17
issue: 13
---

# feat: Category list with counts beside the security pie

**Target repo:** patrickmroskam/redlands_wifi_project · Issue #13 (part of #1, depends on #12 — merged in PR #32)

## Summary

Fill the right column of the "Network breakdown" section (`#list-col`) with a table of the same numbers the #12 pie shows: one row per category (zero rows included), a default-looking security split, a hidden-SSID note, and a total. It is rendered by the same `RWPStats.render(nets)` / `fail()` calls, so the pie and the list always share data and states.

## Problem Frame

The pie gives proportions but no counts, and it folds default-named networks into one slice. The owner wants the actual numbers next to it, and wants to see how the default-named networks are secured.

## Requirements

- R1. One row per category in `CATEGORIES` order, each with a swatch (`.cat-<id>`), label, count (`en-US` thousands separators), and percentage (one decimal). Zero-count categories show `0` and `0.0%`.
- R2. Percentages come from `percentages()` and so match the pie legend exactly.
- R3. Indented sub-rows under Default-looking give the security split of default-looking networks.
- R4. A note gives the number of hidden SSIDs (blank or whitespace name). It is informational; those networks are already counted.
- R5. The total row equals the map's plotted count and the sum of the rows.
- R6. Semantic, screen-reader-readable markup; retro mono theme; no horizontal scroll at 360 px; stacked on phones, side by side at 720 px and up (already true for the grid).
- R7. Same load, same states: empty (0 networks) and error/unavailable, including stats.js failing to load. Text only via `textContent`; no inline styles (CSP `style-src 'self'`).

## Key Technical Decisions

- **`securityCategory(net)` is exported and `classify()` becomes "default if factory name, else `securityCategory`".** One source for the auth mapping (review note on #13).
- **Markup is a `<table>`** with a caption, `thead` (Category / Networks / Share), row headers (`th scope="row"`), and a `tfoot` total. Tables give screen readers the row/column pairing for free.
- **Sub-rows** are `tr.sub-row` right after the Default-looking row. Their label is "on WPA2" etc. (row header text), their count is the split count, and their Share cell is empty, so the Share column still sums to 100.0. Only non-zero splits are listed, in `CATEGORIES` order. With zero default-looking networks there are no sub-rows.
- **List status line** `#list-status` mirrors the pie status: "> no networks mapped yet" (empty), "> category list unavailable" (error). It is not an `aria-live` region; the pie's status is already live and announces the load, so two live regions would double-announce.
- **The table is built fresh on each render** in a wrapper `#category-list` (hidden until rendered), the same clear-and-rebuild pattern as `#security-chart`.
- **The hidden note** is always shown when the table is (including "0 hidden networks"), so its presence is stable.
- **The map.js fallback** for a missing stats.js also sets `#list-status` to unavailable.

## Implementation Units

### U1. Classifier split and list renderer

**Goal:** export `securityCategory`, render and clear the list from `render()` / `fail()`.
**Requirements:** R1–R5, R7
**Dependencies:** none
**Files:** `assets/stats.js`, `index.html`, `assets/site.css`, `assets/map.js`
**Approach:** add `#list-status` + `#category-list[hidden]` to `#list-col`, replacing the placeholder. In stats.js, compute counts, percentages, the default split, and the hidden count once in `render`, then build the table with `createElement` + `textContent`. `fail()` and the empty path clear both columns. CSS: `.category-list[hidden]{display:none}`, table width 100%, tabular numerals, right-aligned numbers with `nowrap`, the label cell may wrap, the sub-row label indented, swatch reusing `.pie-swatch`.
**Patterns to follow:** the pie legend builder and `clear()` / `setStatus()` in `assets/stats.js`.
**Test scenarios:** see U2.
**Verification:** the list renders on the fixture, matches the legend, and is empty/unavailable in the same cases as the pie.

### U2. Playwright coverage

**Goal:** lock the behaviour in.
**Requirements:** R1–R7
**Dependencies:** U1
**Files:** `tests/e2e/site.spec.js`
**Test scenarios:**
- Categories fixture (18 plotted): every row label, count, and share matches `CATEGORY_LEGEND` (all 10 rows present). Sub-rows read "on Open 1" and "on WPA2 2" in order. The hidden note says 2. The total row shows 18 and 100.0%, equals the `#stats` count, and equals the sum of the row counts. The shares sum to 1000 tenths. The table has a caption and column headers.
- Agreement: each list share equals the pie legend percentage for the same category.
- Zero rows: a single-category database (existing two-open test) lists all 10 rows, 9 of them `0` / `0.0%`, and no sub-rows. The 75/25 database shows no default sub-rows.
- Thousands separators: the 18k generated-data test (or a lighter generated set) shows a count formatted with a comma.
- Empty seed: the list says "> no networks mapped yet" and no table.
- Error states (load failure, malformed, Leaflet failure, stats.js missing, renderer throws): the list says unavailable and no table.
- XSS fixture: the list shows Other 1, no payload elements, hidden 0.
- The swatch colour equals the pie slice colour per category.
- Existing overflow tests at 360/768/1280 keep passing with the list present (assert the table is visible there).
**Verification:** full `ci_command` green.

### U3. Docs

**Files:** `data/README.md`
**Approach:** one short paragraph noting that the list column shows the same categories with counts, the default-looking split, and the hidden count.
**Test expectation:** none — docs only.

## Scope Boundaries

- No new data fetch, no classifier pattern changes, no CSP change.
- The PRD requirement for the breakdown waits for ratification (as noted on #12).

## Assumptions

- Sub-row wording "on <security>" follows the issue's example; the share cell stays blank for sub-rows.
