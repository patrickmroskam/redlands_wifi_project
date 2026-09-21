# Removing a network (removal requests)

People ask for a network to be taken off the map by opening a GitHub issue (see
`privacy.html#removal`, PRD R6.5). A removal must **stick**: the next scan that hears
the network must not add it back. That is what `data/removed.json` is for.

## Procedure

1. Read the request. Find the network's BSSID in `data/networks.json` (or in
   `data/bluetooth.json` for a Bluetooth device). If the requester gave only a name
   and a street, match the SSID and check that the location is close. When unsure,
   ask on the issue. Don't guess.
2. On a new branch, run:
   ```bash
   python3 scripts/remove_network.py --issue <issue number> <BSSID> [<BSSID> ...]
   ```
   Any spelling of the BSSID works (`AA:BB:…`, `aa-bb-…`, `aabb.ccdd.eeff`,
   `aabbccddeeff`). List every radio the request covers: a mesh or dual-band router
   has one BSSID per radio.
   The script deletes every matching record from **all three** published databases —
   `data/networks.json`, `data/bluetooth.json` and `data/flock.json` — fixes each
   `count`, and adds each canonical BSSID, today's UTC date and the issue number to
   `data/removed.json`. It works even if the network isn't on the map yet. Deleting
   from only one of them would leave the device published on another map *and* stop
   every later ingest run, so the script always covers the same set the ingest checks.
3. Commit **every** file the script changed in one commit and open a PR. It prints a
   line per database, so commit the ones whose count is non-zero along with
   `data/removed.json`. CI checks that the denylist is valid and that no listed BSSID
   is still in any of the three databases.
4. If an ingest run happens between your branch and the merge, the ingest refuses to
   push a commit that would republish a listed network (it re-checks after its
   rebase). If the ingest still stops with "still contains … removed network(s)",
   re-run step 2 on `main` and merge that.
5. After the merge, comment on the issue ("removed; it won't be added again") and
   close it. Don't repeat the BSSID or any location in the comment.

## What the denylist holds

```json
{
  "removed": [
    {"bssid": "aa:bb:cc:dd:ee:ff", "date": "2026-09-17", "issue": 123}
  ]
}
```

Exactly these three keys per entry, and nothing else: no SSID, no address, no reason.
The BSSID must be in canonical form (lower case, colon-separated). Each BSSID
appears once, and the date is a real `YYYY-MM-DD` day.

## How the ingest uses it

- A row whose BSSID is listed is dropped under the summary reason **`removed`**. This
  check comes right after the MAC is validated, so it applies whatever the row's
  name, location or opt-out suffix.
- **The run stops (exit 2) and changes nothing** if the denylist is missing,
  unreadable or malformed, or if a listed BSSID is still in any of
  `data/networks.json`, `data/bluetooth.json` or `data/flock.json` (a half-done
  removal). The logs wait in the inbox until a human fixes it. Treating a broken list
  as empty would republish removed networks.
- If the script stops part-way with "… could not be written", it names the files it
  did change. Nothing is lost: the denylist is written first, so the device can never
  be re-added, and re-running the same command finishes the job.

## Limits

- Removed networks stay in the repository's git history, and in any raw logs
  already pushed to `ingest/` (see #22 / #30). The privacy page says so.
- Opt-outs (`_nomap` / `_optout`) are **not** added to the denylist automatically.
  That would store an identifier for networks that asked not to be mapped, so it is
  the owner's call (#27). Until then an opt-out applies only to the batch that
  carries it.
- The pipeline never removes an entry from the denylist. To undo a removal (for
  example, the requester asks), delete the entry by hand in a PR that links the
  issue.
