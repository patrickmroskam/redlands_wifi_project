---
title: "feat: CaliCoders LLC credit line in the main page footer"
type: feat
status: active
date: 2026-09-17
issue: 20
---

# feat: CaliCoders LLC credit line in the main page footer

**Target repo:** patrickmroskam/redlands_wifi_project · Issue #20 (part of #1)

## Summary

Add the owner's credit sentence to the `index.html` footer, directly above the "Privacy policy & opt-out" link. Only "CaliCoders LLC" is a link (`https://www.calicoders.com`, `target="_blank"`, `rel="noopener noreferrer"`).

## Decisions

- **Main page only.** The issue reads "above the privacy policy" as the main-page footer link. `privacy.html` keeps its footer unchanged (the issue's comment asked to decide; the policy page stays policy-only, and its pinned CSP is untouched). If the owner wants it on both pages, it is a one-paragraph copy.
- **Wording** exactly as in the issue ("security first" unhyphenated).
- **Styling:** reuse the footer's existing amber link colour and the `.fine`-style dim text for the sentence so it reads as a credit, not a heading. `overflow-wrap: anywhere` so it wraps at 320–360 px.
- **No CSP change:** a plain `<a>` is navigation, not a fetch. No logo, no `utm_*`, no script (R1.6).

## Implementation units

1. `index.html` — new `<p class="credit">` as the first child of `<footer class="footer">`.
2. `assets/site.css` — `.credit` rule (dim green text, max-width for readable line length, wrap).
3. `tests/e2e/site.spec.js` — one test: link text/href/target/rel, only one link in the credit, the full sentence, and the credit precedes the privacy link in the footer. The existing R1.4 overflow test already covers `/index.html` at 320/360/768/1280 px, and the CSP/external-origin test covers the no-third-party rule.

## Verification

`python3 -m unittest discover -s tests -v && npx playwright test` green locally and in CI.
