// Map-interaction e2e tests: popups, auto-pan and the fence (#7, #29), click precision on
// the marker canvas (#11), and the Leaflet controls' theme.
//
// These drive several hundred ms of real pan animation each and are sensitive to WHEN a
// step lands, not just what it asserts, so they are kept together for cohesion (#34).
// Note that is cohesion only, NOT serialisation: playwright.config.js sets
// fullyParallel: true, so same-file tests are still dispatched to separate workers and
// run at the same time — measured, four of these landed on four workers within 2 ms.
// Anything here that must not overlap needs test.describe.configure({ mode: 'serial' }).
const { test, expect } = require('@playwright/test');
const {
  installHooks, FIXTURE_3, FIXTURE_CORNERS, useFixture, expectMarkers, markerPoint, clickMarker
} = require('./helpers');

installHooks();

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

// #29: both cases need a pan that is still running when something else measures the map, so these
// drive the map through window.__rwp in one page-side pass rather than round-tripping per step.

test('closing a popup does not cut its auto-pan short and pan again (#29)', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 360, height: 740 });
  await useFixture(page, FIXTURE_CORNERS);
  await page.goto('/index.html');
  await expectMarkers(page, 5);

  const runs = await page.evaluate(async () => {
    const { map, markers } = window.__rwp;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const zoom = () => map.getMinZoom() + 2;
    // Compare centres in pixels at a fixed zoom: panBy moves whole pixels, degrees would not say
    // how far off the map actually is.
    const centrePixel = () => {
      const p = map.project(map.getCenter(), zoom());
      return [p.x, p.y];
    };
    const out = [];
    for (let i = 0; i < markers.length; i++) {
      // Centring on a fence corner leaves the marker off-centre, so its popup has to auto-pan.
      // First, let that auto-pan finish: this is where it was heading.
      map.closePopup(); await sleep(600);
      map.setView(markers[i].getLatLng(), zoom(), { animate: false }); await sleep(300);
      let autoPanned = false;
      const noteAutoPan = () => { autoPanned = true; };
      map.on('autopanstart', noteAutoPan);
      markers[i].openPopup(); await sleep(800);
      const target = centrePixel();
      map.off('autopanstart', noteAutoPan);

      // Now the same open, dismissed 50 ms in — well inside the 250 ms auto-pan.
      map.closePopup(); await sleep(600);
      map.setView(markers[i].getLatLng(), zoom(), { animate: false }); await sleep(300);
      let firstEnd = null;
      const noteEnd = () => { if (firstEnd === null) firstEnd = centrePixel(); };
      map.on('moveend', noteEnd);
      markers[i].openPopup();
      await sleep(50);
      // A 50 ms timer that overran past the 250 ms auto-pan would leave nothing to interrupt and
      // the assertion would hold for the wrong reason, so record whether it really did land inside.
      const closedMidPan = !!(map._panAnim && map._panAnim._inProgress);
      map.closePopup();
      await sleep(1200);
      map.off('moveend', noteEnd);
      out.push({ i, autoPanned, closedMidPan, target, firstEnd });
    }
    map.closePopup();
    return out;
  });

  let exercised = 0;
  for (const run of runs) {
    if (!run.autoPanned) continue;   // this popup fitted already; there was no pan to interrupt
    if (!run.closedMidPan) continue; // the close missed the animation; this run proves nothing
    exercised += 1;
    expect(run.firstEnd, `marker ${run.i}: no pan ever finished`).not.toBeNull();
    const short = Math.max(Math.abs(run.firstEnd[0] - run.target[0]), Math.abs(run.firstEnd[1] - run.target[1]));
    // Stopping short means the fence restore cut the auto-pan off part-way and animated again from
    // there — the second pan the user sees. Finishing means it simply waited its turn.
    expect(short, `marker ${run.i}: auto-pan ended ${short} px short of where it was heading`)
      .toBeLessThanOrEqual(2);
  }
  expect(exercised, 'no popup was closed mid-auto-pan, so nothing exercised the bug').toBeGreaterThan(0);
});

