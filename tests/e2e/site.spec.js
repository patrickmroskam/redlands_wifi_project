// Browser smoke tests for the one-page site (PRD R1, R2, R8.2).
// Fixtures live in tests/fixtures/ — never in ingest/ (R8.3).
const { test, expect } = require('@playwright/test');
const path = require('path');

const FIXTURE_3 = path.join(__dirname, '..', 'fixtures', 'networks-3.json');
const FIXTURE_EDGE = path.join(__dirname, '..', 'fixtures', 'networks-edge.json');
const FIXTURE_XSS = path.join(__dirname, '..', 'fixtures', 'networks-xss.json');
const FIXTURE_DUP = path.join(__dirname, '..', 'fixtures', 'networks-dup.json');
const FIXTURE_CORNERS = path.join(__dirname, '..', 'fixtures', 'networks-corners.json');

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

test('duplicate BSSIDs in the database render one marker per network (#15)', async ({ page }) => {
  const warnings = [];
  page.on('console', (msg) => { if (msg.type() === 'warning') warnings.push(msg.text()); });
  await useFixture(page, FIXTURE_DUP);
  await page.goto('/index.html');

  // Seven records: two spellings of ...:21, two of ...:22, a mesh sibling ...:23 (a distinct network),
  // and two records with no BSSID, which are still shown and never merged with each other.
  await expect(page.locator('#stats')).toContainText('5 networks mapped');
  await expect(page.locator('path.net-marker')).toHaveCount(5);
  // The first record of each BSSID wins; the later (open) copies are never drawn.
  await expect(page.locator('path.net-open')).toHaveCount(0);
  const bssids = await page.evaluate(() =>
    window.__rwp.markers.map((m) => m.getPopup().getContent().querySelectorAll('dd')[1].textContent));
  expect(bssids).toEqual(['aa:bb:cc:00:00:21', 'aa:bb:cc:00:00:22', 'aa:bb:cc:00:00:23', '—', '—']);
  expect(warnings).toContain('Skipped 2 duplicate network record(s) (same BSSID).');
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

// Security (#14): every field that reaches the page is rendered as text.
test('every popup field and the stats line render HTML payloads as text', async ({ page }) => {
  await useFixture(page, FIXTURE_XSS);
  await page.goto('/index.html');
  await expect(page.locator('path.net-marker')).toHaveCount(1);

  // updated_at is not a date, so the stats line echoes it verbatim — as text.
  await expect(page.locator('#stats')).toHaveText(
    '> 1 network mapped · last updated <img src=x onerror="window.__xss=\'updated_at\'">');
  await expect(page.locator('#stats *')).toHaveCount(0);

  await page.locator('path.net-marker').click();
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
    if (pagePath === '/index.html') await expect(page.locator('path.net-marker')).toHaveCount(3);
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
  await expect(page.locator('path.net-marker')).toHaveCount(3);
  expect(await context.cookies()).toEqual([]);
  expect(await page.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0);
});

// Responsive QA (R1.4, #7): both pages at phone, tablet, and desktop widths.
for (const pagePath of ['/index.html', '/privacy.html']) {
  for (const width of [360, 768, 1280]) {
    test(`no horizontal overflow at ${width} px on ${pagePath} (R1.4)`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 740 });
      await useFixture(page, FIXTURE_3);
      await page.goto(pagePath);
      if (pagePath === '/index.html') await expect(page.locator('path.net-marker')).toHaveCount(3);
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
  await expect(page.locator('path.net-marker')).toHaveCount(3);
  const fence = await page.evaluate(() => window.__rwp.fence().toBBoxString());
  const zoom = await page.locator('.leaflet-control-zoom').boundingBox();
  const mapBox = await page.locator('#map').boundingBox();

  // A real tap on the first marker, then each popup in turn (switching closes the previous one).
  await page.locator('path.net-marker').first().click();
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
      await expect(page.locator('path.net-marker')).toHaveCount(5);
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
  await expect(page.locator('path.net-marker')).toHaveCount(3);
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
