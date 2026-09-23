// Network kinds and the per-kind map filter (#65, PRD R10).
//
// The classifier is plain data + regexes on window.RWPStats, so the pattern tests below are unit
// tests that happen to run in the page: the site has no build step, and stats.js is a browser
// script, so the browser is where it can be exercised as-is rather than through a shim (R10.4).
const { test, expect } = require('@playwright/test');
const {
  installHooks, FIXTURE_KINDS, useFixture, expectMarkers, markerPoint,
  kindRow, visibleKinds, toggleKind,
} = require('./helpers');

installHooks();

// Every kind, in the order it appears on the toggles and in the breakdown.
const KIND_IDS = ['vehicle', 'phone', 'direct', 'default', 'hidden', 'named'];

// The fixture's split. 12 networks, rounded by largest remainder so the column is exactly 100.0.
const KIND_COUNTS = { vehicle: 3, phone: 2, direct: 2, default: 2, hidden: 1, named: 2 };
const KIND_ROWS = [
  ['Vehicle', '3', '25.0%'],
  ['Phone / hotspot', '2', '16.7%'],
  ['Wi-Fi Direct / printer', '2', '16.7%'],
  ['Default-looking', '2', '16.7%'],
  ['Hidden', '1', '8.3%'],
  ['Named', '2', '16.6%'],
];

// Real SSID shapes from data/networks.json: what each pattern is meant to catch, and the
// look-alikes sitting next to it in the same database that it must not (R10.4).
const HITS = {
  vehicle: [
    'myChevrolet 3B64', 'myChevrolet0955', 'myGMC BEE6', 'myBuick2540', 'myCadillac d9b6',
    'CHEVROLET1347', 'GMC_4005', 'BUICK2169', 'CADILLAC6009', 'Chevy WiFi', 'Buick WiFi',
    'TOYOTA RAV4-2.4g_703adb', 'TOYOTA Grand Highlander-2.4g_ac9', 'ToyotaSecure',
    'LEXUS ES_BBDEC3CC1098', 'Mazda_2017888db0d8', 'Mazda-c02972', 'HONDA1359', 'HONDA5460ll',
    'Hyundai_Ic1q', 'Kia_2fTI', 'My VW 6616', 'Audi_MMI_8140', 'Audi_MMI_MIB3',
    'Porsche_WLAN_4345', 'BMW 49508', 'BMW02628 CarPlay', 'My BMW Hotspot 4613',
    'MINI07333 CarPlay', 'MB Hotspot 7636284', 'MB WLAN 37248', 'MY ROGUE0409', 'Nissan RSE',
    'INFINITI-RSI', 'SYNC_XP9WT5H3', 'uconnectadpt', 'CarPlay_6cf8', 'carplay_wifi_2E57',
    'CarPlayBox_0584', 'Smartphone_connect_1a523b', 'Smartphone_projection_1193',
    'Vehicle Hotspot',
  ],
  phone: [
    'Hotspot85FA', 'WiFi Hotspot 0003', 'Cannon Hotspot', 'MCIHotspot', 'hotspot1',
    'KeepTruckin Hotspot - QC232660', 'T-Mobile Hotspot_3372_2.4GHz', 'Verizon-My hotspot',
    'iPhone', 'Ethans Iphone', 'Z iPhone', 'iPhoneSetup', 'iPad_Kiosk', 'DPW-iPad-JNH4Q6VL7T',
    'Galaxy S24 66BC', "Walter's Galaxy S22+", 'Galaxy Tab A7 Lite5479',
    'Samsung Galaxy Flip_5230', 'AndroidAP_9257', 'Verizon-MiFi8800L-1E50', 'Wy Mifi',
    'CellSpot_2.4GHz_8C48', 'tgmCellspot', 'Franklin T10 0390', 'EED Franklin T10 5440',
    'Moxee Tether29_2.4G', 'Redmi Note 14 Pro 5G', 'NOKIA-C031',
  ],
  direct: ['DIRECT-7F-HP OfficeJet Pro', 'DIRECT-9e-AndroidAP', 'DIRECT-32-myChevrolet'],
  default: ['SpectrumSetup-A1', 'NETGEAR42-5G', 'Frontier1234', 'ORBI12-Guest', 'xfinitywifi'],
  hidden: ['', '   '],
  named: [
    // Look-alikes: an ordinary name that happens to contain a make or a device word.
    'Audiology', 'Audiology - Guest', 'AudioVisual', 'ScreenAudio2846', 'Audi Guzman',
    'Dodger Blue', 'DodgerFam', 'dodgers1981', 'Oxford908', 'Gepford House', 'Fords',
    'RUConnected', 'Leaky Sync', 'KiaraCam', 'Spectrum pixel', 'Franklin WiFi', 'Equinox',
    'Trailblazer', 'Sierra', 'Yukon XL', 'TheColorado', 'Redlands Ford', 'Subaru Wi-Fi',
    // Owner-renamed cars: a made-up name is not evidence of a device class.
    'Christinas VW', 'DAVID CHEVY', 'CodyGMC', 'MyChevy', 'Shelbys Chevy', 'Diane Cadillac',
    // Tesla's home energy kit is fixed equipment, not a car.
    'TeslaPW_BKUDNT', 'TeslaPV_83A713', 'TeslaWallConnector_E9CAC0',
    // T-Mobile's 5G home gateway is a router, and its factory name is the security axis's job.
    'T-Mobile Broadband39',
  ],
};

