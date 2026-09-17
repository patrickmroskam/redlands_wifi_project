---
title: "feat: remember removed networks with a committed BSSID denylist"
type: feat
status: active
date: 2026-09-17
issue: 27
---

# feat: remember removed networks with a committed BSSID denylist

**Target repo:** patrickmroskam/redlands_wifi_project · Issue #27 (part of #1)

## Summary

Removing a network from `data/networks.json` by hand does not stick: the next scan
that hears it adds it back. Add a committed denylist, `data/removed.json`, that the
ingest always honours, plus a small helper that performs a removal (delete the
record and add the BSSID in the same change).

## Decisions

- **File shape.** `{"removed": [{"bssid": "aa:bb:…", "date": "YYYY-MM-DD", "issue": 123}]}`.
  Exactly those three keys per entry. No SSID, no reason, no location, so the file
  itself says nothing about a person beyond the identifier that was already public.
- **Strict validation, fatal on any problem (exit 2).** The denylist protects privacy,
  so a broken one must stop the run rather than be half-applied. Fatal: the file is missing
  or unreadable, it has no `removed` list, an entry is not an object, an entry has extra or
  missing keys, a BSSID is malformed or not in canonical form, a date is not a real
  `YYYY-MM-DD` day, an issue is not a positive integer, or a BSSID is listed twice.
  **Missing is fatal too:** deleting the file by accident must not silently bring
  removed networks back.
- **Database and denylist must not overlap.** If a denylisted BSSID is still in
  `data/networks.json`, a removal was half-done and the network is still published. The
  run stops (exit 2), like the stored-duplicate rule. A `CommittedDatabase` unit test
  catches it in the removal PR's CI.
- **Where the check sits.** Right after the MAC is validated (after `malformed` /
  `not wifi`, before coordinates). A removed network is dropped under the new summary
  reason **`removed`**, whatever else is true of the row.
- **Opt-outs are NOT added to the denylist automatically.** The issue leaves this to the
  owner: it would store an identifier for networks that asked not to be mapped. Opt-out
  stays per batch. The owner is asked on the issue.
- **Helper script** `scripts/remove_network.py BSSID [BSSID…] --issue N`: accepts any
  supported spelling, removes every matching record, appends the canonical BSSID with
  today's UTC date, and writes both files atomically. It works even when the network
  isn't on the map yet (pre-emptive removal). It leaves `updated_at` unchanged, since that
  means "last time networks were added" (data/README.md), and fixes `count`.
- **Docs.** New `docs/removals.md` (the procedure), rows in `docs/dedupe.md`, a section in
  `data/README.md`, and an updated `privacy.html` `#removal` (the `_nomap` workaround
  bullet goes, and the page says removals are remembered). The `#opt-out` text stays:
  opt-outs are still not remembered.

## Implementation units

1. `scripts/ingest.py`: `DEFAULT_DENYLIST`, `load_denylist(path)`, a `removed` entry in
   `REASONS`, a `classify(row, fence, known, removed)` check, a fatal overlap check in `run()`,
   and a `--denylist` CLI flag.
2. `scripts/remove_network.py`: the helper (stdlib only, reuses `ingest.py` by path).
3. `data/removed.json`: `{"removed": []}`.
4. `tests/test_ingest.py`: the `PipelineCase` helper writes and passes a denylist; new
   `Denylist` tests; `CommittedDatabase` also validates the committed denylist and the
   no-overlap rule; new `RemoveNetwork` tests for the helper.
5. `tests/e2e/site.spec.js`: update the `#removal` expectations.
6. Docs as above.

## Verification

`python3 -m unittest discover -s tests -v && npx playwright test` green locally and in CI.
The real `ingest/` inbox is not touched: every test runs in a temp dir.
