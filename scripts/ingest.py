#!/usr/bin/env python3
"""Ingest raw WiGLE CSV wardrive logs into data/networks.json.

Reads every candidate file in ingest/, keeps WiFi rows that fall inside the
Redlands ZIP polygons (92373 / 92374), are not opted out (`_nomap` / `_optout`)
and are not already known (by BSSID), appends them to the database, then
deletes the files it processed. Files it cannot parse are left in place,
reported by name, and make the script exit 1. See docs/spec/PRD.md (R3, R4).

Python 3 standard library only.

Usage:
  python3 scripts/ingest.py [--dry-run] [--ingest-dir DIR] [--db FILE] [--boundary FILE]

Exit codes: 0 ok; 1 some files could not be parsed (left in place) or could not
be deleted; 2 fatal (nothing written or deleted).
"""
import argparse
import datetime
import json
import math
import os
import re
import sys
import tempfile

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_INGEST_DIR = os.path.join(REPO_ROOT, "ingest")
DEFAULT_DB = os.path.join(REPO_ROOT, "data", "networks.json")
DEFAULT_BOUNDARY = os.path.join(REPO_ROOT, "data", "redlands-boundary.geojson")

# Files in the inbox that are never logs.
NON_CANDIDATES = {"README.md", ".gitkeep"}
REQUIRED_COLUMNS = ("MAC", "SSID", "AuthMode", "FirstSeen", "Channel",
                    "CurrentLatitude", "CurrentLongitude", "Type")
OPT_OUT_SUFFIXES = ("_nomap", "_optout")

# Drop reasons, in the order they are checked, with their summary labels.
REASONS = (
    ("malformed", "malformed"),
    ("not_wifi", "not wifi"),
    ("bad_coords", "bad coords"),
    ("outside_area", "outside area"),
    ("opt_out", "opt-out"),
    ("duplicate", "duplicate"),
)

EXIT_OK, EXIT_PROBLEMS, EXIT_FATAL = 0, 1, 2

_FIRST_SEEN = re.compile(r"^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{1,2}):(\d{1,2})$")


class FatalError(Exception):
    """Configuration or I/O problem: stop before changing anything."""


class UnparseableFile(Exception):
    """The file is not a WiGLE CSV log."""


# --- geometry ----------------------------------------------------------------

class Fence:
    """Point-in-polygon test against the Polygon/MultiPolygon features of a GeoJSON
    FeatureCollection. Inner rings are holes. Coordinates are [lon, lat]."""

    def __init__(self, geojson):
        self.polygons = []  # list of (bbox, [ring, ...]); ring = [(lon, lat), ...]
        for feature in geojson.get("features", []):
            geom = feature.get("geometry") or {}
            if geom.get("type") == "Polygon":
                self._add(geom["coordinates"])
            elif geom.get("type") == "MultiPolygon":
                for poly in geom["coordinates"]:
                    self._add(poly)
        if not self.polygons:
            raise ValueError("boundary has no Polygon or MultiPolygon features")

    def _add(self, rings):
        rings = [[(float(p[0]), float(p[1])) for p in ring] for ring in rings]
        outer = rings[0]
        lons = [p[0] for p in outer]
        lats = [p[1] for p in outer]
        self.polygons.append(((min(lons), min(lats), max(lons), max(lats)), rings))

    @staticmethod
    def _in_ring(lon, lat, ring):
        inside = False
        j = len(ring) - 1
        for i in range(len(ring)):
            xi, yi = ring[i]
            xj, yj = ring[j]
            if (yi > lat) != (yj > lat) and lon < (xj - xi) * (lat - yi) / (yj - yi) + xi:
                inside = not inside
            j = i
        return inside

    def contains(self, lat, lon):
        for (min_lon, min_lat, max_lon, max_lat), rings in self.polygons:
            if not (min_lon <= lon <= max_lon and min_lat <= lat <= max_lat):
                continue  # also rejects NaN
            if self._in_ring(lon, lat, rings[0]) and not any(
                    self._in_ring(lon, lat, hole) for hole in rings[1:]):
                return True
        return False


# --- field parsing -------------------------------------------------------------

def normalize_first_seen(value):
    """'2025-3-21 23:8:20' -> '2025-03-21 23:08:20'; unparseable values are kept as-is."""
    value = value.strip()
    match = _FIRST_SEEN.match(value)
    if match:
        try:
            stamp = datetime.datetime(*(int(g) for g in match.groups()))
        except ValueError:
            return value
        return stamp.strftime("%Y-%m-%d %H:%M:%S")
    return value


def parse_channel(value):
    try:
        return int(value.strip())
    except ValueError:
        return None


def parse_coord(value):
    try:
        number = float(value.strip())
    except ValueError:
        return None
    return number if math.isfinite(number) else None


