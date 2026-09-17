---
title: "fix: Verify and harden BSSID dedupe"
type: fix
status: active
date: 2026-09-17
origin: docs/spec/PRD.md
issue: 15
---

# fix: Verify and harden BSSID dedupe

## Summary

Make the BSSID the single, canonical identity of a network everywhere: in the
ingest pipeline (rows and the stored database) and on the site (defense in
depth). Record real-batch dry-run numbers before the backfill (#8).

## Problem Frame

`scripts/ingest.py` dedupes on `MAC.strip().lower()`. That is enough for the
Marauder's own output, but `AA-BB-…`, `aabb.cc…` and bare `aabbcc…` spellings of
the same address would be treated as distinct networks, and a MAC that isn't a
MAC at all (wrong length, non-hex) is stored as-is. The pipeline also trusts the
stored database: a duplicate that got in by hand (a removal PR gone wrong, a
merge) is silently kept and grows the map. The site renders every record, so any
duplicate becomes two markers.

## Requirements

- PRD R4.6 / R4.7 and the constitution invariant: dedupe key is the BSSID; an existing record is never overwritten.
- Issue #15 checklist: normalization, stored-database duplicates, site-side dedupe, real-data dry run, mesh/dual-band documentation, concurrency.

## Key Technical Decisions

- **Canonical form `xx:xx:xx:xx:xx:xx`.** `normalize_bssid()` accepts six
  2-hex groups joined by one consistent `:` or `-`, three 4-hex groups joined by
  `.`, or 12 bare hex digits, case-insensitive, surrounding whitespace ignored.
  Anything else returns `None`, and the row is dropped as `malformed`.
- **Stored database is validated on load; problems are fatal (exit 2).** A
  stored BSSID that is malformed, or two records whose BSSIDs normalize to the
  same address, stop the run before anything is written or deleted. The report
  lists the offending BSSIDs. Rationale: the database is hand-edited only via
  removal PRs; "keep first and carry on" would silently publish a bad file every
  day, while a red job plus untouched logs is loud and loses nothing. The fix is
  a human PR.
- **Non-canonical but valid stored spellings are accepted, not rewritten.**
  They still count as known (no overwrite, per the invariant). A unit test on the
  committed `data/networks.json` requires canonical, unique BSSIDs so a hand
  edit is caught in CI at PR time.
- **Duplicate count split in the summary.** The `duplicate` line stays (R4.11),
  followed by `in database` / `in this batch` sub-lines.
- **Site dedupe key** = lower-cased hex digits of the BSSID (separators
  stripped). First record wins, the stats line counts unique networks, and a
  console warning reports how many duplicates were skipped. Records with no
  usable BSSID still render (the pipeline never writes them; the site should
  not hide data because of a key it doesn't need).
- **Same SSID, different BSSID = different networks** (mesh nodes, dual-band
  radios). Documented in `docs/dedupe.md` and pinned by a unit test.
- **Concurrency is already handled** by #5's `concurrency: ingest` group
  (queue, not cancel) and the branch-tip checkout; nothing to add.

## Implementation Units

1. `scripts/ingest.py`: `normalize_bssid`, `stored_bssids` (fatal checks),
   classify uses the canonical form, duplicate sub-counts, opt-out check uses the
   canonical form.
2. `tests/test_ingest.py`: variants, malformed MACs, batch/cross-batch
   duplicates, stored duplicates and malformed stored BSSIDs (fatal, nothing
   touched), mesh/dual-band, committed database check.
3. `assets/map.js`: dedupe before plotting; `tests/fixtures/networks-dup.json`
   + Playwright test (exactly one marker per BSSID, count shows unique).
4. `docs/dedupe.md`: rules, decisions, and the real-batch dry-run numbers.

## Verification

`python3 -m unittest discover -s tests -v && npx playwright test`; a dry run
(`--dry-run`) on a scratch copy of `ingest/` (never the real files).
