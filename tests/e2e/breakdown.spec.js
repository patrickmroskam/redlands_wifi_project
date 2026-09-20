// Security-breakdown e2e tests: the pie chart (#12) and the category list (#13) under the
// map, including how both degrade when stats.js is missing, stale or throwing.
const { test, expect } = require('@playwright/test');
const path = require('path');
const {
  installHooks, FIXTURE_3, FIXTURE_CATEGORIES, useFixture, expectMarkers, listRow
} = require('./helpers');

installHooks();

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
