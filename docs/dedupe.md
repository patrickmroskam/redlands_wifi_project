# How duplicates are handled

A network's identity is its **BSSID**, the radio's MAC address. The map should
never show the same BSSID twice, and a network that has been stored is never
changed when it is seen again (PRD R4.6 and R4.7; see also the constitution).

## Rules

| Where | What happens |
|---|---|
| Incoming rows (`scripts/ingest.py`) | The `MAC` column is normalized to `xx:xx:xx:xx:xx:xx` (lower case). The pipeline accepts `aa:bb:…`, `AA-BB-…`, `aabb.ccdd.eeff`, and `aabbccddeeff`. Anything else is dropped as **malformed**: a wrong length, non-hex characters, or mixed separators. |
| Row already in the database (any spelling) | Dropped as a **duplicate** and counted under `in database`. The stored record is never touched. |
| Same BSSID seen again in the same batch | The first surviving row wins. Files are read in natural order (`wardrive_2` before `wardrive_10`) and rows in file order. The later rows are counted under `in this batch`. |
| Same BSSID seen with an opt-out SSID (`_nomap` / `_optout`) anywhere in the batch | **The opt-out wins**, whatever the file order: the network is not published, even when other rows show it without the suffix. Those rows are counted as opt-outs. |
| BSSID listed in `data/removed.json` | Dropped as **removed**, whatever the SSID, location, or suffix. Removals are remembered this way (#27). See [removals.md](removals.md). |
| Denylisted BSSID still in the database, or a broken denylist | **The run stops (exit 2)**, like the rule below. |
| Row whose `Type` is not `WIFI` | Counted as **not wifi** before its MAC is checked, because cell rows carry tower IDs in that column. |
| Database already contains a duplicate or malformed BSSID | **The run stops (exit 2)**. Nothing is written or deleted, and the report lists the offending records by index. The logs wait in `ingest/` until a human fixes `data/networks.json` in a PR. A unit test (`CommittedDatabase`) catches this in CI when that PR is opened. While the run is stuck, it also cannot report new opt-outs, so fix the database promptly. |
| Site (`assets/map.js`) | Defense in depth. The site draws one marker per BSSID, and the first record wins. The count line counts unique networks, and the console notes any skipped copies. Any later stats (#12, #13) should count the same way. |
| Two ingest runs at once | They can't happen. The workflow's `concurrency: ingest` group queues runs, and each run checks out the newest `main` (#5). |

## Not duplicates: same name, different BSSID

Mesh systems and dual-band routers broadcast one SSID from several radios, and
each radio has its own BSSID. **These are separate networks and are all kept.**
Don't "fix" this by deduping on SSID; `test_same_ssid_on_different_bssids_is_kept_as_distinct_networks`
guards the behavior. In the first real batch, 1,671 named SSIDs appear on more
than one BSSID (5,657 networks in total), and 5,370 networks have a hidden SSID.

## First-batch dry run (2026-09-17, issue #15)

The run used `python3 scripts/ingest.py --dry-run` on a scratch copy of the 48
logs in `ingest/`. The real files were not touched.

| | |
|---|---|
| rows read | 40,228 |
| malformed (incl. bad MACs) | 0 |
| outside area | 4,167 |
| duplicates within the batch | 17,909 |
| duplicates of stored networks | 0 (the database is empty) |
| would be added | 18,152 |
| MAC spellings found | one only: `HH:HH:HH:HH:HH:HH` (upper case) on all 40,228 rows |

Normalization therefore changes nothing for this batch. The result matches the
#3 dry run (+18,152).
