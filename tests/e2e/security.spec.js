// Security e2e tests (#14): every value that reaches the page is rendered as text, and
// each page carries the exact Content-Security-Policy it is supposed to.
const { test, expect } = require('@playwright/test');
const {
  installHooks, FIXTURE_3, FIXTURE_XSS, useFixture, expectMarkers, clickMarker, listRow
} = require('./helpers');

installHooks();

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