def natural_key(name):
    parts = re.split(r"([0-9]+)", name)
    return [int(part) if i % 2 else part.lower() for i, part in enumerate(parts)]


# --- files ---------------------------------------------------------------------

def candidate_files(ingest_dir):
    names = []
    for name in os.listdir(ingest_dir):
        if name in NON_CANDIDATES or name.startswith("."):
            continue
        if os.path.isfile(os.path.join(ingest_dir, name)):
            names.append(name)
    return sorted(names, key=natural_key)


def split_row(line, width, ssid_at):
    """Split one physical line into `width` fields, or return None if it is malformed.

    Marauder logs are not CSV-quoted, so each line is split on commas by itself.
    An open quote can never swallow the rows after it. Extra commas are assumed
    to belong to the SSID, and an SSID wrapped in double quotes (as other WiGLE
    loggers write it) is unquoted.
    """
    if "\x00" in line:
        return None
    fields = line.split(",")
    extra = len(fields) - width
    if extra > 0:
        fields[ssid_at:ssid_at + extra + 1] = [",".join(fields[ssid_at:ssid_at + extra + 1])]
    if len(fields) != width:
        return None
    ssid = fields[ssid_at]
    if len(ssid) >= 2 and ssid.startswith('"') and ssid.endswith('"'):
        fields[ssid_at] = ssid[1:-1].replace('""', '"')
    return fields


def read_log(path):
    """Return a list of dicts (one per non-blank data row; None for a malformed row)."""
    with open(path, "rb") as fh:
        raw = fh.read()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise UnparseableFile("not UTF-8 text")
    # Split on newlines only: str.splitlines() would also break rows on
    # form feeds or U+2028 inside an SSID.
    lines = [line[:-1] if line.endswith("\r") else line for line in text.split("\n")]
    if not lines[0].startswith("WigleWifi-"):
        raise UnparseableFile("first line is not a WigleWifi header")
    if len(lines) < 2 or not lines[1].strip():
        raise UnparseableFile("missing column header line")
    columns = [c.strip() for c in lines[1].split(",")]
    missing = [c for c in REQUIRED_COLUMNS if c not in columns]
    if missing:
        raise UnparseableFile("missing columns: " + ", ".join(missing))

    ssid_at = columns.index("SSID")
    rows = []
    for line in lines[2:]:
        if not line.strip():
            continue
        fields = split_row(line, len(columns), ssid_at)
        rows.append(dict(zip(columns, fields)) if fields is not None else None)
    return rows


# --- database ------------------------------------------------------------------

def load_db(path):
    if not os.path.exists(path):
        return {"updated_at": None, "count": 0, "networks": []}
    try:
        with open(path, encoding="utf-8") as fh:
            db = json.load(fh)
    except (OSError, ValueError) as exc:
        raise FatalError("cannot read database {}: {}".format(path, exc))
    if not isinstance(db, dict) or not isinstance(db.get("networks"), list):
        raise FatalError("database {} has no 'networks' list".format(path))
    if not all(isinstance(n, dict) for n in db["networks"]):
        raise FatalError("database {} has a network entry that is not an object".format(path))
    return db


def save_db(path, db):
    """Atomically write valid JSON with one network per line (compact, diff-friendly)."""
    dump = lambda value: json.dumps(value, ensure_ascii=False)  # noqa: E731
    networks = db["networks"]
    parts = [
        "{\n",
        '  "updated_at": {},\n'.format(dump(db["updated_at"])),
        '  "count": {},\n'.format(len(networks)),
    ]
    if networks:
        parts.append('  "networks": [\n')
        parts.append(",\n".join("    " + dump(n) for n in networks))
        parts.append("\n  ]\n")
    else:
        parts.append('  "networks": []\n')
    parts.append("}\n")

    try:
        mode = os.stat(path).st_mode & 0o777
    except FileNotFoundError:
        mode = 0o644
    directory = os.path.dirname(os.path.abspath(path))
    fd, tmp = tempfile.mkstemp(prefix=".networks-", suffix=".json", dir=directory)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            fh.write("".join(parts))
        os.chmod(tmp, mode)  # mkstemp creates 0600; keep the file world-readable
        os.replace(tmp, path)
    except BaseException:
        if os.path.exists(tmp):
            os.remove(tmp)
        raise


# --- pipeline ------------------------------------------------------------------

def classify(row, fence, known):
    """Return (reason, None) for a dropped row or (None, record) for a kept one."""
    if row is None or not row["MAC"].strip():
        return "malformed", None
    if row["Type"].strip().upper() != "WIFI":
        return "not_wifi", None
    lat = parse_coord(row["CurrentLatitude"])
    lon = parse_coord(row["CurrentLongitude"])
    if lat is None or lon is None or (lat == 0 and lon == 0):
        return "bad_coords", None
    if not fence.contains(lat=lat, lon=lon):
        return "outside_area", None
    ssid = row["SSID"]
    if ssid.strip().lower().endswith(OPT_OUT_SUFFIXES):
        return "opt_out", None
    bssid = row["MAC"].strip().lower()
    if bssid in known:
        return "duplicate", None
    return None, {
        "bssid": bssid,
        "ssid": ssid,
        "auth": row["AuthMode"].strip(),
        "channel": parse_channel(row["Channel"]),
        "first_seen": normalize_first_seen(row["FirstSeen"]),
        "lat": lat,
        "lon": lon,
    }


