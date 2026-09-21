#!/usr/bin/env python3
"""Remove networks from the map for good (a removal request, PRD R6.5).

Deletes every record with the given BSSID(s) from *every* database the ingest
publishes to — data/networks.json, data/bluetooth.json and data/flock.json — and adds
the canonical BSSID(s) to data/removed.json, so the ingest never adds them again.
Commit the changed files together in one PR. See docs/removals.md.

Python 3 standard library only.

Usage:
  python3 scripts/remove_network.py --issue N BSSID [BSSID ...]
                                    [--db FILE] [--ble-db FILE] [--flock-db FILE]
                                    [--denylist FILE]

Exit codes: 0 ok; 2 error (nothing written, or a reported partial write).
"""
import argparse
import datetime
import importlib.util
import json
import os
import sys
import tempfile

_HERE = os.path.dirname(os.path.abspath(__file__))
# Load ingest.py by path: `import ingest` would resolve to the repo's ingest/ inbox.
_spec = importlib.util.spec_from_file_location("ingest_pipeline", os.path.join(_HERE, "ingest.py"))
ingest = importlib.util.module_from_spec(_spec)
sys.modules.setdefault(_spec.name, ingest)
_spec.loader.exec_module(ingest)

EXIT_OK, EXIT_ERROR = 0, 2


class PartialWrite(Exception):
    """The denylist (and possibly some databases) were written, but not all of them."""


def _write_failed(changed, path, exc):
    """A PartialWrite naming what did change, so the operator knows where they stand."""
    prefix = "{} updated but ".format(", ".join(changed)) if changed else ""
    return PartialWrite(
        "{}{} could not be written ({}); re-run this command "
        "(the ingest refuses to run until the records are gone)".format(prefix, path, exc))


def _display(path):
    """`data/networks.json` when the file is under the working directory, else the path
    as given — a removal run from elsewhere should not print a wall of `../../..`."""
    relative = os.path.relpath(path)
    return path if relative.startswith(os.pardir + os.sep) else relative


def db_paths_from_args(args):
    """The dataset -> path mapping, identical to the one ingest.check_data() scans.

    These two must cover the same databases. check_data() treats a denylisted BSSID
    still present in *any* of them as fatal, so a database this tool skips is one a
    removal silently leaves published and that wedges every later ingest run.
    """
    return {"networks": args.db, "bluetooth": args.ble_db, ingest.FLOCK: args.flock_db}


def save_denylist(path, entries):
    """Atomically write the denylist with one entry per line."""
    lines = ",\n".join("    " + json.dumps(e, ensure_ascii=False) for e in entries)
    text = '{\n  "removed": [\n' + lines + "\n  ]\n}\n" if entries else '{\n  "removed": []\n}\n'
    try:
        mode = os.stat(path).st_mode & 0o777
    except FileNotFoundError:
        mode = 0o644
    fd, tmp = tempfile.mkstemp(prefix=".removed-", suffix=".json",
                               dir=os.path.dirname(os.path.abspath(path)))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            fh.write(text)
        os.chmod(tmp, mode)
        os.replace(tmp, path)
    except BaseException:
        if os.path.exists(tmp):
            os.remove(tmp)
        raise


