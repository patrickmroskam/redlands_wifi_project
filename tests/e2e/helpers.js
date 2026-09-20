// Shared setup and helpers for the site's e2e specs (PRD R1, R2, R8.2).
// Fixtures live in tests/fixtures/ — never in ingest/ (R8.3).
//
// site.spec.js was split into focused specs (#34); anything used by more than one of them
// lives here, and anything used by exactly one stays in that spec.
const { test, expect } = require('@playwright/test');
const path = require('path');

const FIXTURE_3 = path.join(__dirname, '..', 'fixtures', 'networks-3.json');
const FIXTURE_EDGE = path.join(__dirname, '..', 'fixtures', 'networks-edge.json');
const FIXTURE_XSS = path.join(__dirname, '..', 'fixtures', 'networks-xss.json');
const FIXTURE_DUP = path.join(__dirname, '..', 'fixtures', 'networks-dup.json');
const FIXTURE_CORNERS = path.join(__dirname, '..', 'fixtures', 'networks-corners.json');
const FIXTURE_EMPTY = path.join(__dirname, '..', 'fixtures', 'networks-empty.json');
const FIXTURE_CATEGORIES = path.join(__dirname, '..', 'fixtures', 'networks-categories.json');

// Call this at the top of every spec file. These hooks are deliberately NOT registered at
// this module's top level: Node caches a module after its first require, so top-level
// test.beforeEach/afterEach here would run once and attach to whichever spec file happened
// to require helpers.js first — silently leaving every other spec without the CSP guard.
// A function re-runs per requiring file, so the guard really does apply to every spec (#34).
function installHooks() {
  test.beforeEach(async ({ page }) => {
    // Keep tests deterministic: never fetch map tiles (Leaflet is vendored under assets/).
    await page.route(/tile\.openstreetmap\.org/, (route) => route.abort());
    // Any Content-Security-Policy violation fails the test.
    page.cspViolations = [];
    page.on('console', (msg) => {
      if (/Content Security Policy/i.test(msg.text())) page.cspViolations.push(msg.text());
    });
  });

  test.afterEach(async ({ page }) => {
    expect(page.cspViolations).toEqual([]);
  });
}

async function useFixture(page, file) {
  await page.route('**/data/networks.json', (route) =>
    route.fulfill({ path: file, contentType: 'application/json' }));
}

// Markers are drawn on one canvas (#11), so there is no element per marker: tests read them
// through the page's test hook. Resolves to the kind of each marker, in draw order.
function markerKinds(page) {
  return page.evaluate(() => window.__rwp.markers.map((m) => m.options.kind));
}

async function expectMarkers(page, count) {
  await expect.poll(() => page.evaluate(() => window.__rwp.markers.length)).toBe(count);
  // Every marker is on the map, and none of them is a DOM element of its own.
  expect(await page.evaluate(() => window.__rwp.markers.every((m) => window.__rwp.map.hasLayer(m)))).toBe(true);
  await expect(page.locator('#map .leaflet-overlay-pane path:not(.boundary)')).toHaveCount(0);
}

// Viewport coordinates of marker n's centre, offset by (dx, dy) CSS pixels. The point must be on the
// markers canvas (not under a control), so a click there is a real click on the map.
async function markerPoint(page, n, dx = 0, dy = 0) {
  const point = await page.evaluate(([i, ox, oy]) => {
    const { map, markers } = window.__rwp;
    const p = map.latLngToContainerPoint(markers[i].getLatLng());
    const box = map.getContainer().getBoundingClientRect();
    const x = box.left + p.x + ox;
    const y = box.top + p.y + oy;
    const hit = document.elementFromPoint(x, y);
    return { x, y, onCanvas: !!hit && hit.tagName === 'CANVAS' && !!hit.closest('.leaflet-overlay-pane') };
  }, [n, dx, dy]);
  expect(point.onCanvas, `marker ${n} is not clickable at its pixel`).toBe(true);
  return point;
}

// A real mouse click on the canvas at marker n's pixel.
async function clickMarker(page, n, dx = 0, dy = 0) {
  const { x, y } = await markerPoint(page, n, dx, dy);
  await page.mouse.click(x, y);
}

// The cells of a category list row (#13): name, count, share.
function listRow(page, category, kind = 'cat-row') {
  return page.locator(`#category-table tr.${kind}[data-category="${category}"]`).locator('th, td');
}

module.exports = {
  FIXTURE_3, FIXTURE_EDGE, FIXTURE_XSS, FIXTURE_DUP, FIXTURE_CORNERS, FIXTURE_EMPTY,
  FIXTURE_CATEGORIES,
  installHooks, useFixture, markerKinds, expectMarkers, markerPoint, clickMarker, listRow,
};