test('a popup opened during the fence snap-back still lands inside the map (#29)', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 360, height: 740 });
  await useFixture(page, FIXTURE_CORNERS);
  await page.goto('/index.html');
  await expectMarkers(page, 5);
  const fence = await page.evaluate(() => window.__rwp.fence().toBBoxString());

  // Closing a popup restores the fence, which pans the map back inside it over ~250 ms. Opening the
  // next marker's popup 50 ms into that pan is an ordinary two-tap sequence, and it is the one that
  // clips: in review testing 4 of ~80 popups opened this way ended up outside the map.
  const runs = await page.evaluate(async () => {
    const { map, markers } = window.__rwp;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const state = () => {
      // A closed popup lingers for its 200 ms fade; the open one is always the last child.
      const popup = document.querySelector('.leaflet-popup-pane > .leaflet-popup:last-child');
      if (!popup) return 'no popup';
      const p = popup.getBoundingClientRect();
      const m = document.getElementById('map').getBoundingClientRect();
      return p.top >= m.top && p.left >= m.left && p.right <= m.right && p.bottom <= m.bottom
        ? 'inside' : `outside: popup ${[p.left, p.top, p.right, p.bottom]} map ${[m.left, m.top, m.right, m.bottom]}`;
    };
    const out = [];
    for (let round = 0; round < 2; round++) {
      for (let i = 0; i < markers.length; i++) {
        const next = (i + 1) % markers.length;
        map.closePopup(); await sleep(600);
        map.setView(markers[i].getLatLng(), map.getMinZoom() + 2, { animate: false }); await sleep(300);
        markers[i].openPopup(); await sleep(500); // auto-panned; the fence is loose for it
        map.closePopup();                          // the fence restore pan starts
        await sleep(50);
        // Same guard as the auto-pan test: an overrunning timer would open the popup on a settled
        // map, which is the case that always worked.
        const midPan = !!(map._panAnim && map._panAnim._inProgress);
        markers[next].openPopup();
        await sleep(1200);                         // every pan this set off has finished
        out.push({ round, from: i, to: next, midPan, state: state() });
      }
    }
    map.closePopup();
    return out;
  });

  // Read once each, on a map that has stopped moving: polling until a popup happens to be inside
  // would pass on one that is only briefly in view while the pan carries it back out.
  let exercised = 0;
  for (const run of runs) {
    if (!run.midPan) continue;
    exercised += 1;
    expect(run.state, `round ${run.round}, marker ${run.from} -> ${run.to}`).toBe('inside');
  }
  expect(exercised, 'no popup opened mid-pan, so nothing exercised the bug').toBeGreaterThan(0);

  await expect.poll(() => page.evaluate(() => window.__rwp.map.options.maxBounds.toBBoxString())).toBe(fence);
});

// Drags the map from a point clear of the popup and the controls, sampling whether an animated pan
// is running at each step. Returns one boolean per step.
async function panSamplesWhileDragging(page) {
  const box = await page.locator('#map').boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height - 60; // below the popup, clear of the zoom and attribution controls
  await page.mouse.move(x, y);
  await page.mouse.down();
  const samples = [];
  for (const dx of [-12, -24, -36, -48, -60, -72]) {
    await page.mouse.move(x + dx, y - dx / 2);
    await page.waitForTimeout(30);
    samples.push(await page.evaluate(() => {
      const anim = window.__rwp.map._panAnim;
      return !!(anim && anim._inProgress);
    }));
  }
  await page.mouse.up();
  return samples;
}

// Guards the fix for #29 rather than the bug it fixes: deferring work until the map settles is only
// safe if "settled" excludes a map the reader has hold of. Leaflet stops the running pan at the top
// of its own dragstart handler and fires moveend from in there, so work keyed on moveend alone
// resumes mid-gesture and animates against the finger — measured at 5 of 6 samples mid-drag.
test('grabbing the map during a popup pan never starts a pan of its own (#29)', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 360, height: 740 });
  await useFixture(page, FIXTURE_CORNERS);
  await page.goto('/index.html');
  await expectMarkers(page, 5);
  const fence = await page.evaluate(() => window.__rwp.fence().toBBoxString());

  for (let i = 0; i < 5; i++) {
    // Centring on a fence corner leaves the marker off-centre, so its popup has to auto-pan.
    await page.evaluate((n) => {
      const { map, markers } = window.__rwp;
      map.closePopup();
      map.setView(markers[n].getLatLng(), map.getMinZoom() + 2, { animate: false });
    }, i);
    await page.waitForTimeout(400);

    // Grab the map 30 ms into the popup's own auto-pan. Past ~100 ms the pan has covered enough
    // ground that the popup already fits and there is nothing left to provoke, so the grab has to
    // be early.
    await page.evaluate((n) => window.__rwp.markers[n].openPopup(), i);
    await page.waitForTimeout(30);
    expect(await panSamplesWhileDragging(page), `marker ${i}: a pan ran while the map was dragged`)
      .toEqual([false, false, false, false, false, false]);
  }

  // Not asserted here: grabbing the map in the moments after a popup *closes* does animate a pan
  // against the drag. That is Leaflet's own maxBounds handling (dragstart calls map._stop(), whose
  // moveend re-enters _panInsideMaxBounds) and it does the same on the code this change replaces,
  // so it is a separate, pre-existing paper cut rather than anything #29 introduced.

  // The fence is still exactly its own bounds, and the map is inside it, after all that.
  await page.evaluate(() => window.__rwp.map.closePopup());
  await expect.poll(() => page.evaluate(() => window.__rwp.map.options.maxBounds.toBBoxString())).toBe(fence);
  await expect.poll(() => page.evaluate(() => window.__rwp.fence().contains(window.__rwp.map.getCenter()))).toBe(true);
});

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
