// Browser smoke tests for the one-page site (PRD R1, R2, R8.2).
// Fixtures live in tests/fixtures/ — never in ingest/ (R8.3).
const { test, expect } = require('@playwright/test');
const path = require('path');

const FIXTURE_3 = path.join(__dirname, '..', 'fixtures', 'networks-3.json');
const FIXTURE_EDGE = path.join(__dirname, '..', 'fixtures', 'networks-edge.json');
const FIXTURE_XSS = path.join(__dirname, '..', 'fixtures', 'networks-xss.json');
const FIXTURE_DUP = path.join(__dirname, '..', 'fixtures', 'networks-dup.json');
const FIXTURE_CORNERS = path.join(__dirname, '..', 'fixtures', 'networks-corners.json');
const FIXTURE_EMPTY = path.join(__dirname, '..', 'fixtures', 'networks-empty.json');
const FIXTURE_CATEGORIES = path.join(__dirname, '..', 'fixtures', 'networks-categories.json');

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

test('SSIDs are rendered as text, never as HTML', async ({ page }) => {
  await useFixture(page, FIXTURE_3);
  await page.goto('/index.html');
  await expectMarkers(page, 3);

  await page.evaluate(() => window.__rwp.markers[0].openPopup());
  const popup = page.locator('.leaflet-popup-content');
  await expect(popup.locator('.ssid')).toHaveText('Citrus<img src=x onerror="window.__xss=1">');
  await expect(popup.locator('img')).toHaveCount(0);
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
});

// Security (#14): every field that reaches the page is rendered as text.
test('every popup field and the stats line render HTML payloads as text', async ({ page }) => {
  await useFixture(page, FIXTURE_XSS);
  await page.goto('/index.html');
  await expectMarkers(page, 1);

  // updated_at is not a date, so the stats line echoes it verbatim — as text.
  await expect(page.locator('#stats')).toHaveText(
    '> 1 network mapped · last updated <img src=x onerror="window.__xss=\'updated_at\'">');
  await expect(page.locator('#stats *')).toHaveCount(0);
  // The breakdown classifies the payload network without rendering any of it (#12).
  await expect(page.locator('#security-legend li')).toHaveText(['Other100.0% (1)']);
  // …and so does the category list (#13): only counts, never the payload.
  await expect(listRow(page, 'other')).toHaveText(['Other', '1', '100.0%']);
  await expect(page.locator('#category-table .sub-row')).toHaveCount(0);
  await expect(page.locator('#category-list .hidden-note')).toHaveText(
    '> 0 hidden networks (blank name), counted under their security type');

  await clickMarker(page, 0);
  const popup = page.locator('.leaflet-popup-content');
  await expect(popup.locator('dd')).toHaveText([
    "<script>window.__xss='ssid'</script>",
    '<img src=x onerror="window.__xss=\'bssid\'">',
    '[WPA2]<svg onload="window.__xss=\'auth\'">',
    '<b onmouseover="window.__xss=\'channel\'">6</b>',
    '<iframe srcdoc="<script>parent.__xss=\'first_seen\'</script>"></iframe>',
  ]);
  await expect(popup.locator('dd *')).toHaveCount(0);
  // Nothing from the payloads became an element anywhere in the document.
  await expect(page.locator('img[src="x"], iframe, b, [onerror], [onload], [onmouseover]')).toHaveCount(0);
  await expect(page.locator('script:not([src])')).toHaveCount(0);
  await popup.locator('dd').nth(3).hover();
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
});

test('a database parse error quoting HTML is shown as text', async ({ page }) => {
  await page.route('**/data/networks.json', (route) =>
    route.fulfill({ contentType: 'application/json', body: '<img src=x onerror="window.__xss=1">' }));
  await page.goto('/index.html');
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Could not load the network database');
  // The browser's parse error quotes the body; it must arrive as literal text.
  await expect(alert).toContainText('<img');
  await expect(alert.locator('*:not(p)')).toHaveCount(0);
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
});

// Security breakdown under the map (#12).
const CATEGORY_COUNTS = {
  default: 3, open: 3, wep: 1, wpa: 1, 'wpa-wpa2': 1, wpa2: 3,
  'wpa2-enterprise': 2, 'wpa2-wpa3': 1, wpa3: 2, other: 1,
};
// 18 networks, rounded by largest remainder so the column adds up to exactly 100.0.
const CATEGORY_LEGEND = [
  ['Default-looking', '16.7% (3)'],
  ['Open', '16.7% (3)'],
  ['WEP', '5.6% (1)'],
  ['WPA', '5.6% (1)'],
  ['WPA/WPA2', '5.5% (1)'],
  ['WPA2', '16.7% (3)'],
  ['WPA2 Enterprise', '11.1% (2)'],
  ['WPA2/WPA3', '5.5% (1)'],
  ['WPA3', '11.1% (2)'],
  ['Other', '5.5% (1)'],
];

