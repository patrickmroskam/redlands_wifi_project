---
title: Redlands Wifi Project — Product Spec
status: ratified            # draft | ratified (PO acts only against ratified) — human flips to ratified
ratified_by: Patrick Roskam (OH HAI ask msg_23db0887-cc11-4cc9-a7b6-a51677dc6467)
ratified_at: 2026-09-17T19:19:36Z
---

# Redlands Wifi Project — Product Spec

> Transcribed 2026-09-16 from the owner's brief (chat). Wording, IDs, and a few
> implementation choices (ZCTA polygons, `_nomap` opt-out, GitHub Issues as the
> removal channel) are the transcriber's; the owner ratifies by flipping `status`.

## Vision
A public, one-page, fully responsive website in a retro "hacker terminal" style that
plots every WiFi network observed by the owner's wardriving rig on a map of Redlands,
California — like wigle.net, but deliberately fenced to ZIP codes 92373 and 92374.
There are no accounts. The owner uploads raw WiGLE-format log files to a separate
**private** inbox repository; a once-a-day job ingests them into a committed database,
drops anything outside Redlands or already known, deletes the processed files from the
inbox, and the site redeploys. Hosting is GitHub Pages (already enabled: `main` branch,
repo root, https://patrickmroskam.github.io/redlands_wifi_project/).

## Requirements

> **Amended 2026-09-20 (issue #44, after PR #43).** The raw-log inbox moved out of this
> public repo to the private repository `patrickmroskam/redlands_wifi_inbox`, on the
> owner's option-C ruling on #22 (#30). The constitution invariant was amended and
> ratified in the `private-inbox` ask; this spec was not, so R3, R4.1, R4.9, R7.2 and
> R8.3 described an architecture that no longer existed. They are re-worded below
> against the shipped design. Requirement IDs are unchanged.
>
> **R4.9 is the one change of substance and is NOT yet ratified** — see the note under
> it. Everything else here is the spec catching up to a decision the owner already made.

### R1. One-page site shell with an HTML/CSS banner
A single responsive page whose hero banner reads "Redlands Wifi Project", built from
markup and CSS only, in a retro / hacker aesthetic.
- R1.1 — THE SYSTEM SHALL serve the whole product from one page (`index.html` at the repo root) plus a linked privacy page.
- R1.2 — THE SYSTEM SHALL render the main banner text "Redlands Wifi Project" using HTML and CSS only (no raster or SVG image file for the banner).
- R1.3 — THE SYSTEM SHALL use a retro terminal / hacker palette (dark background; phosphor green and/or amber accents; monospace type) consistently across the page.
- R1.4 — WHILE the viewport is 360 px wide or wider THE SYSTEM SHALL lay out the banner, map, stats, and footer without horizontal scrolling.
- R1.5 — THE SYSTEM SHALL show a clearly visible link to the privacy policy page from the main page.
- R1.6 — THE SYSTEM SHALL load with no third-party trackers, analytics, or cookies.

### R2. Map of observed networks, fenced to Redlands
An interactive map plotting every network in the database, constrained to the Redlands area.
- R2.1 — WHEN the page loads THE SYSTEM SHALL plot one marker per network in `data/networks.json`.
- R2.2 — THE SYSTEM SHALL restrict panning to the bounding box of ZIP codes 92373 and 92374 and set a minimum zoom so the user cannot zoom out beyond the Redlands area.
- R2.3 — WHEN a marker is selected THE SYSTEM SHALL show the network's SSID (or "hidden" when blank), BSSID, auth mode, channel, and first-seen timestamp.
- R2.4 — THE SYSTEM SHALL visually distinguish open networks from encrypted networks (WEP / WPA-family) by marker color, with a legend.
- R2.5 — THE SYSTEM SHALL display the total network count and the database's last-updated timestamp.
- R2.6 — THE SYSTEM SHALL use a tile source that needs no API key or account (e.g. OpenStreetMap / CARTO dark tiles) with proper attribution.
- R2.7 — IF `data/networks.json` fails to load THEN THE SYSTEM SHALL show an on-page error message instead of a blank map.

### R3. Upload folder (the private inbox repo)
A folder the owner puts raw wardrive files into, in a separate private repository; no
upload form on the site, no login.
- R3.1 — THE SYSTEM SHALL treat every file in the top folder of the inbox (except `README.md` and dotfiles such as `.gitkeep`) as a candidate wardrive log, where the inbox is the private repository `patrickmroskam/redlands_wifi_inbox`, checked out by the ingest job to the path named by `INBOX_DIR` (`inbox/` in CI).
- R3.2 — THE SYSTEM SHALL accept the WiGLE CSV 1.4 format as produced by the ESP32 Marauder (header line `WigleWifi-1.4,...`, then `MAC,SSID,AuthMode,FirstSeen,Channel,RSSI,CurrentLatitude,CurrentLongitude,AltitudeMeters,AccuracyMeters,Type`), regardless of file extension.
- R3.3 — THE SYSTEM SHALL document, in `ingest/README.md` and `docs/setup/private-inbox.md`, exactly how to add files (upload them to the private inbox repo, or push them there with git) in plain language, and SHALL keep the retired `ingest/` folder empty with its README pointing at the inbox.

### R4. Ingest pipeline (parse → filter → dedupe → append → delete)
A script that turns raw logs into the committed database and cleans up after itself.
- R4.1 — WHEN the pipeline runs THE SYSTEM SHALL parse every candidate file in the inbox (R3.1) and produce one candidate record per data row.
- R4.2 — IF a row's latitude/longitude is missing, non-numeric, or 0,0 THEN THE SYSTEM SHALL drop that row.
- R4.3 — IF a row's coordinates fall outside the boundary polygons of ZIP codes 92373 and 92374 (stored in the repo as GeoJSON, sourced from US Census ZCTA data) THEN THE SYSTEM SHALL drop that row.
- R4.4 — IF a row's `Type` is not `WIFI` THEN THE SYSTEM SHALL drop that row.
- R4.5 — IF a row's SSID ends with `_nomap` or `_optout` (case-insensitive) THEN THE SYSTEM SHALL drop that row.
- R4.6 — IF a row's BSSID (MAC) already exists in the database THEN THE SYSTEM SHALL drop that row (the existing record wins; no update).
- R4.7 — IF the same BSSID appears more than once within the batch THEN THE SYSTEM SHALL keep only the first occurrence.
- R4.8 — WHEN a row survives every filter THE SYSTEM SHALL append it to `data/networks.json` with at least: bssid, ssid, auth, channel, first_seen, lat, lon.
- R4.9 — WHEN a file has been processed THE SYSTEM SHALL delete it from the inbox it was read from, and SHALL publish the database changes *before* deleting it. WHERE the inbox is a separate repository the deletion is a second commit pushed to that repository; WHERE the inbox is this repository — the script's local default, `ingest/`, a developer-run affordance only, which never carries real logs (R7.2) — the deletion rides in the same commit as the database change.
  *R4.9 amended 2026-09-20 (issue #44) and **awaiting owner ratification.** It previously
  read "delete it from `ingest/` (in the same commit as the database change)" — an
  atomicity guarantee that cannot hold once the logs live in a different repository, which
  the owner's option-C ruling on #22 requires. The replacement is a weaker ordering
  guarantee: if a run dies between publishing and deleting, the logs stay in the inbox and
  the next run re-reads them, which is a no-op under the R4.6 BSSID dedupe. The other order
  would lose logs that were never published. Pinned by
  `test_the_database_is_published_even_when_the_inbox_push_fails`.*
- R4.10 — IF a file cannot be parsed as WiGLE CSV THEN THE SYSTEM SHALL leave that file in place, report it by name, and exit non-zero after processing the other files.
- R4.11 — WHEN the pipeline finishes THE SYSTEM SHALL print a summary: files processed, rows read, dropped per reason (bad coords / outside area / not wifi / opt-out / duplicate), and rows added.
- R4.12 — THE SYSTEM SHALL never write raw log contents, RSSI, altitude, or accuracy into the published database.

### R5. Daily scheduled ingest
A GitHub Actions job that runs the pipeline once a day and publishes the result.
- R5.1 — THE SYSTEM SHALL run the ingest pipeline on a daily cron schedule via GitHub Actions.
- R5.2 — THE SYSTEM SHALL also allow the job to be started manually (`workflow_dispatch`).
- R5.3 — WHEN the pipeline adds networks or deletes processed files THE SYSTEM SHALL commit and push those changes to `main` so GitHub Pages redeploys.
- R5.4 — IF the pipeline changes nothing THEN THE SYSTEM SHALL make no commit.
- R5.5 — THE SYSTEM SHALL request only the permissions the job needs (`contents: write`) in the workflow file.

### R6. Privacy policy page
A second page modeled on wigle.net's policy, adapted to this project.
- R6.1 — THE SYSTEM SHALL serve a privacy policy at `privacy.html`, linked from the main page and linking back.
- R6.2 — THE SYSTEM SHALL state what is collected and published for each network (SSID, BSSID, auth mode, channel, approximate location, first-seen time) and that no personal information is collected.
- R6.3 — THE SYSTEM SHALL explain that observations come from passive scanning of publicly broadcast beacons and that no network is ever connected to.
- R6.4 — THE SYSTEM SHALL describe the opt-out: append `_nomap` to the SSID and the network is dropped on the next ingest.
- R6.5 — THE SYSTEM SHALL provide a removal-request channel that needs no email account to be set up: a GitHub Issue on this repository.
- R6.6 — THE SYSTEM SHALL state that the site sets no cookies and uses no analytics.
- R6.7 — THE SYSTEM SHALL use the same retro theme and be responsive per R1.4.

### R7. Public-repo hygiene
This repo is public; nothing sensitive may land in it.
- R7.1 — THE SYSTEM SHALL contain no secrets, API keys, or `.env` files (a leaked `.env` was purged 2026-09-16).
- R7.2 — THE SYSTEM SHALL keep the published databases under `data/` as the only long-lived *observation* data in this repo (alongside its committed inputs: the boundary polygons, the removal denylist, and the Flock rules); and raw logs SHALL never be pushed to this repo — the ingest job reads them only from the private inbox, and deletes there each file it successfully processes (an unparseable file is deliberately kept, per R4.10). Keeping the inbox itself clear of anything but logs is the owner's obligation, not a property this repo can check. See the known consideration below for the 48 logs that predate the cutover.

### R8. Verification
- R8.1 — THE SYSTEM SHALL run the ingest pipeline's unit tests in CI on every pull request.
- R8.2 — THE SYSTEM SHALL include a browser smoke test (Playwright) that loads `index.html`, waits for the map, and asserts at least one marker renders from a fixture database.
- R8.3 — THE SYSTEM SHALL keep test fixtures out of `ingest/` so the pipeline never deletes a fixture, and SHALL never run the pipeline against real logs in tests or pull requests (the ingest job runs the unit tests *before* it checks the inbox out, has no `pull_request` trigger, and refuses to run off `main`). Keeping fixtures out of the private inbox is the owner's obligation.

### R9. Device maps (Bluetooth and Flock cameras)
*Added 2026-09-20 by owner request, after new wardriving hardware began logging BLE rows.
Supersedes the "Bluetooth / BLE / cell records (WIFI only)" line in Out of Scope, which is
struck through below. Mapping only — no stats, breakdown, or per-device pages.*
- R9.1 — THE SYSTEM SHALL serve a Bluetooth map at `bluetooth.html` and a Flock camera map at `flock.html`, in the same retro theme, fenced to the same ZIP polygons as the main map.
- R9.2 — WHERE a BLE observation's address may be a rotating private address (resolvable or non-resolvable) THE SYSTEM SHALL NOT publish it, so the map records devices rather than the people who passed by.
- R9.3 — THE SYSTEM SHALL publish a BLE device with only: address, advertised name, approximate location, and first seen — never RSSI, altitude, accuracy, auth mode, or channel.
- R9.4 — THE SYSTEM SHALL mark an observation as a Flock camera only when it matches a rule in `data/flock-rules.json`, and SHALL record on each published camera which rule matched it.
  *Amendment **proposed** 2026-09-23 (cycle 19), **awaiting owner ratification**: add "…and every
  rule SHALL be a full six-octet address matching one device, never a shorter vendor prefix."
  This is how the shipped rule is already written (#70) and why; a vendor prefix would publish a
  resident's Ring doorbell as a camera, because the firmware's own Flock OUI list contains USI
  `08:3a:88`, which matches one in this project's real data. The invariant currently lives only in
  `data/flock-rules.json`'s comment and `flock.html`'s visitor copy, neither of which an actor
  must read.*
- R9.5 — WHERE a row matches a Flock rule THE SYSTEM SHALL publish it to `data/flock.json` in addition to the database its Type selects, never instead of it.
- R9.6 — THE SYSTEM SHALL apply the same fence, `_nomap` / `_optout` opt-out, removal denylist, and BSSID dedupe to every database.
- R9.7 — THE SYSTEM SHALL link the two device maps, the privacy policy, and the source repository from the footer of every page.
- R9.8 — THE SYSTEM SHALL disclose in the privacy policy what the Bluetooth map publishes and which observations it deliberately leaves out.

### R10. Network kinds and per-kind map filter (post-v1)
*Added 2026-09-21 by the owner's answer `build` to OH HAI ask `msg_7929ff83`, with the instruction
"Add the filters so it can be toggled on and off for each type of network". Issue #65. Post-v1: it
does not gate the v1 Definition of Done. Main map only; the Bluetooth and Flock maps are unchanged.
"Type of network" is read as the kind axis below, not the security categories. The owner may
correct that reading.*
- R10.1 — THE SYSTEM SHALL classify every plotted network into exactly one kind: `Vehicle`, `Phone / hotspot`, `Wi-Fi Direct / printer`, `Default-looking`, `Hidden` (blank SSID), or `Named` (everything else), from its SSID, in the browser.
- R10.2 — THE SYSTEM SHALL show the kind split in the breakdown under the map, with counts and shares that sum to the plotted total.
- R10.3 — THE SYSTEM SHALL offer one on/off toggle per kind on the main map, all on by default. WHEN a kind is toggled off, THE SYSTEM SHALL hide that kind's markers, and WHEN it is toggled back on, THE SYSTEM SHALL show them again. The breakdown keeps describing the whole database.
- R10.4 — THE SYSTEM SHALL keep each kind's SSID patterns in one list, with a comment per pattern, and SHALL unit-test them against real SSID shapes, both hits and near-misses.
- R10.5 — THE SYSTEM SHALL NOT change `data/*.json`, its published fields, or the ingest to support R10.

## Release Criteria (v1 Definition of Done)
- [x] R1 — one page, HTML/CSS banner, retro theme, responsive, privacy link
- [x] R2 — map shows every network from the database, fenced to 92373/92374, popups + legend + stats
- [x] R3 — raw logs go to the private inbox repo, with a plain-language README (`ingest/` retired and empty, its README pointing there)
- [x] R4 — pipeline: boundary filter, WIFI-only, `_nomap` opt-out, BSSID dedupe, append, delete processed files, loud failure on bad files
- [x] R5 — daily GitHub Actions ingest that commits to `main` and triggers a Pages redeploy — **met 2026-09-21** (issue #61). Both outstanding items are done, in the order the workflow requires. (a) `INBOX_TOKEN` now authenticates: the owner replaced it, and the `Check out the private inbox` step succeeds (#48). (b) The repository variable `INGEST_SCHEDULE` is set to `on`, so the 10:00 UTC cron no longer skips — it must be a **repository** variable, because the job-level `if` is evaluated before the `ingest` environment resolves. Verified end to end by a real `workflow_dispatch` run on `main` ([35549848194](https://github.com/patrickmroskam/redlands_wifi_project/actions/runs/35549848194)): 8,393 rows read from 2 logs, 3,883 published (+2,234 networks, +1,649 Bluetooth), the processed logs deleted from the private inbox, commit `f81a645` pushed to `main`, and Pages confirmed built for that commit. The private-inbox cutover itself (#30) shipped in PR #43.
- [x] R6 — privacy policy page modeled on wigle.net
- [x] R7 — no secrets; raw logs never enter this repo (private inbox since PR #43)
- [x] R8 — unit tests + Playwright smoke test green in CI
- [x] R9 — Bluetooth and Flock maps, rotating BLE addresses excluded, rule-driven cameras, footer links, privacy disclosure
- [x] The initial batch of wardrive logs pushed on 2026-09-16 has been ingested and the live site shows them

## Out of Scope (v1)
- User accounts, login, or a web upload form
- Any area outside ZIP codes 92373 and 92374
- ~~Bluetooth / BLE / cell records (WIFI only)~~ — **superseded 2026-09-20 by owner request: see R9.** Cell (GSM/LTE) records remain out of scope.
- Updating an existing record when re-observed (signal trails, last-seen, RSSI heatmaps)
- Search, filtering, or per-network detail pages — **except the per-kind map toggles, added post-v1 by owner request on 2026-09-21: see R10.**
- Custom domain, CDN, or any hosting other than GitHub Pages
- Removing rows from the database automatically on takedown (handled by a human via issue → PR)

## Known consideration (not a requirement)
This was the concern that raw files pushed to `ingest/` pass through this public repo's
git history before filtering, so the drive route, RSSI and out-of-area rows stay visible
in history even after the pipeline drops them. **The owner took the fix** (option C on
#22): since PR #43 the logs go to a private repo and never enter this one, so nothing new
is added to public history.

The fix is **forward-only.** The 48 logs pushed before the cutover are still in this
repo's git history; emptying `ingest/` did not remove them. Rewriting that history is
deliberately not part of the cutover: it is destructive, irreversible, and does nothing
about clones that already exist, so it needs its own issue and its own review. **That issue is
[#63](https://github.com/patrickmroskam/redlands_wifi_project/issues/63)**, filed 2026-09-21 by
the Product Owner at `p2` + `needs-human` (bookkeeping corrected 2026-09-23, cycle 19 — this
paragraph still read "not filed yet" for two days after it was filed). The owner has authorised
a rewrite in principle (the `private-inbox` ask, reply "Rewrite history"); no actor runs it
unattended.
