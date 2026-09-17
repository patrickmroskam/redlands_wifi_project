#!/usr/bin/env python3
"""Remove networks from the map for good (a removal request, PRD R6.5).

Deletes every record with the given BSSID(s) from data/networks.json and adds the
canonical BSSID(s) to data/removed.json, so the ingest never adds them again.
Commit both files together in one PR. See docs/removals.md.

Python 3 standard library only.

Usage:
  python3 scripts/remove_network.py --issue N BSSID [BSSID ...]
                                    [--db FILE] [--denylist FILE]

Exit codes: 0 ok; 2 error (nothing written).
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
    """The denylist was written but the database was not."""


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


def remove(bssids, issue, db_path, denylist_path, today=None):
    """Return (records_deleted, bssids_added_to_denylist). Raises ingest.FatalError."""
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

    # Validate both files up front with the ingest's own rules.
    if not os.path.isfile(db_path):
        raise ingest.FatalError("database {} does not exist".format(db_path))
    db = ingest.load_db(db_path)
    ingest.stored_bssids(db, db_path)
    listed = ingest.load_denylist(denylist_path)
    with open(denylist_path, encoding="utf-8") as fh:
        entries = json.load(fh)["removed"]

    date = (today or datetime.datetime.now(datetime.timezone.utc).date()).isoformat()
    new = [b for b in targets if b not in listed]
    entries = entries + [{"bssid": b, "date": date, "issue": issue} for b in new]

    kept = [n for n in db["networks"] if ingest.normalize_bssid(n.get("bssid")) not in targets]
    deleted = len(db["networks"]) - len(kept)

    # Denylist first: if the second write fails, the network is still published but can
    # never be re-added, and the ingest refuses to run until the database is fixed.
    if new:
        save_denylist(denylist_path, entries)
    if deleted:
        db["networks"] = kept
        db["count"] = len(kept)  # updated_at means "last addition"; leave it
        try:
            ingest.save_db(db_path, db)
        except OSError as exc:
            raise PartialWrite(
                "{} was updated but {} could not be written ({}); re-run this command "
                "(the ingest refuses to run until the records are gone)".format(
                    denylist_path, db_path, exc)) from None
    return deleted, new


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("bssids", nargs="+", metavar="BSSID")
    parser.add_argument("--issue", type=int, required=True,
                        help="the GitHub issue that asked for the removal")
    parser.add_argument("--db", default=ingest.DEFAULT_DB)
    parser.add_argument("--denylist", default=ingest.DEFAULT_DENYLIST)
    args = parser.parse_args(argv)
    try:
        deleted, new = remove(args.bssids, args.issue, args.db, args.denylist)
    except PartialWrite as exc:
        print("error: {}".format(exc))
        return EXIT_ERROR
    except (ingest.FatalError, OSError) as exc:
        print("error: {}".format(exc))
        print("nothing was written.")
        return EXIT_ERROR
    print("records deleted from {}: {}".format(os.path.relpath(args.db), deleted))
    print("added to {}: {}".format(os.path.relpath(args.denylist), len(new)))
    for bssid in new:
        print("  " + bssid)
    if not deleted:
        print("note: no matching record was on the map; the BSSID is still blocked from now on.")
    return EXIT_OK


if __name__ == "__main__":
    sys.exit(main())