test('the classifier puts every network in exactly one category (#12)', async ({ page }) => {
  await page.goto('/index.html');
  const fixture = require(FIXTURE_CATEGORIES);
  // The first 18 records are the ones the map plots (the last two are a duplicate BSSID and bad coordinates).
  const result = await page.evaluate((nets) => {
    const S = window.RWPStats;
    const counts = S.countCategories(nets);
    const pct = S.percentages(counts);
    return {
      counts,
      byName: Object.fromEntries(nets.map((n) => [n.bssid, S.classify(n)])),
      tenths: Object.values(pct).reduce((sum, p) => sum + Math.round(p * 10), 0),
      categories: S.CATEGORIES.map((c) => c.id),
    };
  }, fixture.networks.slice(0, 18));
  expect(result.counts).toEqual(CATEGORY_COUNTS);
  expect(Object.keys(result.counts)).toEqual(result.categories);
  expect(result.tenths).toBe(1000);
  expect(result.byName['aa:bb:cc:00:01:01']).toBe('default'); // factory name on WPA2 wins over WPA2
  expect(result.byName['aa:bb:cc:00:01:02']).toBe('default'); // factory name on an open network
  expect(result.byName['aa:bb:cc:00:01:04']).toBe('wpa2'); // hidden SSID falls through to its auth
  expect(result.byName['aa:bb:cc:00:01:05']).toBe('wpa2'); // renamed "Frontier Speedy" is not default
  expect(result.byName['aa:bb:cc:00:01:08']).toBe('open'); // hidden and no auth
  expect(result.byName['aa:bb:cc:00:01:09']).toBe('open'); // [ESS] is amber on the map, so Open here
  expect(result.byName['aa:bb:cc:00:01:0e']).toBe('wpa2-enterprise'); // EAP
  expect(result.byName['aa:bb:cc:00:01:12']).toBe('other'); // encrypted, but not a Marauder string

  // Rounding always sums to 100.0, even for awkward splits; no networks gives no percentages.
  const sums = await page.evaluate(() => {
    const S = window.RWPStats;
    const splits = [{ open: 1, wpa2: 1, wpa3: 1 }, { default: 1, open: 2, wep: 3, wpa: 4, wpa2: 97 }, { wpa2: 7 }];
    return {
      sums: splits.map((c) => Object.values(S.percentages(c)).reduce((sum, p) => sum + Math.round(p * 10), 0)),
      thirds: S.percentages({ open: 1, wpa2: 1, wpa3: 1 }),
      empty: S.percentages({}),
    };
  });
  expect(sums.sums).toEqual([1000, 1000, 1000]);
  expect([sums.thirds.open, sums.thirds.wpa2, sums.thirds.wpa3]).toEqual([33.4, 33.3, 33.3]);
  expect(sums.empty).toEqual({});
});

test('factory SSID patterns match defaults and skip renamed look-alikes (#12)', async ({ page }) => {
  await page.goto('/index.html');
  const defaults = [
    'SpectrumSetup-A1', 'MySpectrumWiFi5c-2G', 'Spectrum1261', 'Frontier0000', 'ATT-WIFI-2437', 'ATT6C8NwJ4',
    'ATT7YYC53e_EXT', 'ORBI12-IoT', 'ASUS-2.4G-ext', 'ASUS_C0_2G_Guest', 'ASUS_Guest1',
    'CenturyLink1234', 'TMOBILE-082B_EXT', 'Verizon-1E06', 'Verizon_7XSJ9T', 'Verizon-MiFi8800L-93D0',
    'NETGEAR', 'NETGEAR06', 'NETGEAR06-5G', 'netgear42_EXT', 'NETGEAR-Guest', 'ORBI', 'ORBI12-Guest',
    'TP-Link_1A2B', 'TP-LINK_1B8B_5G', 'TP-LINK_785058', 'Linksys04357-guest', 'DIRECT-01-HP M203 LaserJet',
    'dlink', 'dlink-610E', 'ASUS', 'ASUS_5G', 'ASUS_9C28', 'ASUS22', 'Tenda_22F7F0', 'xfinitywifi', 'XFSETUP-1A2B',
  ];
  const renamed = [
    '', '   ', 'Spectrum sucks', 'SpectrumShade', 'Frontier Speedy', 'Frontier', 'ATTIC', 'Attorneys',
    'ATT4WIFI', 'Verizon-My hotspot', 'NETGEAR-Rivera 2G', 'ORBITAL', 'TP-LINK_IoT', 'TP-LINK_Power Strip_2601',
    'Linksys Extender Setup', 'ASUSTek Lab',
    'ORBI88benandnatalia', 'ORBI88smith-IoT', 'Asus Wifi', 'ASUS_MD', 'ASUS_50 NEW', 'ATT6C8NwJ4_home', 'Tenda', 'xfinitywifi2', 'Redlands Internet', 'MyDIRECT-TV',
  ];
  const results = await page.evaluate(([yes, no]) => {
    const is = (ssid) => window.RWPStats.classify({ ssid, auth: '[WPA2_PSK]' }) === 'default';
    return { missed: yes.filter((s) => !is(s)), wrong: no.filter(is) };
  }, [defaults, renamed]);
  expect(results).toEqual({ missed: [], wrong: [] });
});

test('the security pie sits under the map and matches the plotted networks (#12)', async ({ page }) => {
  await useFixture(page, FIXTURE_CATEGORIES);
  await page.goto('/index.html');
  await expectMarkers(page, 18);

  const section = page.locator('section.breakdown');
  await expect(section.getByRole('heading', { level: 2 })).toHaveText('Network breakdown');
  const [mapBox, sectionBox] = [await page.locator('.map-frame').boundingBox(), await section.boundingBox()];
  expect(sectionBox.y).toBeGreaterThanOrEqual(mapBox.y + mapBox.height);

  const pie = page.getByRole('img', { name: /how the 18 mapped networks are secured/ });
  await expect(pie).toBeVisible();
  // Still announced to screen readers, but not shown.
  await expect(page.locator('#security-status')).toHaveText('> security breakdown loaded: 18 networks classified');
  await expect(page.locator('#security-status')).toHaveClass(/visually-hidden/);
  await expect(page.locator('#security-status')).toHaveAttribute('aria-live', 'polite');
  await expect(pie.locator('.slice')).toHaveCount(10);
  // A duplicate BSSID and a record with bad coordinates are not on the map, so they are not counted.
  await expect(page.locator('.pie-total')).toHaveText('> 18 networks classified');

  const legend = page.locator('#security-legend li');
  await expect(legend).toHaveCount(CATEGORY_LEGEND.length);
  await expect(legend.locator('.pie-label')).toHaveText(CATEGORY_LEGEND.map(([label]) => label));
  await expect(legend.locator('.pie-value')).toHaveText(CATEGORY_LEGEND.map(([, value]) => value));
  const total = (await legend.locator('.pie-value').allTextContents())
    .reduce((sum, text) => sum + Math.round(parseFloat(text) * 10), 0);
  expect(total).toBe(1000);
  // The text summary names every slice.
  await expect(page.locator('#security-summary')).toHaveText(
    '18 networks: ' + CATEGORY_LEGEND.map(([label, value]) => `${label} ${value.split(' ')[0]}`).join(', ') + '.');

  // Slice sizes follow the counts: each slice's arc spans its share of the circle.
  const arcs = await pie.locator('path.slice').evaluateAll((paths) => paths.map((p) => {
    // d = "M0 0L<x1> <y1>A1 1 0 <large> 1 <x2> <y2>Z"; only the endpoints have decimals.
    const [x1, y1, x2, y2] = p.getAttribute('d').match(/-?\d+\.\d+/g).map(Number);
    let turn = (Math.atan2(y2, x2) - Math.atan2(y1, x1)) / (2 * Math.PI);
    if (turn <= 0) turn += 1;
    return { category: p.dataset.category, turn };
  }));
  for (const { category, turn } of arcs) expect(turn, category).toBeCloseTo(CATEGORY_COUNTS[category] / 18, 3);

  // Colours: Open is amber like the map legend; every slice has a colour and matches its swatch.
  const colors = await page.evaluate(() => Array.from(document.querySelectorAll('#security-legend li')).map((li) => ({
    category: li.dataset.category,
    swatch: getComputedStyle(li.querySelector('.pie-swatch')).backgroundColor,
    slice: getComputedStyle(document.querySelector(`.slice[data-category="${li.dataset.category}"]`)).fill,
  })));
  expect(colors.find((c) => c.category === 'open').slice).toBe('rgb(255, 176, 0)');
  for (const c of colors) expect(c.slice, c.category).toBe(c.swatch);
  expect(new Set(colors.map((c) => c.slice)).size).toBe(colors.length);
});

