# Redlands WiFi Project

Map WiFi networks in Redlands, CA — https://patrickmroskam.github.io/redlands_wifi_project/

- `index.html`, `privacy.html`, `assets/` — the one-page site (static, no build step).
- `data/networks.json` — the database the map reads. See [`data/README.md`](data/README.md).
- `ingest/` — inbox for raw wardrive logs. See [`ingest/README.md`](ingest/README.md).
- `scripts/ingest.py` — the ingest pipeline (Python 3, standard library only).
- `docs/spec/` — product spec (`PRD.md`) and project rules (`constitution.md`).

## The ingest pipeline

```bash
python3 scripts/ingest.py --dry-run   # report only: writes and deletes nothing
python3 scripts/ingest.py             # append new networks, delete processed files
```

For every file in `ingest/` (except `README.md` and dotfiles) it reads the WiGLE CSV
rows. It drops a row that is malformed, is not `WIFI`, has missing or 0,0
coordinates, falls outside ZIP 92373/92374, has an SSID ending in `_nomap` /
`_optout`, or has a BSSID that is already in the database (or earlier in the same
batch). The surviving rows are appended to `data/networks.json`. Then it deletes
the files it processed and prints a summary with a count for each drop reason.

- `data/networks.json` is rewritten only when at least one network was added.
- A file that is not a WiGLE CSV log is left in place and named in the output, and
  the script exits `1` after processing the others. It also exits `1` if a processed
  file could not be deleted.
- Rows are split one line at a time on commas, since Marauder logs are not CSV-quoted.
  A malformed row is dropped without affecting the rest of the file.
- The script never removes a network that is already published. If a stored network
  now broadcasts a `_nomap` / `_optout` SSID, the summary lists its BSSID so it can
  be removed by hand.
- Exit `2` means a fatal problem (missing boundary, unreadable database, write
  failure). Nothing is written or deleted in that case.

## Tests

```bash
python3 -m unittest discover -s tests -v   # pipeline unit tests (fixtures in tests/fixtures/)
npx playwright test                        # browser smoke tests
```