def remove(bssids, issue, db_paths, denylist_path, today=None):
    """Return ({dataset: records_deleted}, bssids_added_to_denylist).

    Deletes from every database in `db_paths`, not just the main map: one device can
    answer on an address that is in networks.json and bluetooth.json at once, and
    flock.json is additive on top of whichever of those a row fed. Clearing only one of
    them leaves the device published *and* stops every later ingest on check_data()'s
    still-published gate. Raises ingest.FatalError before any write, or PartialWrite.
    """
    if isinstance(issue, bool) or not isinstance(issue, int) or issue < 1:
        raise ingest.FatalError("--issue must be a positive issue number")
    targets = []
    for raw in bssids:
        bssid = ingest.normalize_bssid(raw)
        if bssid is None:
            raise ingest.FatalError("not a BSSID: {}".format(json.dumps(raw, ensure_ascii=False)))
        if bssid not in targets:
            targets.append(bssid)
    if not targets:
        raise ingest.FatalError("give at least one BSSID")

    # Validate every file up front with the ingest's own rules.
    dbs = {}
    for dataset, path in db_paths.items():
        if not os.path.isfile(path):
            raise ingest.FatalError("database {} does not exist".format(path))
        key = ingest.RECORD_KEY[dataset]
        dbs[dataset] = ingest.load_db(path, key)
        ingest.stored_bssids(dbs[dataset], path, key)
    listed = ingest.load_denylist(denylist_path)
    with open(denylist_path, encoding="utf-8") as fh:
        entries = json.load(fh)["removed"]

    date = (today or datetime.datetime.now(datetime.timezone.utc).date()).isoformat()
    new = [b for b in targets if b not in listed]
    entries = entries + [{"bssid": b, "date": date, "issue": issue} for b in new]

    deleted = {}
    for dataset, db in dbs.items():
        key = ingest.RECORD_KEY[dataset]
        kept = [n for n in db[key] if ingest.normalize_bssid(n.get("bssid")) not in targets]
        deleted[dataset] = len(db[key]) - len(kept)
        db[key] = kept
        db["count"] = len(kept)  # updated_at means "last addition"; leave it

    # Denylist first: if a later write fails, the device is still published but can
    # never be re-added, and the ingest refuses to run until the databases are fixed.
    if new:
        save_denylist(denylist_path, entries)

    # Stage every changed database before swapping any of them in, so the usual write
    # failure (full disk, read-only tree) cannot leave a multi-database removal
    # half-applied. Report whatever a later rename did manage to change.
    changed = [denylist_path] if new else []
    staged, committed = [], 0
    try:
        for dataset, count in deleted.items():
            if not count:
                continue
            path = db_paths[dataset]
            try:
                staged.append(ingest.stage_db(path, dbs[dataset], ingest.RECORD_KEY[dataset]))
            except OSError as exc:
                raise _write_failed(changed, path, exc) from None
        for pending in staged:
            try:
                ingest.commit_db(pending)
            except OSError as exc:
                raise _write_failed(changed, pending[1], exc) from None
            changed.append(pending[1])
            committed += 1
    except BaseException:
        for pending in staged[committed:]:
            ingest.discard_db(pending)
        raise
    return deleted, new


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("bssids", nargs="+", metavar="BSSID")
    parser.add_argument("--issue", type=int, required=True,
                        help="the GitHub issue that asked for the removal")
    parser.add_argument("--db", default=ingest.DEFAULT_DB)
    parser.add_argument("--ble-db", default=ingest.DEFAULT_BLE_DB,
                        help="the Bluetooth database (data/bluetooth.json)")
    parser.add_argument("--flock-db", default=ingest.DEFAULT_FLOCK_DB,
                        help="the Flock database (data/flock.json)")
    parser.add_argument("--denylist", default=ingest.DEFAULT_DENYLIST)
    args = parser.parse_args(argv)
    db_paths = db_paths_from_args(args)
    try:
        deleted, new = remove(args.bssids, args.issue, db_paths, args.denylist)
    except PartialWrite as exc:
        print("error: {}".format(exc))
        return EXIT_ERROR
    except (ingest.FatalError, OSError) as exc:
        print("error: {}".format(exc))
        print("nothing was written.")
        return EXIT_ERROR
    for dataset, path in db_paths.items():
        print("records deleted from {}: {}".format(_display(path), deleted[dataset]))
    print("added to {}: {}".format(_display(args.denylist), len(new)))
    for bssid in new:
        print("  " + bssid)
    if not any(deleted.values()):
        print("note: no matching record was on the map; the BSSID is still blocked from now on.")
    return EXIT_OK


if __name__ == "__main__":
    sys.exit(main())