// The cells of a category list row (#13): name, count, share.
function listRow(page, category, kind = 'cat-row') {
  return page.locator(`#category-table tr.${kind}[data-category="${category}"]`).locator('th, td');
}

test('the category list shows every category with counts that match the pie (#13)', async ({ page }) => {
  await useFixture(page, FIXTURE_CATEGORIES);
  await page.goto('/index.html');
  await expectMarkers(page, 18);

  const table = page.getByRole('table', { name: 'Networks by category' });
  await expect(table).toBeVisible();
  await expect(page.locator('#list-status')).toBeHidden();
  await expect(table.getByRole('columnheader')).toHaveText(['Category', 'Networks', 'Share']);
  // Every category, in pie order, with its count and the legend's percentage.
  const rows = table.locator('tbody tr.cat-row');
  await expect(rows.locator('th')).toHaveText(CATEGORY_LEGEND.map(([label]) => label));
  // Screen readers pair each number with its row header (sub-rows and the total are row headers too).
  await expect(table.getByRole('rowheader')).toHaveCount(13);
  await expect(rows.locator('td.cat-count')).toHaveText(CATEGORY_LEGEND.map(([, v]) => v.match(/\((.*)\)/)[1]));
  await expect(rows.locator('td.cat-share')).toHaveText(CATEGORY_LEGEND.map(([, v]) => v.split(' ')[0]));

  // The default-looking split sits right under its row: 3 = 1 open + 2 WPA2 (order follows the categories).
  await expect(table.locator('tbody tr')).toHaveCount(12);
  await expect(table.locator('tbody tr').nth(0)).toHaveAttribute('data-category', 'default');
  const subRows = table.locator('tbody tr.sub-row');
  await expect(subRows).toHaveCount(2);
  await expect(table.locator('tbody tr').nth(1)).toHaveClass('sub-row');
  await expect(table.locator('tbody tr').nth(2)).toHaveClass('sub-row');
  await expect(table.locator('tbody tr').nth(1)).toHaveAttribute('data-category', 'open');
  await expect(table.locator('tbody tr').nth(2)).toHaveAttribute('data-category', 'wpa2');
  await expect(subRows.locator('.cat-label')).toHaveText(['on Open', 'on WPA2']);
  // Screen readers hear which row a split belongs to.
  await expect(table.getByRole('rowheader', { name: 'Default-looking on Open' })).toHaveCount(1);
  await expect(listRow(page, 'open', 'sub-row')).toHaveText(['Default-looking on Open', '1', '']);
  await expect(listRow(page, 'wpa2', 'sub-row')).toHaveText(['Default-looking on WPA2', '2', '']);
  await expect(table.locator('.sub-row .visually-hidden')).toHaveText(['Default-looking ', 'Default-looking ']);
  // Sub-rows have no swatch; category rows have one per category.
  await expect(table.locator('.sub-row .pie-swatch')).toHaveCount(0);
  await expect(rows.locator('.pie-swatch')).toHaveCount(10);

  await expect(page.locator('#category-list .hidden-note')).toHaveText(
    '> 2 hidden networks (blank name), counted under their security type');

  // Total = stats line = sum of the category rows; shares add up to 100.0.
  await expect(listRow(page, 'total', 'total-row')).toHaveText(['Total', '18', '100.0%']);
  await expect(page.locator('#stats')).toContainText('> 18 networks mapped');
  const counts = (await rows.locator('td.cat-count').allTextContents()).map(Number);
  expect(counts.reduce((a, b) => a + b, 0)).toBe(18);
  const tenths = (await rows.locator('td.cat-share').allTextContents())
    .reduce((sum, text) => sum + Math.round(parseFloat(text) * 10), 0);
  expect(tenths).toBe(1000);

  // Each share equals the pie legend's percentage, and each swatch the pie slice's colour.
  const pairs = await page.evaluate(() => Array.from(document.querySelectorAll('#security-legend li')).map((li) => {
    const tr = document.querySelector(`#category-table tr.cat-row[data-category="${li.dataset.category}"]`);
    return {
      category: li.dataset.category,
      legend: li.querySelector('.pie-value').textContent.split(' ')[0],
      list: tr.querySelector('.cat-share').textContent,
      slice: getComputedStyle(document.querySelector(`.slice[data-category="${li.dataset.category}"]`)).fill,
      swatch: getComputedStyle(tr.querySelector('.pie-swatch')).backgroundColor,
    };
  }));
  expect(pairs).toHaveLength(10);
  for (const p of pairs) {
    expect(p.list, p.category).toBe(p.legend);
    expect(p.swatch, p.category).toBe(p.slice);
  }
});

