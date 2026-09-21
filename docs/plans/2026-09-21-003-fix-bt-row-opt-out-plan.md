---
title: "fix: an opt-out on a classic-Bluetooth (Type=BT) row is registered (R4.5, R9.6)"
type: fix
status: active
date: 2026-09-21
issue: 50
---

# fix: an opt-out on a classic-Bluetooth (Type=BT) row is registered (R4.5, R9.6)

**Target repo:** patrickmroskam/redlands_wifi_project · Issue #50 (part of #1)

## Summary

`classify()` returns `("not_wifi", [], None, ())` for every Type outside
`PUBLISHED_TYPES` before it computes an address, so `run()` has nothing to add to
`opted_out`. A WiGLE `Type=BT` row carries a real MAC and the device's friendly name, so a
`Speaker_nomap` BT row is dropped and a `Speaker` BLE row for the same MAC is still
published to `data/bluetooth.json`. Latent: every real row to date is `WIFI` or `BLE`
(`not wifi: 0` over 8,393 rows, 2026-09-21), but a hardware change could arm it silently,
and a lost opt-out is the class of bug this project treats as serious.

## Decisions

- **The drop reason stays `not_wifi`.** Only the opt-out collection changes; summary
  counts for these rows are unchanged.
- **An address is only read when the MAC column parses as one.** For an unpublished Type,
  `classify()` returns `normalize_bssid(row["MAC"])`, which is `None` for a cell tower id
  (`310260_7_1234`, `310-410-1234`), so a tower id is never treated as a MAC.
- **Same predicate as the published path.** Extract the "this SSID withholds its address"
  test (an unreadable SSID, or an `_nomap` / `_optout` suffix) into one helper used by both
  `classify()`'s `unreadable_ssid` / `opt_out` branches and `run()`'s registration of a
  `not_wifi` row. A BT name we could not decode is therefore withheld exactly as a WiFi or
  BLE one is — the helper cannot drift between the two paths.
- **Any unpublished Type, not only `BT`.** If a cell row's id happens to parse as a MAC and
  its name carries the suffix, the address is withheld — the safe direction, and simpler
  than a second allow-list of types.
- **Production path.** `scripts/ingest.py` runs unattended nightly; routing, dedupe,
  filters and database writes are untouched. The already-published flag
  (`opted_out_but_published`) follows automatically, since registration goes through the
  same code.

## Implementation units

### U1. Register a not-wifi row's opt-out

**Files:** `scripts/ingest.py`, `tests/test_ingest.py`

**Approach:** Add a helper (e.g. `withholds(ssid)`); use it in `classify()` in place of the
two inline tests; return the normalized address on `not_wifi`; in `run()`, register a
`not_wifi` row whose address is not `None` and whose SSID withholds it, alongside the
existing `opt_out` / `unreadable_ssid` registration.

**Test scenarios:**
- BT `c1:00:00:00:00:09` `Speaker_nomap` + BLE same MAC `Speaker`, in area, both file
  orders → `bluetooth.json` empty; `not wifi: 1`, `opt-out: 1` (the withheld BLE row).
- BT `_nomap` row + WIFI row for the same MAC → `networks.json` empty.
- BT row with an unreadable name (bad octet) + BLE same MAC → withheld.
- BT row whose MAC is already published in `bluetooth.json` with `_nomap` → listed under
  "already published but now opted out".
- BT row without a suffix → nothing withheld; the BLE row for that MAC is published.
- GSM/LTE rows with tower ids (`310260_7_1234`, `310-410-1234`) named `X_nomap` → nothing
  registered, `not wifi: 2`, `malformed: 0`, an unrelated WIFI row still published.

**Verification:** `python3 -m unittest discover -s tests` passes; existing `not_wifi`,
opt-out and cell-row tests unchanged.

## Scope boundaries

- No change to which Types are published — BT rows stay unpublished.
- No change to `is_malformed()` or the all-rows-malformed net (that is #55).
