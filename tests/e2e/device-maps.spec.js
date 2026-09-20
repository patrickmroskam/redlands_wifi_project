// Browser smoke tests for the Bluetooth and Flock camera maps.
// Both pages drive assets/map.js through window.RWPMapConfig, so these tests check the
// wiring each page owns: the right database, the right popup, and the same fence as the
// WiFi map. Fixtures live in tests/fixtures/ — never in ingest/ (R8.3).
const { test, expect } = require('@playwright/test');
const path = require('path');

const FIXTURE_BLE = path.join(__dirname, '..', 'fixtures', 'bluetooth-3.json');
const FIXTURE_FLOCK = path.join(__dirname, '..', 'fixtures', 'flock-2.json');
const EMPTY_DB = JSON.stringify({ updated_at: null, count: 0, devices: [] });

const PAGES = [
  { name: 'bluetooth', url: '/bluetooth.html', db: '**/data/bluetooth.json',
    fixture: FIXTURE_BLE, count: 3, kind: 'device', noun: 'device' },
  { name: 'flock', url: '/flock.html', db: '**/data/flock.json',
    fixture: FIXTURE_FLOCK, count: 2, kind: 'camera', noun: 'camera' },
];

test.beforeEach(async ({ page }) => {
  await page.route(/tile\.openstreetmap\.org/, (route) => route.abort());
  page.cspViolations = [];
  page.on('console', (msg) => {
    if (/Content Security Policy/i.test(msg.text())) page.cspViolations.push(msg.text());
  });
});

test.afterEach(async ({ page }) => {
  expect(page.cspViolations).toEqual([]);
});

async function markerCount(page) {
  return page.evaluate(() => window.__rwp.markers.length);
}

function readFence(page) {
  return page.evaluate(() => {
    const b = window.__rwp && window.__rwp.fence();
    return b ? { s: b.getSouth(), w: b.getWest(), n: b.getNorth(), e: b.getEast() } : null;
  });
}

for (const info of PAGES) {
  test.describe(info.name + ' map', () => {
    test('plots every record from its own database', async ({ page }) => {
      await page.route(info.db, (route) =>
        route.fulfill({ path: info.fixture, contentType: 'application/json' }));
      await page.goto(info.url);
      await expect.poll(() => markerCount(page)).toBe(info.count);
      const kinds = await page.evaluate(() => window.__rwp.markers.map((m) => m.options.kind));
      expect(kinds).toEqual(new Array(info.count).fill(info.kind));
      await expect(page.locator('#stats')).toContainText(info.count + ' ' + info.noun + 's mapped');
      await expect(page.locator('#error')).toBeHidden();
    });

    test('never reads the WiFi database', async ({ page }) => {
      let wifiRequested = false;
      await page.route('**/data/networks.json', (route) => {
        wifiRequested = true;
        return route.abort();
      });
      await page.route(info.db, (route) =>
        route.fulfill({ path: info.fixture, contentType: 'application/json' }));
      await page.goto(info.url);
      await expect.poll(() => markerCount(page)).toBe(info.count);
      expect(wifiRequested).toBe(false);
    });

    test('is fenced to the same area as the WiFi map', async ({ page }) => {
      // Compared against the WiFi map itself rather than hard-coded degrees, so the two
      // cannot drift apart when the boundary file is redrawn.
      await page.goto('/index.html');
      await expect.poll(() => readFence(page)).not.toBeNull();
      const wifiFence = await readFence(page);

      await page.route(info.db, (route) =>
        route.fulfill({ path: info.fixture, contentType: 'application/json' }));
      await page.goto(info.url);
      await expect.poll(() => markerCount(page)).toBe(info.count);
      expect(await readFence(page)).toEqual(wifiFence);
    });

    test('an empty database is an empty map, not an error', async ({ page }) => {
      await page.route(info.db, (route) =>
        route.fulfill({ contentType: 'application/json', body: EMPTY_DB }));
      await page.goto(info.url);
      await expect(page.locator('#stats')).toContainText('0 ' + info.noun + 's mapped');
      await expect(page.locator('#error')).toBeHidden();
      expect(await markerCount(page)).toBe(0);
    });

    test('a missing database reports an error instead of hanging', async ({ page }) => {
      await page.route(info.db, (route) => route.fulfill({ status: 404, body: 'nope' }));
      await page.goto(info.url);
      await expect(page.locator('#error')).toBeVisible();
      await expect(page.locator('#stats')).toContainText('database unavailable');
    });

    test('links to the other maps, the privacy policy and the source', async ({ page }) => {
      await page.goto(info.url);
      const footer = page.locator('footer');
      await expect(footer.getByRole('link', { name: 'Privacy policy & opt-out' })).toHaveAttribute('href', 'privacy.html');
      await expect(footer.getByRole('link', { name: 'Source' })).toHaveAttribute('href', /github\.com/);
      await expect(footer.getByRole('link', { name: 'WiFi map' })).toHaveAttribute('href', 'index.html');
    });
  });
}