test('securityCategory ignores the name; classify puts factory names first (#13)', async ({ page }) => {
  await page.goto('/index.html');
  const result = await page.evaluate(() => {
    const S = window.RWPStats;
    const nets = [
      { ssid: 'NETGEAR42', auth: '[WPA2_PSK]' }, { ssid: 'NETGEAR42', auth: '[OPEN]' },
      { ssid: 'Cafe', auth: '[WPA3]' }, { ssid: 'DIRECT-x', auth: '[WPA2_EAP]' }, {}, null,
    ];
    return { security: nets.map(S.securityCategory), classes: nets.map(S.classify) };
  });
  expect(result.security).toEqual(['wpa2', 'open', 'wpa3', 'wpa2-enterprise', 'open', 'open']);
  expect(result.classes).toEqual(['default', 'default', 'wpa3', 'default', 'open', 'open']);
});

test('a slice over half the pie takes the long way round (#12)', async ({ page }) => {
  const nets = [['[OPEN]', 34.0556, -117.1825], ['[OPEN]', 34.0600, -117.1700], ['[OPEN]', 34.0500, -117.1900],
    ['[WPA2_PSK]', 34.0620, -117.1650]].map(([auth, lat, lon], i) =>
    ({ bssid: `aa:bb:cc:00:03:0${i}`, ssid: i === 3 ? '' : `Net${i}`, auth, lat, lon }));
  await page.route('**/data/networks.json', (route) => route.fulfill({
    contentType: 'application/json', body: JSON.stringify({ updated_at: null, networks: nets }) }));
  await page.goto('/index.html');
  await expectMarkers(page, 4);
  // Open is 75%: its arc needs the large-arc flag, or it is drawn over the WPA2 slice.
  await expect(page.locator('path.slice.cat-open')).toHaveAttribute('d', /A1 1 0 1 1 /);
  await expect(page.locator('path.slice.cat-wpa2')).toHaveAttribute('d', /A1 1 0 0 1 /);
  await expect(page.locator('#security-legend .pie-value')).toHaveText(['75.0% (3)', '25.0% (1)']);
  // No default-looking networks: a zero row and no split under it (#13).
  await expect(listRow(page, 'default')).toHaveText(['Default-looking', '0', '0.0%']);
  await expect(page.locator('#category-table .sub-row')).toHaveCount(0);
  await expect(listRow(page, 'open')).toHaveText(['Open', '3', '75.0%']);
  await expect(page.locator('#category-list .hidden-note')).toHaveText(
    '> 1 hidden network (blank name), counted under their security type');
});

test('a single-category database draws a full circle at 100% (#12)', async ({ page }) => {
  await page.route('**/data/networks.json', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ updated_at: null, networks: [
      { bssid: 'aa:bb:cc:00:02:01', ssid: 'Open1', auth: '[OPEN]', lat: 34.0556, lon: -117.1825 },
      { bssid: 'aa:bb:cc:00:02:02', ssid: 'Open2', auth: '[OPEN]', lat: 34.0600, lon: -117.1700 },
    ] }),
  }));
  await page.goto('/index.html');
  await expectMarkers(page, 2);
  await expect(page.locator('svg.pie circle.slice.cat-open')).toHaveCount(1);
  await expect(page.locator('svg.pie path')).toHaveCount(0);
  await expect(page.locator('#security-legend li')).toHaveText(['Open100.0% (2)']);
  // The list still shows all ten categories, the empty ones as zero (#13).
  const rows = page.locator('#category-table tbody tr.cat-row');
  await expect(rows).toHaveCount(10);
  await expect(rows.locator('td.cat-count')).toHaveText(['0', '2', '0', '0', '0', '0', '0', '0', '0', '0']);
  await expect(rows.locator('td.cat-share')).toHaveText(
    ['0.0%', '100.0%', '0.0%', '0.0%', '0.0%', '0.0%', '0.0%', '0.0%', '0.0%', '0.0%']);
  await expect(page.locator('#category-list .hidden-note')).toHaveText(
    '> 0 hidden networks (blank name), counted under their security type');
});

async function expectListUnavailable(page) {
  await expect(page.locator('#list-status')).toHaveText('> category list unavailable');
  await expect(page.locator('#list-status')).toBeVisible();
  await expect(page.locator('#category-list')).toHaveCSS('display', 'none');
  await expect(page.locator('#category-table')).toHaveCount(0);
}

for (const [name, setup, errorText] of [
  ['the database fails to load', (page) => page.route('**/data/networks.json',
    (route) => route.fulfill({ status: 500, body: 'nope' })), 'Could not load the network database'],
  ['the database is malformed', (page) => page.route('**/data/networks.json',
    (route) => route.fulfill({ contentType: 'application/json', body: '{"networks": "oops"}' })), 'not in the expected format'],
  ['the map library fails to load', (page) => page.route(/leaflet\.js$/, (route) => route.abort()), 'map library failed to load'],
]) {
  test(`the breakdown says unavailable, with no chart, when ${name} (#12, R2.7)`, async ({ page }) => {
    await setup(page);
    await page.goto('/index.html');
    await expect(page.getByRole('alert')).toContainText(errorText);
    await expect(page.locator('#security-status')).toHaveText('> security breakdown unavailable');
    await expect(page.locator('#security-chart')).toHaveCSS('display', 'none');
    await expect(page.locator('#security-status')).toBeVisible();
    await expect(page.locator('svg.pie')).toHaveCount(0);
    await expectListUnavailable(page);
  });
}

test('the breakdown says unavailable when stats.js fails to load (#12)', async ({ page }) => {
  await useFixture(page, FIXTURE_3);
  await page.route(/stats\.js$/, (route) => route.abort());
  await page.goto('/index.html');
  await expectMarkers(page, 3);
  await expect(page.locator('#stats')).toContainText('3 networks mapped');
  await expect(page.locator('#security-status')).toHaveText('> security breakdown unavailable');
  await expect(page.locator('#security-chart')).toHaveCSS('display', 'none');
  await expectListUnavailable(page);
});

