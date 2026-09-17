---
title: "feat: Privacy policy page"
type: feat
status: active
date: 2026-09-17
origin: docs/spec/PRD.md
issue: 6
---

# feat: Privacy policy page

## Summary

Replace the `privacy.html` stub with the full policy (PRD R6), in the site's
retro theme, written in our own words in the spirit of wigle.net's policy.

## Requirements

- R6.1 page at `privacy.html`, linked from the map and linking back.
- R6.2 what is published per network (SSID, BSSID, auth mode, channel,
  approximate location, first-seen time); no personal information.
- R6.3 passive observation of publicly broadcast beacons; never connects.
- R6.4 opt-out with `_nomap` (the pipeline also honours `_optout`).
- R6.5 removal requests via a GitHub Issue (new-issue link), no email needed.
- R6.6 no cookies, no analytics, no accounts; plus the third-party disclosure
  from #14 / PR #9: OpenStreetMap tile servers (and GitHub Pages as host) see a
  visitor's IP address and the site origin.
- R6.7 same theme, no horizontal scroll at 360 px and desktop.
- Scope: only ZIP 92373 / 92374; everything else is dropped at ingest.
- A "last updated" date.

## Decisions

- **Be accurate about what exists today.** The opt-out stops a network being
  *added*; it does not remove one already on the map (PRD out-of-scope:
  automatic removal) — the page says so and points to a removal request.
- **Raw upload files.** Until the owner decides #22, raw logs pass through the
  public repo (and its history) before processing. The policy states this
  plainly rather than implying out-of-area rows vanish; #22 gets a note that the
  wording should follow its decision.
- **Removal issues are public.** Tell people to include only the BSSID or
  network name and a rough location, nothing personal.
- The page stays script-free, so its CSP (`default-src 'none'; style-src
  'self'; img-src 'self'`) is unchanged and the exact-CSP test still holds.
  External links use `rel="noopener noreferrer"`.

## Implementation units

1. `privacy.html` — full content: last-updated line, table of contents,
   sections (who, what's published, what isn't, how it's collected, where,
   opt-out, removal, visiting this site, changes), footer back link.
2. `assets/site.css` — prose styles: section headings, lists, definition list,
   table of contents; wraps long words at 360 px.
3. `tests/e2e/site.spec.js` — privacy test asserts every required section and
   key statement, the new-issue link, rel on external links, map ↔ privacy
   links both ways, and no horizontal overflow at desktop width too.

## Verification

`python3 -m unittest discover -s tests -v && npx playwright test`; a visual
check at 360 px and 1280 px.
