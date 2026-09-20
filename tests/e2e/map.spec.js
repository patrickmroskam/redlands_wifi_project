// Map rendering and data-error e2e tests: markers, popups, and the on-page errors the
// page shows when the database, the boundary or Leaflet itself fails to load (R2.7).
const { test, expect } = require('@playwright/test');
const {
  installHooks, FIXTURE_3, FIXTURE_EDGE, FIXTURE_DUP, FIXTURE_EMPTY, useFixture, markerKinds,
  expectMarkers, clickMarker
} = require('./helpers');

installHooks();

// The colour actually drawn on the markers canvas at each marker's centre, as [r, g, b, a].
function drawnColors(page) {
  return page.evaluate(() => {
    const { map, markers } = window.__rwp;
    const canvas = map.getContainer().querySelector('.leaflet-overlay-pane canvas');
    const box = canvas.getBoundingClientRect();
    const mapBox = map.getContainer().getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    return markers.map((m) => {
      const p = map.latLngToContainerPoint(m.getLatLng());
      const x = Math.round((mapBox.left + p.x - box.left) * canvas.width / box.width);
      const y = Math.round((mapBox.top + p.y - box.top) * canvas.height / box.height);
      return Array.from(ctx.getImageData(x, y, 1, 1).data);
    });
  });
}

function nearColor(actual, hex) {
  const want = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return want.every((c, i) => Math.abs(actual[i] - c) <= 4) && actual[3] > 200;
}

async function clickFirstMarkerOfKind(page, kind) {
  await expect.poll(() => page.evaluate(() => window.__rwp.markers.length)).toBeGreaterThan(0);
  const n = (await markerKinds(page)).indexOf(kind);
  expect(n).toBeGreaterThanOrEqual(0);
  await clickMarker(page, n);
}

test('empty database: banner, bounded map, legend, zero stats, privacy link', async ({ page }) => {
  // The committed database is real data since the backfill (#8), so the empty case uses a fixture.
  await useFixture(page, FIXTURE_EMPTY);
  await page.goto('/index.html');

  const title = page.getByRole('heading', { level: 1 });
  await expect(title).toHaveText('Redlands Wifi Project');
  // R1.2: the banner is text, not an image.
  await expect(page.locator('header.banner img, header.banner svg')).toHaveCount(0);

  await expect(page.locator('#stats')).toContainText('0 networks mapped');
  // #12: the breakdown shows an empty state, not an empty circle.
  await expect(page.locator('#security-status')).toHaveText('> no networks mapped yet');
  await expect(page.locator('#security-chart')).toHaveCSS('display', 'none');
  await expect(page.locator('#security-status')).not.toHaveClass(/visually-hidden/);
  await expect(page.locator('svg.pie')).toHaveCount(0);
  // #13: so does the category list.
  await expect(page.locator('#list-status')).toHaveText('> no networks mapped yet');
  await expect(page.locator('#category-list')).toHaveCSS('display', 'none');
  await expect(page.locator('#category-table')).toHaveCount(0);
  await expect(page.locator('.legend')).toContainText('encrypted');
  await expect(page.locator('.legend')).toContainText('open');
  await expect(page.locator('path.boundary')).toHaveCount(2);
  await expectMarkers(page, 0);
  await expect(page.locator('#error')).toBeHidden();

  const privacy = page.getByRole('link', { name: /privacy/i });
  await expect(privacy).toBeVisible();
  await expect(privacy).toHaveAttribute('href', 'privacy.html');

  // R2.2: panning and zooming are fenced to the Redlands bbox.
  const fence = await page.evaluate(() => {
    const m = window.__rwp.map;
    const b = m.options.maxBounds;
    return { hasBounds: !!b, minZoom: m.getMinZoom(), center: m.getCenter(),
      south: b && b.getSouth(), north: b && b.getNorth(), west: b && b.getWest(), east: b && b.getEast() };
  });
  expect(fence.hasBounds).toBe(true);
  expect(fence.minZoom).toBeGreaterThan(8);
  expect(fence.south).toBeGreaterThan(33.9);
  expect(fence.north).toBeLessThan(34.12);
  expect(fence.west).toBeGreaterThan(-117.28);
  expect(fence.east).toBeLessThan(-117.0);

  // The zoom-out limit follows the viewport size.
  await page.setViewportSize({ width: 360, height: 740 });
  await expect.poll(() => page.evaluate(() => window.__rwp.map.getMinZoom())).toBeLessThan(fence.minZoom);
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect.poll(() => page.evaluate(() => window.__rwp.map.getMinZoom())).toBe(fence.minZoom);

  // The user cannot zoom out past the fence.
  await page.evaluate(() => window.__rwp.map.setZoom(3, { animate: false }));
  expect(await page.evaluate(() => window.__rwp.map.getZoom())).toBe(fence.minZoom);
});

test('fixture database: one colored marker per network', async ({ page }) => {
  await useFixture(page, FIXTURE_3);
  await page.goto('/index.html');

  await expectMarkers(page, 3);
  expect(await markerKinds(page)).toEqual(['encrypted', 'encrypted', 'open']);
  // What is painted, not just what was asked for.
  const expected = ['#33ff66', '#33ff66', '#ffb000'];
  await expect.poll(async () => (await drawnColors(page)).map((c, i) => nearColor(c, expected[i])))
    .toEqual([true, true, true]);
  await expect(page.locator('#map .leaflet-overlay-pane canvas')).toHaveCount(1);
  await expect(page.locator('#stats')).toContainText('3 networks mapped');
  await expect(page.locator('#stats')).toContainText('2026-09-15 08:30 UTC');
});