test('a cached stats.js from before the list existed marks the list unavailable (#13)', async ({ page }) => {
  await useFixture(page, FIXTURE_3);
  // Serve the old script's shape: the pie only, and no securityCategory export.
  const fs = require('fs');
  const current = fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'stats.js'), 'utf8');
  const old = current
    .replace('renderList(counts, split, hidden, pct, total);', '')
    .replace(/setListStatus\([^)]*\);/g, '')
    .replace('securityCategory: securityCategory,', '');
  expect(old).not.toContain('renderList(counts, split, hidden, pct, total);');
  expect(old).not.toContain('setListStatus(\'');
  expect(old).not.toContain('securityCategory: ');
  await page.route(/stats\.js$/, (route) => route.fulfill({ contentType: 'text/javascript', body: old }));
  await page.goto('/index.html');
  await expectMarkers(page, 3);
  await expect(page.locator('svg.pie')).toBeVisible();
  await expect(page.locator('#list-status')).toHaveText('> category list unavailable');
});

test('a breakdown failure leaves the map and its stats line working (#12)', async ({ page }) => {
  await useFixture(page, FIXTURE_3);
  // Break the renderer before map.js calls it.
  await page.addInitScript(() => {
    Object.defineProperty(window, 'RWPStats', {
      configurable: true,
      set(value) {
        value.render = () => { throw new Error('boom'); };
        Object.defineProperty(window, 'RWPStats', { value, writable: true, configurable: true });
      },
    });
  });
  await page.goto('/index.html');
  await expectMarkers(page, 3);
  await expect(page.locator('#stats')).toContainText('3 networks mapped');
  await expect(page.locator('#security-status')).toHaveText('> security breakdown unavailable');
  await expectListUnavailable(page);
  await expect(page.locator('#error')).toBeHidden();
});

test('a category list failure clears the pie too, so the columns never disagree (#13)', async ({ page }) => {
  await useFixture(page, FIXTURE_3);
  // The pie is built from svg/ul/p elements; the list starts with a <table>, and that throws.
  await page.addInitScript(() => {
    const create = Document.prototype.createElement;
    Document.prototype.createElement = function (tag, ...rest) {
      if (String(tag).toLowerCase() === 'table') throw new Error('boom');
      return create.call(this, tag, ...rest);
    };
  });
  await page.goto('/index.html');
  await expectMarkers(page, 3);
  await expect(page.locator('#security-status')).toHaveText('> security breakdown unavailable');
  await expect(page.locator('svg.pie')).toHaveCount(0);
  await expectListUnavailable(page);
});

// The exact policy each page must carry; any added or loosened directive fails.
const EXPECTED_CSP = {
  '/index.html': {
    'default-src': "'none'",
    'script-src': "'self'",
    'style-src': "'self'",
    'img-src': "'self' data: https://tile.openstreetmap.org",
    'connect-src': "'self'",
    'base-uri': "'none'",
    'form-action': "'none'",
  },
  '/privacy.html': {
    'default-src': "'none'",
    'style-src': "'self'",
    'img-src': "'self'",
    'base-uri': "'none'",
    'form-action': "'none'",
  },
};

for (const pagePath of Object.keys(EXPECTED_CSP)) {
  test(`${pagePath} loads code only from its own origin and keeps a strict CSP`, async ({ page, baseURL }) => {
    const origin = new URL(baseURL).origin;
    const foreign = [];
    page.on('request', (req) => {
      const url = new URL(req.url());
      const allowed = req.resourceType() === 'image'
        ? url.origin === origin || url.protocol === 'data:' || url.hostname === 'tile.openstreetmap.org'
        : url.origin === origin;
      if (!allowed) foreign.push(`${req.resourceType()} ${req.url()}`);
    });
    await useFixture(page, FIXTURE_3);
    await page.goto(pagePath);
    if (pagePath === '/index.html') await expectMarkers(page, 3);
    expect(foreign).toEqual([]);

    const metas = page.locator('meta[http-equiv="Content-Security-Policy"]');
    await expect(metas).toHaveCount(1);
    const csp = Object.fromEntries((await metas.getAttribute('content')).split(';')
      .map((d) => d.trim().split(/\s+/)).filter((parts) => parts[0])
      .map(([name, ...values]) => [name.toLowerCase(), values.join(' ')]));
    expect(csp).toEqual(EXPECTED_CSP[pagePath]);

    // External links in the page's own markup open without leaking window.opener or the
    // page URL. (Leaflet's attribution links are same-tab and covered by the referrer policy.)
    const links = await page.locator('a[href^="http"]').evaluateAll((as) => as
      .filter((a) => !a.closest('.leaflet-control-attribution'))
      .map((a) => ({ href: a.href, rel: (a.rel || '').split(/\s+/) })));
    if (pagePath === '/index.html') expect(links.length).toBeGreaterThan(0);
    for (const link of links) expect(link.rel, link.href).toEqual(expect.arrayContaining(['noopener', 'noreferrer']));
  });
}

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

