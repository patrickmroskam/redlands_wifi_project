# Redlands WiFi Project

Map WiFi networks in Redlands, CA — https://patrickmroskam.github.io/redlands_wifi_project/

- `index.html`, `bluetooth.html`, `flock.html`, `privacy.html`, `assets/` — the site
  (static, no build step). All three maps share `assets/map.js`; each page configures it
  with a `window.RWPMapConfig` before loading it.
- `data/networks.json`, `data/bluetooth.json`, `data/flock.json` — the databases the maps
  read. See [`data/README.md`](data/README.md).
- `ingest/` — retired. Raw logs now go to the **private** inbox repo
  `patrickmroskam/redlands_wifi_inbox`. See [`ingest/README.md`](ingest/README.md).
- `scripts/ingest.py` — the ingest pipeline (Python 3, standard library only).
- `scripts/publish_ingest.sh` — runs the pipeline and commits + pushes its result (used by the daily job).
- `assets/vendor/` — Leaflet 1.9.4, vendored so the CSP allows only this site's own scripts.
- `docs/security.md` — security rules, CSP rationale, and the audit record.
- `docs/spec/` — product spec (`PRD.md`) and project rules (`constitution.md`).

## The ingest pipeline

```bash
python3 scripts/ingest.py --dry-run   # report only: writes and deletes nothing
python3 scripts/ingest.py             # append new networks, delete processed files
python3 scripts/ingest.py --ingest-dir path/to/inbox   # read logs from somewhere else
```

For every file in the inbox (except `README.md` and dotfiles) it reads the WiGLE CSV
rows and routes each one by its `Type` column:

| Type | Goes to | Notes |
|---|---|---|
| `WIFI` | `data/networks.json` | the main map |
| `BLE` | `data/bluetooth.json` | only addresses that stay the same over time (see below) |
| anything else | dropped | GSM/LTE rows carry a tower id, not a MAC |

A row matching a rule in `data/flock-rules.json` is *also* written to
`data/flock.json`, so adding a rule never changes what the main map shows.

Every database gets the same filters: a row is dropped if it is malformed, has missing
or 0,0 coordinates, falls outside ZIP 92373/92374, has an SSID ending in `_nomap` /
`_optout`, is on the removal denylist, or has a BSSID already in that database (or
earlier in the same batch). Then it deletes the files it processed and prints a summary
with a count for each drop reason.

- A database is rewritten only when at least one record was added to it.
- **Bluetooth: only stable addresses are published.** Phones, watches and earbuds
  advertise a *random private* address that rotates every few minutes so they cannot be
  tracked. Such an address is useless as a dedupe key and publishing it would map the
  people who passed by, so rows whose address type could be a rotating one are dropped
  as `ble private`. The test is the top two bits of the first octet: `0b11` (static
  random) and `0b10` (not a valid random type, so a public address) are published, `0b01`
  and `0b00` are not. A public address that happens to start `0b00`/`0b01` is dropped
  along with them — the safe direction to be wrong in.
- **Flock cameras are rule-driven and the rules ship empty.** `data/flock-rules.json`
  holds SSID substrings and MAC prefixes; nothing matches until one is added, and every
  published record records which rule matched it. No rule has been confirmed against a
  real camera, and a guessed one would mark a resident's access point as surveillance.
- A file that is not a WiGLE CSV log is left in place and named in the output, and
  the script exits `1` after processing the others. It also exits `1` if a processed
  file could not be deleted.
- Rows are split one line at a time on commas, since Marauder logs are not CSV-quoted.
  A malformed row is dropped without affecting the rest of the file — unless *every*
  data row in a file is malformed, which means the file is not being read correctly
  (a logger format change, say). That file is treated as unparseable: it stays in
  the inbox, it is named in the output, and the script exits `1`.
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
2. checks out the **private** inbox repo into `inbox/` (gitignored) using `INBOX_TOKEN`,
   an environment secret in the `ingest` environment, which allows only `main` — so no
   pull-request run can ever reach the key;
3. runs `scripts/publish_ingest.sh`, which runs the pipeline over `inbox/` and, only if
   one of the databases changed, commits exactly those paths as
   `ingest: +N networks, M files processed` (with the Bluetooth and Flock counts in the
   commit body) and pushes to `main`;
4. deletes the processed logs **in the inbox repo**, in a second commit pushed there.
   The database is published first on purpose: if the run dies in between, the logs stay
   in the inbox and the next run re-reads them, which the BSSID dedupe makes a no-op;
5. checks that GitHub Pages started a build for that commit, and requests one if not.

Scheduled runs stay off until the repository variable `INGEST_SCHEDULE` is `on`. It must
be a *repository* variable, not an environment one: the job's `if:` is evaluated before
the `ingest` environment resolves, so an environment variable would always read empty.

The report appears in the run's summary panel. A red run means a file could not be
parsed (the good files were still published; the bad one stays in the inbox) or a
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
