// Privacy and footer e2e tests: the privacy policy's required sections (R6), the links
// back to each map, the CaliCoders credit (#20), and that the site stores nothing (R1.6).
const { test, expect } = require('@playwright/test');
const { installHooks, FIXTURE_3, FIXTURE_EMPTY, useFixture, expectMarkers } = require('./helpers');

installHooks();

test('footer credits CaliCoders LLC above the privacy link (#20)', async ({ page }) => {
  await useFixture(page, FIXTURE_EMPTY);
  await page.goto('/index.html');

  const credit = page.locator('footer .credit');
  await expect(credit).toBeVisible();
  await expect(credit).toHaveText(
    'Security research brought to you by CaliCoders LLC, a security first managed service provider ' +
    'based in Redlands, where our goal is to create a safer, more secure internet for not only our ' +
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

test('privacy page links back to every map', async ({ page }) => {
  await page.goto('/privacy.html');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Privacy policy');
  const footer = page.locator('footer');
  await expect(footer.getByRole('link', { name: 'WiFi map' })).toHaveAttribute('href', 'index.html');
  await expect(footer.getByRole('link', { name: 'Bluetooth devices' })).toHaveAttribute('href', 'bluetooth.html');
  await expect(footer.getByRole('link', { name: 'Flock cameras' })).toHaveAttribute('href', 'flock.html');
});

test('privacy page covers every required section (R6)', async ({ page }) => {
  await page.goto('/privacy.html');
  await expect(page.locator('header time')).toHaveAttribute('datetime', /^\d{4}-\d{2}-\d{2}$/);

  const sections = {
    '#published': [/SSID/, /BSSID/, /Auth mode/, /Channel/, /Approximate location/, /First seen/],
    '#not-collected': [/No personal information/i],
    '#how': [/beacon/i, /never connects/i],
    // /private repository/ and /first batch/ are the #30 cutover: new scan files are
    // private, and the page must keep saying the first 48 are still in public history.
    '#where': [/92373/, /92374/, /thrown away/i, /opted out/i, /history/i,
               /private repository/i, /first batch is still public/i],
    '#opt-out': [/_nomap/, /_optout/, /uppercase\s+or\s+lowercase/i, /not remembered/i],
    '#removal': [/do not need to email/i, /Issues are public/i, /removal is remembered/i, /never add it back/i],
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