test('footer credits CaliCoders LLC above the privacy link (#20)', async ({ page }) => {
  await useFixture(page, FIXTURE_EMPTY);
  await page.goto('/index.html');

  const credit = page.locator('footer .credit');
  await expect(credit).toBeVisible();
  await expect(credit).toHaveText(
    'Security research brought to you by CaliCoders LLC, a security first managed service provider ' +
    'based in Redlands, where our goal is to create a safer, more secure network for not only our ' +
    'clients but our community at large.', { useInnerText: true });

  // Only the company name is a link, and it is a plain outbound link (R1.6).
  const links = credit.locator('a');
  await expect(links).toHaveCount(1);
  await expect(links).toHaveText('CaliCoders LLC');
  await expect(links).toHaveAttribute('href', 'https://www.calicoders.com');
  await expect(links).toHaveAttribute('target', '_blank');
  await expect(links).toHaveAttribute('rel', 'noopener noreferrer');

  // The credit comes before the privacy link in the footer.
  const order = await page.evaluate(() => {
    const footer = document.querySelector('footer');
    const creditEl = footer.querySelector('.credit');
    const privacyEl = footer.querySelector('a[href="privacy.html"]');
    return !!privacyEl && !!(creditEl.compareDocumentPosition(privacyEl) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  expect(order).toBe(true);
});

test('privacy page links back to the map', async ({ page }) => {
  await page.goto('/privacy.html');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Privacy policy');
  await expect(page.getByRole('link', { name: /back to the map/i })).toHaveAttribute('href', 'index.html');
});

test('privacy page covers every required section (R6)', async ({ page }) => {
  await page.goto('/privacy.html');
  await expect(page.locator('header time')).toHaveAttribute('datetime', /^\d{4}-\d{2}-\d{2}$/);

  const sections = {
    '#published': [/SSID/, /BSSID/, /Auth mode/, /Channel/, /Approximate location/, /First seen/],
    '#not-collected': [/No personal information/i],
    '#how': [/beacon/i, /never connects/i],
    '#where': [/92373/, /92374/, /thrown away/i, /opted out/i, /history/i],
    '#opt-out': [/_nomap/, /_optout/, /uppercase\s+or\s+lowercase/i, /not remembered/i],
    '#removal': [/do not need to email/i, /Issues are public/i, /_nomap/],
    '#visitors': [/No cookies/i, /No analytics/i, /No accounts/i],
  };
  for (const [id, patterns] of Object.entries(sections)) {
    const section = page.locator(`main section${id}`);
    await expect(section.getByRole('heading', { level: 2 })).toBeVisible();
    for (const pattern of patterns) await expect(section).toContainText(pattern);
    // Every section is reachable from the table of contents.
    await expect(page.locator(`nav.toc a[href="${id}"]`)).toHaveCount(1);
  }
  // Every table-of-contents entry points at a real section.
  for (const href of await page.locator('nav.toc a').evaluateAll((as) => as.map((a) => a.getAttribute('href')))) {
    await expect(page.locator(`main section${href}`)).toHaveCount(1);
  }
  // Both third-party services that see visitors' IP addresses are disclosed.
  for (const service of ['GitHub Pages', 'OpenStreetMap']) {
    await expect(page.locator('#visitors li', { hasText: service })).toContainText(/IP address/);
  }

  // R6.5: removal requests go to a new GitHub issue, no email address.
  await expect(page.locator('#removal a[href="https://github.com/patrickmroskam/redlands_wifi_project/issues/new"]'))
    .toBeVisible();
  await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0);

  // External links never leak the opener or the full referrer.
  const externals = page.locator('a[href^="http"]');
  expect(await externals.count()).toBeGreaterThan(0);
  for (const link of await externals.all()) {
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  }
});

test('site sets no cookies or storage (R1.6)', async ({ page, context }) => {
  await useFixture(page, FIXTURE_3);
  await page.goto('/index.html');
  await expectMarkers(page, 3);
  expect(await context.cookies()).toEqual([]);
  expect(await page.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0);
});

// Responsive QA (R1.4, #7): both pages at phone, tablet, and desktop widths.
for (const pagePath of ['/index.html', '/privacy.html']) {
  for (const width of [320, 360, 768, 1280]) {
    test(`no horizontal overflow at ${width} px on ${pagePath} (R1.4)`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 740 });
      await useFixture(page, FIXTURE_CATEGORIES);
      await page.goto(pagePath);
      if (pagePath === '/index.html') {
        await expectMarkers(page, 18);
        await expect(page.locator('svg.pie')).toBeVisible();
        await expect(page.locator('#category-table')).toBeVisible();
        // #12: two columns side by side on wide screens, stacked below 720 px.
        const [left, right] = await Promise.all(['#security-col', '#list-col']
          .map((sel) => page.locator(sel).boundingBox()));
        if (width >= 720) expect(right.y).toBe(left.y);
        else expect(right.y).toBeGreaterThanOrEqual(left.y + left.height);
      }
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      await testInfo.attach(`${pagePath.slice(1, -5)}-${width}px`, {
        body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
    });
  }
}

// The popup's box relative to the map's box, in CSS pixels.
function popupInsideMap(page) {
  return page.evaluate(() => {
    // A closed popup lingers for its 200 ms fade; the open one is always the last child.
    const popup = document.querySelector('.leaflet-popup-pane > .leaflet-popup:last-child');
    if (!popup) return 'no popup';
    const p = popup.getBoundingClientRect();
    const m = document.getElementById('map').getBoundingClientRect();
    return p.top >= m.top && p.left >= m.left && p.right <= m.right && p.bottom <= m.bottom
      ? 'inside' : `outside: popup ${[p.left, p.top, p.right, p.bottom]} map ${[m.left, m.top, m.right, m.bottom]}`;
  });
}

test('popups open fully inside the fenced map on a phone; the fence returns on close (#7)', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await useFixture(page, FIXTURE_3);
  await page.goto('/index.html');
  await expectMarkers(page, 3);
  const fence = await page.evaluate(() => window.__rwp.fence().toBBoxString());
  const zoom = await page.locator('.leaflet-control-zoom').boundingBox();
  const mapBox = await page.locator('#map').boundingBox();

  // A real tap on the first marker, then each popup in turn (switching closes the previous one).
  await clickMarker(page, 0);
  await expect(page.locator('.leaflet-popup:last-child .ssid')).toContainText('Citrus');
  for (let i = 0; i < 3; i++) {
    if (i > 0) await page.evaluate((n) => window.__rwp.markers[n].openPopup(), i);
    await expect.poll(() => popupInsideMap(page)).toBe('inside');
    const box = await page.locator('.leaflet-popup-pane > .leaflet-popup:last-child').boundingBox();
    // Clear of the zoom buttons, and never wider than the map (the XSS fixture's SSID is long).
    expect(box.x).toBeGreaterThanOrEqual(zoom.x + zoom.width);
    expect(box.width).toBeLessThanOrEqual(mapBox.width);
    // The fence is only loosened, never dropped, while a popup is open.
    expect(await page.evaluate((f) => {
      const b = window.__rwp.map.options.maxBounds;
      const [w, s, e, n] = f.split(',').map(Number);
      return !!b && b.contains(L.latLngBounds([s, w], [n, e]));
    }, fence)).toBe(true);
  }
  await expect(page.locator('.leaflet-popup:last-child .ssid')).toHaveText('hidden');

  await page.locator('.leaflet-popup:last-child .leaflet-popup-close-button').click();
  await expect(page.locator('.leaflet-popup')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__rwp.map.options.maxBounds.toBBoxString())).toBe(fence);
  await expect.poll(() => page.evaluate(() => window.__rwp.fence().contains(window.__rwp.map.getCenter())))
    .toBe(true);
  // Zooming out past the fence is still impossible after a popup has been open.
  const minZoom = await page.evaluate(() => window.__rwp.map.getMinZoom());
  await page.evaluate(() => window.__rwp.map.setZoom(3, { animate: false }));
  expect(await page.evaluate(() => window.__rwp.map.getZoom())).toBe(minZoom);
});