test('a device name is shown as text, never as markup', async ({ page }) => {
  await page.route('**/data/bluetooth.json', (route) =>
    route.fulfill({ path: FIXTURE_BLE, contentType: 'application/json' }));
  await page.goto('/bluetooth.html');
  await expect.poll(() => markerCount(page)).toBe(3);
  await page.evaluate(() => window.__rwp.markers[2].openPopup());
  await expect(page.locator('.net-popup .ssid')).toHaveText('<img src=x onerror="window.__xss=1">');
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
});

test('a nameless Bluetooth device reads as unnamed', async ({ page }) => {
  await page.route('**/data/bluetooth.json', (route) =>
    route.fulfill({ path: FIXTURE_BLE, contentType: 'application/json' }));
  await page.goto('/bluetooth.html');
  await expect.poll(() => markerCount(page)).toBe(3);
  await page.evaluate(() => window.__rwp.markers[1].openPopup());
  await expect(page.locator('.net-popup .ssid')).toHaveText('unnamed');
  await expect(page.locator('.net-popup')).toContainText('84:70:d7:00:00:02');
  // Auth and channel are meaningless for BLE and are never published.
  await expect(page.locator('.net-popup')).not.toContainText('Auth');
  await expect(page.locator('.net-popup')).not.toContainText('Channel');
});

test('a camera popup names the rule that matched it', async ({ page }) => {
  await page.route('**/data/flock.json', (route) =>
    route.fulfill({ path: FIXTURE_FLOCK, contentType: 'application/json' }));
  await page.goto('/flock.html');
  await expect.poll(() => markerCount(page)).toBe(2);
  await page.evaluate(() => window.__rwp.markers[0].openPopup());
  await expect(page.locator('.net-popup')).toContainText('Matched by');
  await expect(page.locator('.net-popup')).toContainText('oui:a4:da:22');
});

test('the WiFi map still reads the WiFi database and keeps its own colours', async ({ page }) => {
  // Guards the shared map.js: the new pages configure it, and must not reconfigure it here.
  await page.goto('/index.html');
  await expect.poll(() => markerCount(page)).toBeGreaterThan(0);
  const kinds = await page.evaluate(() =>
    Array.from(new Set(window.__rwp.markers.map((m) => m.options.kind))).sort());
  expect(kinds.every((k) => k === 'encrypted' || k === 'open')).toBe(true);
  await expect(page.locator('#stats')).toContainText('networks mapped');
});

test('the WiFi map footer links to both device maps', async ({ page }) => {
  await page.goto('/index.html');
  const footer = page.locator('footer');
  await expect(footer.getByRole('link', { name: 'Bluetooth devices' })).toHaveAttribute('href', 'bluetooth.html');
  await expect(footer.getByRole('link', { name: 'Flock cameras' })).toHaveAttribute('href', 'flock.html');
  await expect(footer.locator('.credit')).toContainText('more secure internet');
});
