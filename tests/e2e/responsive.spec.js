// Responsive QA (R1.4, #7): every page at phone, tablet and desktop widths.
const { test, expect } = require('@playwright/test');
const { installHooks, FIXTURE_CATEGORIES, useFixture, expectMarkers } = require('./helpers');

installHooks();

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