// Markers at the fence's corners and top edge are where clipping was worst. Portrait and landscape
// phones, at the zoom-out limit and zoomed in on the marker.
for (const [width, height] of [[360, 740], [740, 360]]) {
  for (const zoomIn of [0, 2]) {
    test(`corner popups stay inside the map at ${width}x${height}, min zoom +${zoomIn} (#7)`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await useFixture(page, FIXTURE_CORNERS);
      await page.goto('/index.html');
      await expectMarkers(page, 5);
      const fence = await page.evaluate(() => window.__rwp.fence().toBBoxString());
      for (let i = 0; i < 5; i++) {
        await page.evaluate(([n, dz]) => {
          const { map, markers } = window.__rwp;
          map.closePopup();
          map.setView(markers[n].getLatLng(), map.getMinZoom() + dz, { animate: false });
        }, [i, zoomIn]);
        // Let the fence's own snap-back settle before opening, as a user's tap would.
        await page.waitForTimeout(400);
        await page.evaluate((n) => window.__rwp.markers[n].openPopup(), i);
        await expect.poll(() => popupInsideMap(page), { message: `marker ${i}` }).toBe('inside');
      }
      await page.evaluate(() => window.__rwp.map.closePopup());
      await expect.poll(() => page.evaluate(() => window.__rwp.map.options.maxBounds.toBBoxString())).toBe(fence);
    });
  }
}