function classifyAll(page, ssids) {
  return page.evaluate((names) => names.map((s) => window.RWPStats.kindOf({ ssid: s })), ssids);
}

test('every SSID pattern matches its real shapes and skips the look-alikes (R10.4)', async ({ page }) => {
  await page.goto('/index.html');
  for (const [kind, ssids] of Object.entries(HITS)) {
    expect(await classifyAll(page, ssids), `expected all of these to be ${kind}`)
      .toEqual(ssids.map(() => kind));
  }
});

test('a network has exactly one kind, and the kinds add up to the total (R10.1, R10.2)', async ({ page }) => {
  await page.goto('/index.html');
  const fixture = require(FIXTURE_KINDS);
  const result = await page.evaluate((nets) => {
    const S = window.RWPStats;
    const counts = S.countKinds(nets);
    const ids = S.KINDS.map((k) => k.id);
    return {
      counts,
      ids,
      byBssid: Object.fromEntries(nets.map((n) => [n.bssid, S.kindOf(n)])),
      sum: ids.reduce((t, id) => t + counts[id], 0),
      tenths: Object.values(S.percentages(counts, ids)).reduce((t, p) => t + Math.round(p * 10), 0),
      // A kind is a single string, so "exactly one" is structural; this guards the id set instead.
      unknown: nets.map((n) => S.kindOf(n)).filter((k) => ids.indexOf(k) < 0),
    };
  }, fixture.networks);

  expect(result.ids).toEqual(KIND_IDS);
  expect(result.counts).toEqual(KIND_COUNTS);
  expect(result.unknown).toEqual([]);
  expect(result.sum).toBe(fixture.networks.length);
  expect(result.tenths).toBe(1000);
  // The precedence rule: the DIRECT- prefix says what the radio is, so it wins over the make.
  expect(result.byBssid['aa:bb:cc:00:02:07']).toBe('direct'); // DIRECT-BMW 16740
  expect(result.byBssid['aa:bb:cc:00:02:0b']).toBe('named'); // "Christinas VW" is a renamed network
  expect(result.byBssid['aa:bb:cc:00:02:0a']).toBe('hidden'); // blank name beats every pattern
});

test('the two axes stay independent: DIRECT- is Default-looking and Wi-Fi Direct (R10.1)', async ({ page }) => {
  await page.goto('/index.html');
  const both = await page.evaluate(() => {
    const net = { ssid: 'DIRECT-7F-HP OfficeJet Pro', auth: '[WPA2_PSK]' };
    return { security: window.RWPStats.classify(net), kind: window.RWPStats.kindOf(net) };
  });
  expect(both).toEqual({ security: 'default', kind: 'direct' });
});

test('the kind column lists every kind with shares that add to 100% (R10.2)', async ({ page }) => {
  await useFixture(page, FIXTURE_KINDS);
  await page.goto('/index.html');
  await expectMarkers(page, 12);

  await expect(page.locator('#kind-table')).toBeVisible();
  for (const [i, kind] of KIND_IDS.entries()) {
    await expect(kindRow(page, kind)).toHaveText(KIND_ROWS[i]);
  }
  await expect(kindRow(page, 'total')).toHaveText(['Total', '12', '100.0%']);
  // The shares really do add up, not just look like it.
  const shares = await page.locator('#kind-table tbody .cat-share').allTextContents();
  expect(shares.reduce((t, s) => t + Math.round(parseFloat(s) * 10), 0)).toBe(1000);
});

test('every kind starts switched on, one toggle each (R10.3)', async ({ page }) => {
  await useFixture(page, FIXTURE_KINDS);
  await page.goto('/index.html');
  await expectMarkers(page, 12);

  const boxes = page.locator('#kind-filters input[type="checkbox"]');
  await expect(boxes).toHaveCount(KIND_IDS.length);
  expect(await boxes.evaluateAll((els) => els.map((e) => e.getAttribute('data-kind')))).toEqual(KIND_IDS);
  expect(await boxes.evaluateAll((els) => els.every((e) => e.checked))).toBe(true);
  // All on means every plotted marker is hit-testable, in plot order.
  expect(await visibleKinds(page))
    .toEqual(['vehicle', 'vehicle', 'vehicle', 'phone', 'phone', 'direct', 'direct',
      'default', 'default', 'hidden', 'named', 'named']);
});