def run(ingest_dir, db_path, boundary_path, dry_run=False, now=None):
    """Run the pipeline and return a summary dict. Raises FatalError before any change."""
    try:
        with open(boundary_path, encoding="utf-8") as fh:
            fence = Fence(json.load(fh))
    except (OSError, ValueError, KeyError, TypeError, IndexError) as exc:
        raise FatalError("cannot load boundary {}: {}".format(boundary_path, exc))
    if not os.path.isdir(ingest_dir):
        raise FatalError("ingest directory {} does not exist".format(ingest_dir))
    db = load_db(db_path)
    stored = {str(n.get("bssid", "")).lower() for n in db["networks"]}
    known = set(stored)

    summary = {
        "files_processed": [],
        "unparseable": [],
        "rows_read": 0,
        "dropped": {reason: 0 for reason, _ in REASONS},
        "added": 0,
        "opted_out_but_published": [],
        "not_deleted": [],
        "dry_run": dry_run,
    }
    added = []
    for name in candidate_files(ingest_dir):
        try:
            rows = read_log(os.path.join(ingest_dir, name))
        except (UnparseableFile, OSError) as exc:
            summary["unparseable"].append((name, str(exc)))
            continue
        summary["files_processed"].append(name)
        for row in rows:
            summary["rows_read"] += 1
            reason, record = classify(row, fence, known)
            if reason:
                summary["dropped"][reason] += 1
                if reason == "opt_out":
                    bssid = row["MAC"].strip().lower()
                    if bssid in stored and bssid not in summary["opted_out_but_published"]:
                        summary["opted_out_but_published"].append(bssid)
            else:
                known.add(record["bssid"])
                added.append(record)
    summary["added"] = len(added)

    if dry_run:
        return summary

    if added:
        stamp = now or datetime.datetime.now(datetime.timezone.utc)
        db["networks"].extend(added)
        db["count"] = len(db["networks"])
        db["updated_at"] = stamp.strftime("%Y-%m-%dT%H:%M:%SZ")
        try:
            save_db(db_path, db)
        except OSError as exc:
            raise FatalError("cannot write database {}: {}".format(db_path, exc))

    for name in summary["files_processed"]:
        try:
            os.remove(os.path.join(ingest_dir, name))
        except OSError as exc:
            summary["not_deleted"].append((name, str(exc)))
    return summary


def format_summary(summary):
    line = "{:<19}{}".format
    reason_line = "  {:<17}{}".format
    out = []
    if summary["dry_run"]:
        out.append("DRY RUN: nothing written or deleted.")
    out.append(line("files processed:", len(summary["files_processed"])))
    out.append(line("rows read:", summary["rows_read"]))
    out.append("rows dropped:")
    for reason, label in REASONS:
        out.append(reason_line(label + ":", summary["dropped"][reason]))
    out.append(line("rows added:", summary["added"]))
    if summary["opted_out_but_published"]:
        out.append("")
        out.append("already published but now opted out (remove by hand, see privacy policy):")
        out.extend("  " + bssid for bssid in summary["opted_out_but_published"])
    if summary["not_deleted"]:
        out.append("")
        out.append("processed but could not delete {} file(s):".format(len(summary["not_deleted"])))
        for name, why in summary["not_deleted"]:
            out.append("  {}: {}".format(name, why))
    if summary["unparseable"]:
        out.append("")
        out.append("could not parse {} file(s) (left in place):".format(len(summary["unparseable"])))
        for name, why in summary["unparseable"]:
            out.append("  {}: {}".format(name, why))
    return "\n".join(out)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--ingest-dir", default=DEFAULT_INGEST_DIR)
    parser.add_argument("--db", default=DEFAULT_DB)
    parser.add_argument("--boundary", default=DEFAULT_BOUNDARY)
    parser.add_argument("--dry-run", action="store_true",
                        help="report what would happen without writing or deleting")
    args = parser.parse_args(argv)
    try:
        summary = run(args.ingest_dir, args.db, args.boundary, dry_run=args.dry_run)
    except FatalError as exc:
        print("error: {}".format(exc))
        print("nothing was written or deleted.")
        return EXIT_FATAL
    print(format_summary(summary))
    if summary["unparseable"] or summary["not_deleted"]:
        return EXIT_PROBLEMS
    return EXIT_OK


if __name__ == "__main__":
    sys.exit(main())
