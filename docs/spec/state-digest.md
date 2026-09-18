---
last_reconciled_at: 2026-09-18T07:39:00Z
cycle: 2
net_open_history: [8, 8]
polish_backlog_depth: 0
---

# Redlands Wifi Project — state digest (PO working memory)

> Regenerable projection. Source of truth: GitHub (state) + decision-log (rationale).
> Cycle 1 was a **full rebuild** (digest absent on first product-owner run): all 23
> issues scanned, no delta watermark applied. Next full rebuild due at cycle 10.

## Cycle 2 delta (watermark 2026-09-18T01:43:42Z → 07:39Z): **empty**

Nothing moved in the six hours since cycle 1. The only issue touched since the
watermark is #1, by cycle 1's own body edit (`updatedAt 01:43:43Z`). No new issues, no
new comments, **0 open PRs**, no merges, no pushes beyond cycle 1's own `ec09a4b`, and
**no hub message newer than cycle 1's notify** `msg_8f830af8` (01:46:45Z) — so no owner
reply of any kind. CI green on the last push; the `Ingest wardrive logs` schedule is
still recorded as *skipped*. Every section below therefore stands as written at cycle 1,
with the re-verifications noted inline.

## Site & map (PRD R1, R2)

- open: 1 (p0:0 p1:0 p2:0 p3:1), launch-blockers: 0, in-flight: 0
- notable: complete and live. Re-verified 2026-09-18 07:40Z: HTTP 200, 18,152 records served, `updated_at` + `count` top-level in the database and rendered at `assets/map.js:278` (**R2.5** ✅). Shipped #2 (scaffold + fenced map), #7 (retro polish + responsive), #11 (canvas renderer for ~18k markers), #12 (security pie), #13 (category list), #20 (footer credit). Only residual is #29 (p3, popup-pan edge cases). Verified live 2026-09-18 01:39Z: HTTP 200, 18,152 networks rendered, legend present, no third-party requests, CSP `default-src 'none'` with `script-src 'self'`.

## Ingest pipeline (PRD R3, R4)

- open: 2 (p0:0 p1:0 p2:1 p3:1), launch-blockers: 0, in-flight: 0
- notable: pipeline complete — #3 (parse/fence/dedupe/append/delete), #15 (canonical BSSID dedupe), #27 (`data/removed.json` denylist), #8 (backfill: +18,152 from 48 logs). 100 unit tests pass locally. `ingest/` holds only `README.md` + `.gitkeep`. **#30 (p2, `waiting`) is the project's single blocking issue** — the private raw-log inbox, owner-only setup; its three-part existence gate was re-run at cycle 2 (07:39Z) and is still **all negative** (no inbox repo, no `ingest` environment, 0 secrets). #25 (p3) is a residual.

## Automation / daily publish (PRD R5)

- open: 0 tracked directly, launch-blockers: 0, in-flight: 0
- notable: **the one unmet v1 Release Criterion.** `.github/workflows/ingest.yml` exists and is correct, but its `schedule` trigger is gated on `vars.INGEST_SCHEDULE == 'on'` and that variable does not exist (`actions/variables` → `total_count: 0`), so every scheduled run is skipped — confirmed in the Actions history ("Ingest wardrive logs" → *skipped*). The workflow comment attributes the flip to #8, which closed without setting it. Cycle 1 gave this last mile an owner by folding it into #30's acceptance (it must follow the inbox cutover so new logs never land in the public repo). Harmless today: `ingest/` is empty, so nothing is queued.

## Privacy & security (PRD R6, R7)

- open: 2 (p0:0 p1:0 p2:1 p3:1), launch-blockers: 0, in-flight: 0
- notable: **R4.12 spot-checked against the live published database at cycle 2** — all 18,152 records carry exactly `bssid, ssid, auth, channel, first_seen, lat, lon`; no RSSI, altitude, accuracy or raw-log field is published. #6 (privacy page) and #14 (security audit — vendored Leaflet, `'self'`-only CSP, injection tests) shipped. #22 carries an **open PO closure proposal** (`addressed-in-#30`): the owner answered option C and the work moved to #30, so the decision issue is spent. #21 (p3) is owner-only GitHub account settings, no ask ever sent.

## Hosting / custom domain (explicitly OUT of v1 scope)

- open: 1 (p0:0 p1:1 p2:0 p3:0), launch-blockers: 0, in-flight: 0
- notable: exposure **independently re-resolved at cycle 2 (07:38Z) and still live** — apex `A` still in the Pages range, `www` still CNAMEd, challenge TXT still absent, apex still 404, `repos/…/pages` → `cname: null`, `protected_domain_state: null`. Priority holds at p1. #17 was raised p2 → **p1** at cycle 1 for a live, independently re-verified security exposure: apex `A` records point at GitHub Pages (185.199.108-111.153) and `www` CNAMEs to `patrickmroskam.github.io`, but there is no `_github-pages-challenge-patrickmroskam` TXT, so the domain is unverified and unclaimed (`GET https://redlandswifiproject.com/` → 404 from Pages) — any GitHub user could claim it. Compounding it, the issue sits `waiting` on a `DONE custom-domain` reply **for which no OH HAI ask was ever sent** (its own 04:14Z comment says so): a silent deadlock. The p1 applies to the mitigation only; the domain switch itself remains out of v1 scope per the ratified PRD.

## Tests / CI (PRD R8)

- open: 1 (p0:0 p1:0 p2:0 p3:1), launch-blockers: 0, in-flight: 0
- notable: #4 shipped CI (Python 3.12 unit tests + Playwright chromium), ~40 s/run, SHA-pinned actions, green on the last 5 runs. #34 (p3) splits the >1,000-line e2e spec.

## Tracking

- #1 — v1 tracking issue, never assigned. Body corrected this cycle (spec status `draft` → ratified; R5 last mile added as an explicit unticked line).

## Closure activity (this period — project to date)

- proposed: 1 (#22, `addressed-in-#30`), closed: 14, contested: 0 — unchanged at cycle 2
- All 14 closes were dev-team ship-and-close, predating the PO. #22 is the first PO maker-checker proposal; its 48 h aging window runs to **2026-09-20T01:42Z**, so it does not close at cycle 2 either (earliest sweep: cycle 4, ~2026-09-19T19:38Z, is still inside the window — first eligible pass is cycle 5, ~2026-09-20T07:38Z).
