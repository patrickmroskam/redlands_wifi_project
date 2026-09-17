---
title: "feat: Ingest pipeline (parse → fence → filter → dedupe → append → delete)"
type: feat
status: completed
date: 2026-09-17
origin: docs/spec/PRD.md
issue: 3
---

# feat: Ingest pipeline

## Summary

Add a stdlib-only Python 3 script that turns the raw WiGLE CSV 1.4 logs in `ingest/`
into new records in `data/networks.json`. It drops rows that are out of area, not WiFi,
opted out, or already known, then deletes the files it processed. Unit tests run against
fixtures in `tests/fixtures/`, never against `ingest/`. The daily Actions job (#5) and the
backfill (#8) will call this script. Neither is part of this plan.

## Problem Frame

The site (#2) already reads `data/networks.json` and `data/redlands-boundary.geojson`.
Nothing populates the database yet. Meanwhile 48 raw logs sit in `ingest/`, and Pages
serves them publicly. The pipeline is the missing piece between the two.

Facts from the real batch: all 48 files are UTF-8, and every data row has 11 fields with
`Type` = `WIFI`. `FirstSeen` is not zero-padded (`2025-3-21 23:8:20`). `AuthMode` values
look like `[WPA2_PSK]` and `[OPEN]`.

## Requirements

- R3.1, R3.2: which files are candidates, and which format is accepted.
- R4.1 – R4.12: parse, the drop reasons, append, delete, loud failure, summary, whitelist
  of stored fields.
- R7.2: the database is the only long-lived data file.
- R8.3: fixtures are kept outside `ingest/`.
- Issue #3 note: a run that changes nothing must leave `networks.json` untouched, so #5
  can skip its commit.

## Key Technical Decisions

- **Location: `scripts/ingest.py`.** It works both as a CLI and as an importable module.
  Defaults resolve relative to the repo root: `ingest/`, `data/networks.json`,
  `data/redlands-boundary.geojson`. Flags can override each one, which lets tests point it
  at a temp dir.
- **Map columns by header name, not by position.** A file counts as WiGLE only when
  line 1 starts with `WigleWifi-` and line 2 contains every required column. Anything else
  is *unparseable*: the file stays in place, the script reports it by name, and the exit
  code is non-zero (R4.10). Unparseable also covers bytes that are not UTF-8 and empty
  files.
- **A malformed row inside a valid file drops only that row** (reason `malformed`), not the
  whole file. ESP32 logs often end with a truncated line after a power loss. Failing the
  whole file would strand every good row in it forever.
- **Filter order:** malformed → not wifi → bad coords → outside area → opt-out →
  duplicate. Each dropped row is counted once, under the first reason that applies. The
  duplicate check comes last, so "first occurrence in the batch" means the first occurrence
  that passes every other filter.
- **Files are processed in natural sort order** (`wardrive_2` before `wardrive_10`), which
  makes "first occurrence" deterministic.
- **BSSIDs are normalized to lowercase** for storage and comparison (matches
  `data/README.md`). An existing record is never modified. New rows are only appended.
- **Point-in-polygon uses ray casting** with a bbox prefilter. It supports `Polygon` and
  `MultiPolygon`, and treats inner rings as holes. Stdlib only, no shapely.
- **`first_seen` is normalized** to `YYYY-MM-DD HH:MM:SS` when it parses. Otherwise the
  raw trimmed string is kept. `channel` is stored as an int (`null` if it is not numeric).
- **Stored fields are a whitelist:** `bssid, ssid, auth, channel, first_seen, lat, lon`
  (R4.12). RSSI, altitude, accuracy, and type are never written.
- **Write only when rows were added.** Records are appended, `count` is updated, and
  `updated_at` is set to UTC `...Z`. The write is atomic (temp file + `os.replace`). The
  output is valid JSON with one network per line, which keeps a 30k-row file compact and
  easy to diff.
- **Delete processed files only after the database write succeeds.** Files that added
  nothing (all rows dropped) are still deleted. A run that only deletes files is a real
  change for #5.
- **Exit codes:** `0` means success. `1` means one or more files were unparseable (the rest
  were still processed). `2` means a fatal config error: a missing or invalid boundary, or an
  unreadable database. On a fatal error nothing is written or deleted. A missing
  `networks.json` counts as an empty database.
- **Skip dotfiles.** `README.md`, `.gitkeep`, other dotfiles (`.DS_Store`), and
  subdirectories are not candidates.
- **`--dry-run`** prints the summary without writing or deleting anything. It is useful for
  the owner and for the backfill's pre-check.

## Implementation Units

### U1. Pipeline module + CLI

**Goal:** implement `scripts/ingest.py` per the decisions above.
**Requirements:** R3.1, R3.2, R4.1–R4.12, R7.2.
**Dependencies:** none.
**Files:** `scripts/ingest.py`, `tests/test_ingest.py`, `tests/fixtures/wigle/*`.
**Approach:** Small pure functions: parse file → candidate rows, classify row → reason or
record, point-in-polygon, load/save db, then an orchestrating `run()` that returns a
summary object. `main()` handles args, printing, and the exit code.
**Execution note:** Test-first for the filter/classify functions.
**Test scenarios:**
- Happy path: a fixture with in-area WPA and OPEN rows appends both with exactly the
  whitelisted keys, lowercase bssid, int channel, and padded `first_seen`. The file is
  deleted. `count` and `updated_at` are updated.
- Bad coords: blank, non-numeric, `0,0`, NaN → `bad_coords`.
- Outside area: a Los Angeles point → `outside_area`. A downtown Redlands point is kept.
- Not wifi: `BLE` / `GSM` type → `not_wifi`.
- Opt-out: `Home_nomap`, `X_NOMAP`, `y_OptOut ` → `opt_out`. `nomap_home` is kept.
- Duplicate vs db: a bssid already in the db (different case) → `duplicate`, and the
  existing record is unchanged.
- Duplicate in batch: the same bssid in two files → the first file in natural order wins.
- Malformed row: a truncated last line → `malformed`, and the other rows in that file are
  still added.
- Unparseable file: a non-WiGLE text file and a non-UTF-8 file are left in place. Valid
  files are still processed and deleted. Exit code is 1, and the names appear in the output.
- No-op: files with only dropped rows → the db file bytes and mtime are unchanged, and the
  files are deleted. An empty inbox → nothing changes and the exit code is 0.
- `README.md`, `.gitkeep`, and `.DS_Store` are never touched.
- Dry run: no writes and no deletes, but the summary counts match a real run.
- Fatal: a missing boundary → exit code 2, and nothing is deleted.
- Point-in-polygon: square with a hole (inside, in hole, outside, MultiPolygon).
- Output is valid JSON that round-trips through `json.load`, with `count ==
  len(networks)`.
- Summary text contains every reason label and the added count.
**Verification:** `python3 -m unittest discover -s tests -v` passes. The e2e suite is still
green.

### U2. Docs

**Goal:** describe how to run the pipeline locally and what the summary means.
**Requirements:** R3.3 (already satisfied by `ingest/README.md`; keep it accurate).
**Dependencies:** U1.
**Files:** `README.md`, `data/README.md`.
**Test expectation:** none (docs only).

## Scope Boundaries

- Not in scope: the GitHub Actions workflow (#5), the CI workflow (#4), and running the
  pipeline on the real `ingest/` batch (#8).
- Takedown removal of existing rows stays manual (PRD out-of-scope).

## Risks

- A 30k-row database makes a large page payload. One record per line keeps it compact.
  Clustering and performance belong to #7.
- History exposure of raw logs is a known consideration accepted in the PRD.