test('duplicate BSSIDs in the database render one marker per network (#15)', async ({ page }) => {
  const warnings = [];
  page.on('console', (msg) => { if (msg.type() === 'warning') warnings.push(msg.text()); });
  await useFixture(page, FIXTURE_DUP);
  await page.goto('/index.html');

  // Seven records: two spellings of ...:21, two of ...:22, a mesh sibling ...:23 (a distinct network),
  // and two records with no BSSID, which are still shown and never merged with each other.
  await expect(page.locator('#stats')).toContainText('5 networks mapped');
  await expectMarkers(page, 5);
  // The first record of each BSSID wins; the later (open) copies are never drawn.
  expect(await markerKinds(page)).not.toContain('open');
  const bssids = [];
  for (let i = 0; i < 5; i++) {
    await page.evaluate((n) => window.__rwp.markers[n].openPopup(), i);
    bssids.push(await page.locator('.leaflet-popup:last-child .leaflet-popup-content dd').nth(1).textContent());
  }
  // Popups are built when they open, never all up front (18k of them would cost memory).
  await page.evaluate(() => window.__rwp.map.closePopup());
  expect(await page.evaluate(() => window.__rwp.markers.filter((m) =>
    m.getPopup().getContent() instanceof Node).length)).toBe(0);
  expect(bssids).toEqual(['aa:bb:cc:00:00:21', 'aa:bb:cc:00:00:22', 'aa:bb:cc:00:00:23', '—', '—']);
  expect(warnings).toContain('Skipped 2 duplicate network record(s) (same BSSID).');
});

test('popup shows network details and "hidden" for a blank SSID', async ({ page }) => {
  await useFixture(page, FIXTURE_3);
  await page.goto('/index.html');

  await clickFirstMarkerOfKind(page, 'open');
  const popup = page.locator('.leaflet-popup-content');
  await expect(popup).toBeVisible();
  await expect(popup.locator('.ssid')).toHaveText('hidden');
  await expect(popup).toContainText('aa:bb:cc:00:00:03');
  await expect(popup).toContainText('[ESS]');
  await expect(popup).toContainText('Channel');
  await expect(popup).toContainText('2026-09-14 10:10:00');
});

test('edge-case records: bad coordinates skipped, placeholders and fallbacks shown', async ({ page }) => {
  await useFixture(page, FIXTURE_EDGE);
  await page.goto('/index.html');

  // Only the RSN row and the sparse row have usable coordinates.
  await expectMarkers(page, 2);
  expect((await markerKinds(page)).sort()).toEqual(['encrypted', 'open']); // [RSN-SAE-CCMP]; no auth at all
  await expect(page.locator('#stats')).toHaveText('> 2 networks mapped · last updated never');

  await clickFirstMarkerOfKind(page, 'open');
  const popup = page.locator('.leaflet-popup-content');
  await expect(popup.locator('.ssid')).toHaveText('hidden');
  await expect(popup).toContainText('unknown');
  await expect(popup.locator('dd')).toHaveText(['hidden', 'aa:bb:cc:00:00:11', 'unknown', '—', '—']);
});

for (const [raw, shown] of [
  ['2026-09-15 08:30:00', '2026-09-15 08:30 UTC'],
  ['2026-09-15T08:30:00-07:00', '2026-09-15 15:30 UTC'],
  ['not a date', 'not a date'],
]) {
  test(`updated_at "${raw}" renders as "${shown}"`, async ({ page }) => {
    await page.route('**/data/networks.json', (route) =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify({ updated_at: raw, networks: [] }) }));
    await page.goto('/index.html');
    await expect(page.locator('#stats')).toHaveText(`> 0 networks mapped · last updated ${shown}`);
  });
}

test('database load failure shows an on-page error (R2.7)', async ({ page }) => {
  await page.route('**/data/networks.json', (route) => route.fulfill({ status: 500, body: 'nope' }));
  await page.goto('/index.html');

  const alert = page.getByRole('alert');
  await expect(alert).toBeVisible();
  await expect(alert).toContainText('Could not load the network database');
  await expect(page.locator('#stats')).toContainText('database unavailable');
  await expectMarkers(page, 0);
  // The fenced map is still usable.
  await expect(page.locator('path.boundary')).toHaveCount(2);
});

test('malformed database shows an on-page error', async ({ page }) => {
  await page.route('**/data/networks.json', (route) =>
    route.fulfill({ contentType: 'application/json', body: '{"networks": "oops"}' }));
  await page.goto('/index.html');
  await expect(page.getByRole('alert')).toContainText('not in the expected format');
});

test('boundary load failure still fences the map and reports the error', async ({ page }) => {
  await page.route('**/data/redlands-boundary.geojson', (route) => route.fulfill({ status: 404, body: '' }));
  await useFixture(page, FIXTURE_3);
  await page.goto('/index.html');

  await expect(page.getByRole('alert')).toContainText('Redlands boundary');
  await expectMarkers(page, 3);
  expect(await page.evaluate(() => !!window.__rwp.map.options.maxBounds)).toBe(true);
});

test('map library failure shows an on-page error', async ({ page }) => {
  await page.route(/leaflet\.js$/, (route) => route.abort());
  await page.goto('/index.html');
  await expect(page.getByRole('alert')).toContainText('map library failed to load');
});

test('banner prompt types in, and holds still for reduced motion (#7)', async ({ page }) => {
  await page.goto('/index.html');
  await expect(page.locator('.prompt')).toHaveCSS('animation-name', 'type-in');
  await expect(page.locator('.cursor')).toHaveCSS('animation-name', 'blink');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/privacy.html');
  await expect(page.locator('.prompt')).toHaveCSS('animation-name', 'none');
  await expect(page.locator('.cursor')).toHaveCSS('animation-name', 'none');
  await expect(page.locator('header.banner img, header.banner svg')).toHaveCount(0);
});
