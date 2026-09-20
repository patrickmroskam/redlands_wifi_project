// Scale (#11): the first backfill publishes about 18k networks.
const { test, expect } = require('@playwright/test');
const { installHooks, markerKinds, expectMarkers, clickMarker } = require('./helpers');

installHooks();

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