test('Leaflet controls keep the terminal theme in every state (#7)', async ({ page }) => {
  await useFixture(page, FIXTURE_3);
  await page.goto('/index.html');
  await expectMarkers(page, 3);
  const panel = 'rgb(10, 18, 10)';

  // At the zoom-out limit Leaflet marks the button disabled; its default style is light grey.
  await page.evaluate(() => window.__rwp.map.setZoom(window.__rwp.map.getMinZoom(), { animate: false }));
  const zoomOut = page.locator('.leaflet-control-zoom-out');
  await expect(zoomOut).toHaveClass(/leaflet-disabled/);
  await expect(zoomOut).toHaveCSS('background-color', panel);
  await expect(page.locator('.leaflet-control-zoom-in')).toHaveCSS('background-color', panel);

  // The popup close button stays amber-bright when focused (Leaflet's default is grey).
  await page.evaluate(() => window.__rwp.markers[0].openPopup());
  const close = page.locator('.leaflet-popup-close-button');
  await close.focus();
  await expect(close).toHaveCSS('color', 'rgb(255, 209, 102)');
  await expect(page.locator('.leaflet-popup-content-wrapper')).toHaveCSS('background-color', panel);
  await page.keyboard.press('Enter');
  await expect(page.locator('.leaflet-popup')).toHaveCount(0);
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

// Scale (#11): the first backfill publishes about 18k networks. Generated here, at test time, inside
// the Redlands bbox; never written to disk, and never to ingest/.
function generatedDatabase(count) {
  let seed = 11;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const networks = [];
  for (let i = 0; i < count; i++) {
    const hex = i.toString(16).padStart(6, '0');
    networks.push({
      bssid: `02:00:00:${hex.slice(0, 2)}:${hex.slice(2, 4)}:${hex.slice(4)}`,
      ssid: `net-${i}`,
      auth: i % 5 === 0 ? '[ESS]' : '[WPA2-PSK-CCMP][ESS]',
      channel: 1 + (i % 11),
      first_seen: '2026-09-14 10:00:00',
      lat: 34.00 + random() * 0.08,
      lon: -117.24 + random() * 0.14,
    });
  }
  return JSON.stringify({ updated_at: '2026-09-17T00:00:00Z', count, networks });
}

test('18,000 networks load quickly, stay off the DOM, and pan, zoom and open popups (#11)', async ({ page }) => {
  const COUNT = 18000;
  const body = generatedDatabase(COUNT);
  await page.setViewportSize({ width: 360, height: 740 });
  await page.route('**/data/networks.json', (route) => route.fulfill({ contentType: 'application/json', body }));

  const started = Date.now();
  await page.goto('/index.html');
  // Generous budget for CI runners; about 0.5 s locally (about 2 s with SVG markers).
  await expect(page.locator('#stats')).toContainText('18,000 networks mapped', { timeout: 15_000 });
  console.log(`18k networks: stats line after ${Date.now() - started} ms`);
  // The list formats large counts with thousands separators (#13).
  await expect(page.locator('#category-table tfoot td.cat-count')).toHaveText('18,000');
  await expectMarkers(page, COUNT);
  const kinds = await markerKinds(page);
  expect(kinds.filter((k) => k === 'open')).toHaveLength(COUNT / 5);

  // One canvas, not one element per network (SVG markers made this about 18,080).
  expect(await page.evaluate(() => document.getElementsByTagName('*').length)).toBeLessThan(500);

  // Pan, zoom in, and zoom out all finish, and no frame stalls for long while they animate.
  // With SVG markers the worst frame was about 700 ms under 6x CPU throttling (#11 plan).
  const moved = await page.evaluate(async () => {
    const { map } = window.__rwp;
    const t = performance.now();
    let last = t;
    let worst = 0;
    let running = true;
    const tick = (now) => {
      worst = Math.max(worst, now - last);
      last = now;
      if (running) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    const settle = (event, action) => new Promise((resolve) => { map.once(event, resolve); action(); });
    await settle('moveend', () => map.panBy([120, 90], { animate: true, duration: 0.3 }));
    await settle('moveend', () => map.panBy([-120, -90], { animate: true, duration: 0.3 }));
    await settle('zoomend', () => map.zoomIn(1));
    await settle('zoomend', () => map.zoomOut(1));
    running = false;
    return { total: performance.now() - t, worst };
  });
  console.log(`18k networks: pan/zoom ${Math.round(moved.total)} ms, worst frame ${Math.round(moved.worst)} ms`);
  expect(moved.total).toBeLessThan(10_000);
  expect(moved.worst).toBeLessThan(400);

  // A real click on a network in view opens its popup.
  const n = await page.evaluate(() => {
    const { map, markers } = window.__rwp;
    const inner = map.getBounds().pad(-0.3);
    return markers.findIndex((m) => inner.contains(m.getLatLng()));
  });
  expect(n).toBeGreaterThanOrEqual(0);
  await page.evaluate((i) => window.__rwp.map.setView(window.__rwp.markers[i].getLatLng(),
    window.__rwp.map.getMaxZoom(), { animate: false }), n);
  await clickMarker(page, n);
  await expect(page.locator('.leaflet-popup-content .ssid')).toHaveText(`net-${n}`);
});

// Two networks about 8 px apart at the closest zoom, near enough that both are "under" a click
// between them. A click opens the one whose centre is nearest, anchored on that centre (#11 review).
const NEAR_PAIR = JSON.stringify({ updated_at: '2026-09-17T00:00:00Z', count: 2, networks: [
  { bssid: 'aa:bb:cc:00:01:01', ssid: 'Alpha', auth: '[WPA2]', channel: 1, first_seen: 'x', lat: 34.05, lon: -117.18 },
  { bssid: 'aa:bb:cc:00:01:02', ssid: 'Bravo', auth: '[ESS]', channel: 6, first_seen: 'x', lat: 34.05, lon: -117.1799785 },
] });

async function openNearPair(page) {
  await page.route('**/data/networks.json', (route) =>
    route.fulfill({ contentType: 'application/json', body: NEAR_PAIR }));
  await page.goto('/index.html');
  await expectMarkers(page, 2);
  const gap = await page.evaluate(() => {
    const { map, markers } = window.__rwp;
    map.setView(markers[0].getLatLng(), map.getMaxZoom(), { animate: false });
    return map.latLngToContainerPoint(markers[1].getLatLng()).x - map.latLngToContainerPoint(markers[0].getLatLng()).x;
  });
  expect(gap).toBeGreaterThan(6);
  expect(gap).toBeLessThan(11);
  return gap;
}

async function openedPopup(page) {
  const popup = page.locator('.leaflet-popup:last-child');
  const ssid = await popup.locator('.ssid').textContent();
  // The popup's tip points at that network's centre, not at the click.
  const anchored = await page.evaluate(() => {
    const { map, markers } = window.__rwp;
    const open = markers.find((m) => m.isPopupOpen());
    return !!open && open.getPopup().getLatLng().equals(open.getLatLng());
  });
  return { ssid, anchored };
}

test('a click opens the nearest network, not the last one drawn nearby (#11)', async ({ page }) => {
  const gap = await openNearPair(page);

  await clickMarker(page, 0);
  await expect(page.locator('.leaflet-popup:last-child .ssid')).toHaveText('Alpha');
  expect(await openedPopup(page)).toEqual({ ssid: 'Alpha', anchored: true });

  await clickMarker(page, 1);
  await expect(page.locator('.leaflet-popup:last-child .ssid')).toHaveText('Bravo');
  expect(await openedPopup(page)).toEqual({ ssid: 'Bravo', anchored: true });

  // Just left of the midpoint is Alpha's; a click well clear of both opens nothing.
  await clickMarker(page, 0, Math.floor(gap / 2) - 1, 0);
  await expect(page.locator('.leaflet-popup:last-child .ssid')).toHaveText('Alpha');
  await clickMarker(page, 0, -40, 0);
  await expect(page.locator('.leaflet-popup')).toHaveCount(0);
});

test('the pointer turns into a hand only over a network (#11)', async ({ page }) => {
  await useFixture(page, FIXTURE_3);
  await page.goto('/index.html');
  await expectMarkers(page, 3);
  const map = page.locator('#map');

  const on = await markerPoint(page, 0);
  await page.mouse.move(on.x, on.y);
  await expect(map).toHaveClass(/over-marker/);
  await expect(map).toHaveCSS('cursor', 'pointer');

  const off = await markerPoint(page, 0, 0, -30);
  await page.mouse.move(off.x, off.y);
  await expect(map).not.toHaveClass(/over-marker/);
});

test.describe('on a touch screen', () => {
  test.use({ hasTouch: true, viewport: { width: 360, height: 740 } });

  test('a tap a few pixels off a network still opens it (#11)', async ({ page }) => {
    await useFixture(page, FIXTURE_3);
    await page.goto('/index.html');
    await expectMarkers(page, 3);
    expect(await page.evaluate(() => window.matchMedia('(any-pointer: coarse)').matches)).toBe(true);
    await page.evaluate(() => window.__rwp.map.setZoom(window.__rwp.map.getMinZoom() + 2, { animate: false }));

    // 9 px from the centre: outside the drawn circle, inside the finger slop.
    const { x, y } = await markerPoint(page, 2, 9, 0);
    await page.touchscreen.tap(x, y);
    await expect(page.locator('.leaflet-popup:last-child .ssid')).toHaveText('hidden');
  });
});
