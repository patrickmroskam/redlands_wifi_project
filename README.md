# Redlands WiFi Project

Map WiFi networks in Redlands, CA — https://patrickmroskam.github.io/redlands_wifi_project/

- `index.html`, `privacy.html`, `assets/` — the one-page site (static, no build step).
- `data/networks.json` — the database the map reads. See [`data/README.md`](data/README.md).
- `ingest/` — inbox for raw wardrive logs. See [`ingest/README.md`](ingest/README.md).
- `scripts/ingest.py` — the ingest pipeline (Python 3, standard library only).
- `scripts/publish_ingest.sh` — runs the pipeline and commits + pushes its result (used by the daily job).
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

## The daily job

`.github/workflows/ingest.yml` ("Ingest wardrive logs") runs every day at 10:00 UTC
(03:00 Pacific in summer) and can be started by hand from the Actions tab
(**Run workflow**; tick *Dry run* to only see the report). It:

1. runs the unit tests (a push made by the job does not trigger CI);
2. runs `scripts/publish_ingest.sh`, which runs the pipeline and, only if
   `data/networks.json` or `ingest/` changed, commits exactly those paths as
   `ingest: +N networks, M files processed` and pushes to `main`;
3. checks that GitHub Pages started a build for that commit, and requests one if not.

The report appears in the run's summary panel. A red run means a file could not be
parsed (the good files were still published; the bad one stays in `ingest/`) or a
fatal error (nothing was published). Networks that opted out after being published
show up as warnings and need a removal PR. GitHub pauses scheduled workflows after 60
days without repo activity; if that happens, re-enable the workflow from the Actions tab.

## Tests

```bash
python3 -m unittest discover -s tests -v   # pipeline unit tests (fixtures in tests/fixtures/)
npx playwright test                        # browser smoke tests
```

CI (`.github/workflows/ci.yml`) runs both suites on every pull request and on every
push to `main`. The first-time setup for the browser tests is
`npm ci && npx playwright install chromium`.
