---
title: "sec: Site security audit and hardening"
type: fix
status: active
date: 2026-09-17
issue: 14
---

# sec: Site security audit and hardening (#14)

## Summary

Audit the public static site and the repo, fix what is reachable, and document what is accepted. The main fix is to vendor Leaflet so that the CSP allows only `'self'` for scripts and styles. The rest is a wider XSS and third-party-load test suite, a Dependabot config, and a written security record.

---

## Problem Frame

The site is a static GitHub Pages page. It renders untrusted strings (SSIDs and other logger fields) from `data/networks.json`. Its CSP currently allows every script and stylesheet on `https://cdnjs.cloudflare.com`. That host serves thousands of libraries, including old AngularJS builds with script gadgets. If an HTML injection ever appeared, it would not need an inline script to become code execution. SRI pins only the two Leaflet tags and does not narrow the CSP.

---

## Requirements

- R1.6: no trackers, cookies, or storage. Kept covered.
- R7.1: no secrets in the tree or history.
- Issue #14 acceptance: findings listed in the PR, each fixed or accepted with a reason. Every text-rendering surface has a Playwright HTML-injection test. CI is green.

---

## Audit Findings (input to this plan)

| # | Finding | Disposition |
|---|---|---|
| F1 | `script-src`/`style-src` allow all of cdnjs (a CSP bypass surface) | **Fix**: vendor Leaflet 1.9.4 and use `'self'` only |
| F2 | `img-src data:`; no `frame-ancestors` | **Accept**: Leaflet sets aborted tiles to `Util.emptyImageUrl` (a `data:` GIF). A meta CSP cannot carry `frame-ancestors`, and Pages cannot send headers. The site has no state-changing actions, so clickjacking has no impact. `default-src 'none'` already covers `object-src`. |
| F3 | Referrer to OSM | **Accept**: `strict-origin-when-cross-origin` sends only the origin, and OSM's tile policy requires a Referer. `img-src` allows only `tile.openstreetmap.org`. |
| F4 | Footer "Source" link has no `rel` | **Fix**: `rel="noopener noreferrer"` |
| F5 | XSS test covers only the SSID | **Fix**: payloads in every popup field plus `updated_at`, and a same-origin-only load test |
| F6 | No dependency update automation | **Fix**: `.github/dependabot.yml` (repo file, no settings change) |
| F7 | Settings: secret scanning and push protection are ON; Dependabot alerts and private vulnerability reporting are OFF | **Follow-up issue** (owner settings, human-in-the-loop) |
| F8 | Workflows: `contents: read` in CI; `permissions: {}` plus job-scoped write in ingest; SHA-pinned; no `pull_request_target` | **OK**. The PRD R5.5 wording still lags `pages: write` (accepted, noted). |
| F9 | Raw `ingest/` logs (RSSI, altitude, the owner's GPS drive trail with timestamps, out-of-area rows) are public on Pages until deleted and permanently in git history | **Owner decision**: follow-up issue, `needs-triage` |
| F10 | Secret scan of the tree and all 14 commits | Clean |

---

## Key Technical Decisions

- **Vendor, don't re-host from npm.** Fetch the exact cdnjs bytes the site already loads and verify them against the committed SRI sha256 values before committing. This means the bytes cannot change silently. Keep the `integrity` attributes as a tripwire: an edit to a vendored file without a hash update breaks the page and the tests.
- **Vendor only `leaflet.js`, `leaflet.css`, and a BSD-2 `LICENSE`.** The CSS refers to `images/*.png`, but those images are loaded only by `L.Icon.Default` and the layers control, and the site uses neither (it uses circleMarkers). Leave them out and document why.
- **Drop `crossorigin` on same-origin tags.** SRI works for same-origin resources without CORS.
- **Dependabot uses a monthly schedule with grouped updates** to limit PR noise in an autonomous repo.

---

## Implementation Units

### U1. Vendor Leaflet and tighten the CSP

**Goal:** remove the cdnjs trust.
**Files:** `assets/vendor/leaflet-1.9.4/{leaflet.js,leaflet.css,LICENSE}`, `index.html`, `privacy.html` (comment only if needed)
**Approach:** point the tags at `assets/vendor/...`, keeping `integrity`. The CSP becomes `script-src 'self'; style-src 'self'`. Add `rel="noopener noreferrer"` to the Source link (F4).
**Test scenarios:** covered in U2. The existing "map library failure" test still matches `leaflet.js`.
**Verification:** sha256 of the vendored files equals the old SRI values. No request to cdnjs when loading the page.

### U2. Security tests

**Files:** `tests/e2e/site.spec.js`, `tests/fixtures/networks-xss.json`
**Test scenarios:**
- A fixture record with `<img src=x onerror=...>`-style payloads in `bssid`, `ssid`, `auth`, `channel` (a string), and `first_seen`. The popup shows the literal text, contains no `img`/`script` elements, and `window.__xss` stays undefined.
- An `updated_at` payload shows as literal text in `#stats`, with no child elements.
- Every script and stylesheet request made by `index.html` and `privacy.html` is same-origin.
- The CSP meta on both pages contains `default-src 'none'` and no `unsafe-inline`, `unsafe-eval`, or `cdnjs`.
- The existing afterEach CSP-violation check stays in place.
**Verification:** full `ci_command` green.

### U3. Dependabot config

**Files:** `.github/dependabot.yml`
**Approach:** ecosystems `github-actions` (`/`) and `npm` (`/`), monthly, one group each.
**Test expectation:** none (config only). Validated by the YAML parse.

### U4. Security record

**Files:** `docs/security.md`, `.github/SECURITY.md`, `README.md` (link)
**Approach:** record findings F1–F10, the CSP rationale and its limits, the Leaflet upgrade procedure (fetch, compute sha256 SRI, update tags), the settings state, and how to report an issue. `.github/SECURITY.md` points network owners to the opt-out and GitHub Issues, and security reporters to a GitHub issue without exploit details until private reporting is enabled.
**Test expectation:** none (docs).

---

## Scope Boundaries

### Deferred to Follow-Up Work
- Enable Dependabot alerts and security updates, private vulnerability reporting, and "require SHA pinning" (owner settings). File a p3 issue; it follows the human-in-the-loop protocol when worked.
- The raw-log exposure in `ingest/` and git history (F9). File a p2 `needs-triage` issue for the owner.
- #12/#13 stats surfaces: they must add their own injection tests. Post a comment on those issues.

### Non-goals
- Changing Pages settings, touching `ingest/`, or running the real ingest.

## Assumptions (headless)
- Research agents were not dispatched. The audit read every site, test, and workflow file directly, and the repo is small (5 source files).
