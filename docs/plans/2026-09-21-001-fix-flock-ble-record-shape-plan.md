---
title: "fix: a Flock camera built from a BLE row carries only BLE fields (R9.3)"
type: fix
status: active
date: 2026-09-21
issue: 42
---

# fix: a Flock camera built from a BLE row carries only BLE fields (R9.3)

**Target repo:** patrickmroskam/redlands_wifi_project · Issue #42 (part of #1)

## Summary

`build_record()` picks the record shape from the *destination* dataset. The Flock copy of
a BLE row therefore takes the WiFi branch and is published with `ssid`, `auth: "[BLE]"`
and `channel: 0` — the two fields R9.3 says a BLE device never carries. Latent today
(`data/flock-rules.json` ships empty), live the moment a rule matches a BLE row.

## Decisions

- **Shape follows the source row, not the destination.** `classify()` already knows the
  row's own dataset (`dataset`, from `PUBLISHED_TYPES`). `build_record` takes that as the
  shape selector and a separate flag for "this is the Flock copy", which only appends
  `matched_by`. So a BLE-sourced camera is `{bssid, name, first_seen, lat, lon, matched_by}`
  and a WiFi-sourced camera is unchanged byte for byte.
- **No data migration.** `data/flock.json` is empty in the repo; no record has ever been
  written in the old shape, so there is nothing to rewrite.
- **Flock popup reads both shapes.** `assets/flock-map-config.js` shows `Name` (from
  `name`, fallback `unnamed`) for a BLE-shaped camera and `SSID` (fallback `hidden`) for a
  WiFi-shaped one. Discriminator: the record has a string `name` and no `ssid` key.
- **Production path.** `scripts/ingest.py` runs unattended nightly. The change is confined
  to the record builder; routing, dedupe, filters and ordering are untouched.

## Implementation units

1. `scripts/ingest.py` — `build_record(shape, row, ssid, bssid, lat, lon, matched_by=None)`:
   build the BLE or WiFi shape from `shape`, then add `matched_by` when given. In
   `classify()`, call it with the row's `dataset` and pass `matched_by` only for the
   `FLOCK` target.
2. `assets/flock-map-config.js` — popup handles the BLE shape.
3. Tests:
   - unit: a stable BLE row matching an OUI rule lands in `flock.json` with exactly
     `bssid, name, first_seen, lat, lon, matched_by` (no `auth`, `channel`, `ssid`), and its
     `bluetooth.json` copy has no `matched_by`.
   - unit: a WiFi camera keeps its full WiFi shape plus `matched_by` (regression guard).
   - e2e: a BLE-shaped camera in the flock fixture opens a popup with `Name`, no `Auth` /
     `Channel`.

## Verification

`python3 -m unittest discover -s tests -v && npx playwright test` (the constitution's
`ci_command`).
