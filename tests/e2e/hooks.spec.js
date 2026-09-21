// The shared hooks in helpers.js are opt-in: a spec gets the CSP guard and the tile abort only
// if it calls installHooks() (#57). These tests make forgetting the call, or the guard going
// deaf, fail the suite instead of passing silently.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { installHooks } = require('./helpers');

installHooks();

test('every spec file calls installHooks() at its top level', () => {
  const specs = fs.readdirSync(__dirname).filter((name) => name.endsWith('.spec.js'));
  // Guard against a vacuous pass if the directory read ever finds nothing.
  expect(specs).toContain(path.basename(__filename));
  // An unindented, uncommented call: a commented-out one must not count.
  const missing = specs.filter((name) =>
    !/^installHooks\(\);?[ \t]*$/m.test(fs.readFileSync(path.join(__dirname, name), 'utf8')));
  expect(missing, `spec files without a top-level installHooks() call: ${missing.join(', ')}`).toEqual([]);
});

test('the CSP guard records a real Content-Security-Policy violation', async ({ page }) => {
  // Same origin as the site, so no real request leaves the machine; the page's own CSP forbids
  // the inline script it carries.
  await page.route('**/__csp-probe.html', (route) => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src \'none\'">'
      + '<script>document.title = "ran";</script>',
  }));
  await page.goto('/__csp-probe.html');
  await expect.poll(() => page.cspViolations.length).toBeGreaterThan(0);
  expect(await page.title()).not.toBe('ran');
  // The guard caught it; clear the record so this test's own afterEach passes.
  page.cspViolations = [];
});