test('toggling a kind off hides its markers, and back on restores them (R10.3)', async ({ page }) => {
  await useFixture(page, FIXTURE_KINDS);
  await page.goto('/index.html');
  await expectMarkers(page, 12);
  const before = await visibleKinds(page);
  // Keep every marker, so a hidden one can still be asked whether it left the map.
  await page.evaluate(() => { window.__all = window.__rwp.markers.slice(); });

  await toggleKind(page, 'vehicle', false);
  expect(await visibleKinds(page)).toEqual(before.filter((k) => k !== 'vehicle'));
  // Hidden means really off the map, not merely dropped from the hit-test list.
  expect(await page.evaluate(() => window.__all
    .filter((m) => m.options.networkKind === 'vehicle')
    .map((m) => window.__rwp.map.hasLayer(m)))).toEqual([false, false, false]);

  await toggleKind(page, 'phone', false);
  expect(await visibleKinds(page)).toEqual(['direct', 'direct', 'default', 'default', 'hidden', 'named', 'named']);

  await toggleKind(page, 'vehicle', true);
  expect(await visibleKinds(page)).toEqual(before.filter((k) => k !== 'phone'));

  await toggleKind(page, 'phone', true);
  expect(await visibleKinds(page)).toEqual(before);
  expect(await page.evaluate(() => window.__all.every((m) => window.__rwp.map.hasLayer(m)))).toBe(true);
  await expectMarkers(page, 12);
});

test('turning every kind off empties the map, and turning them back on refills it (R10.3)', async ({ page }) => {
  await useFixture(page, FIXTURE_KINDS);
  await page.goto('/index.html');
  await expectMarkers(page, 12);

  for (const kind of KIND_IDS) await toggleKind(page, kind, false);
  expect(await visibleKinds(page)).toEqual([]);
  for (const kind of KIND_IDS) await toggleKind(page, kind, true);
  await expectMarkers(page, 12);
});

test('the breakdown keeps describing the whole database while a kind is hidden (R10.3)', async ({ page }) => {
  await useFixture(page, FIXTURE_KINDS);
  await page.goto('/index.html');
  await expectMarkers(page, 12);
  const summary = await page.locator('#security-summary').textContent();

  await toggleKind(page, 'vehicle', false);
  await expect(kindRow(page, 'vehicle')).toHaveText(KIND_ROWS[0]);
  await expect(kindRow(page, 'total')).toHaveText(['Total', '12', '100.0%']);
  expect(await page.locator('#security-summary').textContent()).toBe(summary);
  await expect(page.locator('#stats')).toContainText('12 networks mapped');
});

// Opening a popup auto-pans, and closing it pans back to restore the fence, so a pixel read before
// either is stale by the time it is clicked. Wait the animation out and read the pixel again.
async function whenMapStill(page) {
  await expect.poll(() => page.evaluate(() => {
    const anim = window.__rwp.map._panAnim;
    return !!(anim && anim._inProgress);
  })).toBe(false);
}

// The viewport pixel of a marker stashed on window, for a marker the filter has hidden (so it is
// no longer in window.__rwp.markers and markerPoint cannot reach it by index).
function stashedPoint(page) {
  return page.evaluate(() => {
    const { map } = window.__rwp;
    const p = map.latLngToContainerPoint(window.__vehicle.getLatLng());
    const box = map.getContainer().getBoundingClientRect();
    return { x: box.left + p.x, y: box.top + p.y };
  });
}

test('a hidden marker takes its popup with it, and stops answering clicks (R10.3)', async ({ page }) => {
  await useFixture(page, FIXTURE_KINDS);
  await page.goto('/index.html');
  await expectMarkers(page, 12);
  await page.evaluate(() => { window.__vehicle = window.__rwp.markers[0]; });

  // Open the first vehicle's popup, then hide vehicles: the popup must not outlive its marker.
  await page.evaluate(() => window.__vehicle.openPopup());
  await expect(page.locator('.leaflet-popup:last-child .ssid')).toHaveText('myChevrolet 3B64');

  await toggleKind(page, 'vehicle', false);
  await expect(page.locator('.leaflet-popup')).toHaveCount(0);

  // A click where it still is opens nothing: hit-testing only ever sees visible markers.
  await whenMapStill(page);
  const hidden = await stashedPoint(page);
  await page.mouse.click(hidden.x, hidden.y);
  await expect(page.locator('.leaflet-popup')).toHaveCount(0);

  // Switched back on, the same marker is clickable again at the same place.
  await toggleKind(page, 'vehicle', true);
  await whenMapStill(page);
  const shown = await markerPoint(page, 0);
  await page.mouse.click(shown.x, shown.y);
  await expect(page.locator('.leaflet-popup:last-child .ssid')).toHaveText('myChevrolet 3B64');
});

test('the filter is on the main map only, and never appears without markers (R10.3)', async ({ page }) => {
  for (const other of ['/bluetooth.html', '/flock.html']) {
    await page.goto(other);
    await expect(page.locator('#kind-filters')).toHaveCount(0);
  }
  // An unreadable database plots nothing, so there is nothing to filter.
  await page.route('**/data/networks.json', (route) => route.fulfill({ status: 500, body: 'nope' }));
  await page.goto('/index.html');
  await expect(page.locator('#error')).toBeVisible();
  await expect(page.locator('#kind-filters')).toBeHidden();
  await expect(page.locator('#kind-status')).toHaveText('> kind list unavailable');
});
