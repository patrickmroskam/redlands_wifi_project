// Browser smoke tests for the one-page site (PRD R1, R2, R8.2).
// Fixtures live in tests/fixtures/ — never in ingest/ (R8.3).
const { test, expect } = require('@playwright/test');
const path = require('path');

const FIXTURE_3 = path.join(__dirname, '..', 'fixtures', 'networks-3.json');
const FIXTURE_EDGE = path.join(__dirname, '..', 'fixtures', 'networks-edge.json');

test.beforeEach(async ({ page }) => {
  // Keep tests deterministic: never fetch map tiles (Leaflet itself still loads from cdnjs).
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

async function useFixture(page, file) {
  await page.route('**/data/networks.json', (route) =>
    route.fulfill({ path: file, contentType: 'application/json' }));
}

test('empty seed database: banner, bounded map, legend, zero stats, privacy link', async ({ page }) => {
  await page.goto('/index.html');

  const title = page.getByRole('heading', { level: 1 });
  await expect(title).toHaveText('Redlands Wifi Project');
  // R1.2: the banner is text, not an image.
  await expect(page.locator('header.banner img, header.banner svg')).toHaveCount(0);

  await expect(page.locator('#stats')).toContainText('0 networks mapped');
  await expect(page.locator('.legend')).toContainText('encrypted');
  await expect(page.locator('.legend')).toContainText('open');
  await expect(page.locator('path.boundary')).toHaveCount(2);
  await expect(page.locator('path.net-marker')).toHaveCount(0);
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

  await expect(page.locator('path.net-marker')).toHaveCount(3);
  await expect(page.locator('path.net-encrypted')).toHaveCount(2);
  await expect(page.locator('path.net-open')).toHaveCount(1);
  await expect(page.locator('path.net-encrypted').first()).toHaveAttribute('fill', '#33ff66');
  await expect(page.locator('path.net-open')).toHaveAttribute('fill', '#ffb000');
  await expect(page.locator('#stats')).toContainText('3 networks mapped');
  await expect(page.locator('#stats')).toContainText('2026-09-15 08:30 UTC');
});

test('popup shows network details and "hidden" for a blank SSID', async ({ page }) => {
  await useFixture(page, FIXTURE_3);
  await page.goto('/index.html');

  await page.locator('path.net-open').click();
  const popup = page.locator('.leaflet-popup-content');
  await expect(popup).toBeVisible();
  await expect(popup.locator('.ssid')).toHaveText('hidden');
  await expect(popup).toContainText('aa:bb:cc:00:00:03');
  await expect(popup).toContainText('[ESS]');
  await expect(popup).toContainText('Channel');
  await expect(popup).toContainText('2026-09-14 10:10:00');
});

test('SSIDs are rendered as text, never as HTML', async ({ page }) => {
  await useFixture(page, FIXTURE_3);
  await page.goto('/index.html');
  await expect(page.locator('path.net-marker')).toHaveCount(3);

  await page.evaluate(() => window.__rwp.markers[0].openPopup());
  const popup = page.locator('.leaflet-popup-content');
  await expect(popup.locator('.ssid')).toHaveText('Citrus<img src=x onerror="window.__xss=1">');
  await expect(popup.locator('img')).toHaveCount(0);
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
});

test('edge-case records: bad coordinates skipped, placeholders and fallbacks shown', async ({ page }) => {
  await useFixture(page, FIXTURE_EDGE);
  await page.goto('/index.html');

  // Only the RSN row and the sparse row have usable coordinates.
  await expect(page.locator('path.net-marker')).toHaveCount(2);
  await expect(page.locator('path.net-encrypted')).toHaveCount(1); // [RSN-SAE-CCMP]
  await expect(page.locator('path.net-open')).toHaveCount(1);      // no auth at all
  await expect(page.locator('#stats')).toHaveText('> 2 networks mapped · last updated never');

  await page.locator('path.net-open').click();
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
  await expect(page.locator('path.net-marker')).toHaveCount(0);
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
  await expect(page.locator('path.net-marker')).toHaveCount(3);
  expect(await page.evaluate(() => !!window.__rwp.map.options.maxBounds)).toBe(true);
});

test('map library failure shows an on-page error', async ({ page }) => {
  await page.route(/leaflet\.js$/, (route) => route.abort());
  await page.goto('/index.html');
  await expect(page.getByRole('alert')).toContainText('map library failed to load');
});

test('privacy page links back to the map', async ({ page }) => {
  await page.goto('/privacy.html');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Privacy policy');
  await expect(page.getByRole('link', { name: /back to the map/i })).toHaveAttribute('href', 'index.html');
});

test('site sets no cookies or storage (R1.6)', async ({ page, context }) => {
  await useFixture(page, FIXTURE_3);
  await page.goto('/index.html');
  await expect(page.locator('path.net-marker')).toHaveCount(3);
  expect(await context.cookies()).toEqual([]);
  expect(await page.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0);
});

for (const pagePath of ['/index.html', '/privacy.html']) {
  test(`no horizontal overflow at 360 px on ${pagePath} (R1.4)`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await useFixture(page, FIXTURE_3);
    await page.goto(pagePath);
    if (pagePath === '/index.html') await expect(page.locator('path.net-marker')).toHaveCount(3);
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
