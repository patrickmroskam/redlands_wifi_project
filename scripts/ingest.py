#!/usr/bin/env python3
"""Ingest raw WiGLE CSV wardrive logs into the published databases.

Reads every candidate file in the directory given by --ingest-dir (default
ingest/) and routes each row to one of three databases by its Type column:

  WIFI -> data/networks.json    every WiFi network (the main map)
  BLE  -> data/bluetooth.json   Bluetooth devices with a *stable* address
  any  -> data/flock.json       rows matching data/flock-rules.json, additionally

Every database applies the same filters: inside the Redlands ZIP polygons
(92373 / 92374), not opted out (`_nomap` / `_optout`), not on the removal
denylist (data/removed.json), and not already known (by BSSID, per database).
Rows of any other type (GSM/LTE cell towers) are dropped. Processed files are
deleted; files that cannot be parsed are left in place, reported by name, and
make the script exit 1. In CI scripts/publish_ingest.sh passes $INBOX_DIR as
--ingest-dir: a checkout of the private inbox repo, which is where raw logs live
since issue #30. This script never reads $INBOX_DIR itself.
See docs/spec/PRD.md (R3, R4).

Python 3 standard library only.

Usage:
  python3 scripts/ingest.py [--dry-run] [--ingest-dir DIR] [--db FILE] [--boundary FILE]
                            [--denylist FILE] [--ble-db FILE] [--flock-db FILE]
                            [--flock-rules FILE]

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
DEFAULT_BLE_DB = os.path.join(REPO_ROOT, "data", "bluetooth.json")
DEFAULT_FLOCK_DB = os.path.join(REPO_ROOT, "data", "flock.json")
DEFAULT_FLOCK_RULES = os.path.join(REPO_ROOT, "data", "flock-rules.json")
DEFAULT_BOUNDARY = os.path.join(REPO_ROOT, "data", "redlands-boundary.geojson")
DEFAULT_DENYLIST = os.path.join(REPO_ROOT, "data", "removed.json")

# Files in the inbox that are never logs.
NON_CANDIDATES = {"README.md", ".gitkeep"}
REQUIRED_COLUMNS = ("MAC", "SSID", "AuthMode", "FirstSeen", "Channel",
                    "CurrentLatitude", "CurrentLongitude", "Type")
OPT_OUT_SUFFIXES = ("_nomap", "_optout")
# The replacement character a lenient decode leaves behind (see read_log). An SSID
# holding one is an SSID we did not read, so its opt-out suffix cannot be trusted.
REPLACEMENT = "\ufffd"

# Log Type values this pipeline publishes, and the database each one feeds. Any other
# type (GSM, LTE, ...) is a cell tower: its id column is not a MAC and it is dropped.
PUBLISHED_TYPES = {"WIFI": "networks", "BLE": "bluetooth"}
# `flock` is additive: a matching row is published to its own database *as well as*
# the one its Type selects, so the main map never changes meaning when a rule is added.
FLOCK = "flock"
# The JSON key holding the records, per database.
RECORD_KEY = {"networks": "networks", "bluetooth": "devices", FLOCK: "devices"}

# Drop reasons, in the order they are checked, with their summary labels.
REASONS = (
    ("malformed", "malformed"),
    ("not_wifi", "not wifi"),
    ("ble_private", "ble private"),
    ("removed", "removed"),
    ("bad_coords", "bad coords"),
    ("outside_area", "outside area"),
    ("unreadable_ssid", "unreadable ssid"),
    ("opt_out", "opt-out"),
    ("duplicate", "duplicate"),
)

EXIT_OK, EXIT_PROBLEMS, EXIT_FATAL = 0, 1, 2

# Accepted BSSID spellings: aa:bb:cc:dd:ee:ff, aa-bb-cc-dd-ee-ff, aabb.ccdd.eeff,
# aabbccddeeff (any case). The canonical form is lower-case and colon-separated.
_BSSID_FORMS = (
    re.compile(r"^[0-9a-f]{2}(:[0-9a-f]{2}){5}$"),
    re.compile(r"^[0-9a-f]{2}(-[0-9a-f]{2}){5}$"),
    re.compile(r"^[0-9a-f]{4}(\.[0-9a-f]{4}){2}$"),
    re.compile(r"^[0-9a-f]{12}$"),
)

# Byte-order marks and zero-width characters that some tools prepend to a field.
_INVISIBLE = "\ufeff\u200b\u200c\u200d\u2060"

# Exactly these keys per denylist entry: nothing that could identify a person.
DENYLIST_KEYS = ("bssid", "date", "issue")
_DENY_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

_FIRST_SEEN = re.compile(r"^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{1,2}):(\d{1,2})$")


class FatalError(Exception):
    """Configuration or I/O problem: stop before changing anything.

    `written` names the databases already replaced on disk when the error was raised.
    It is empty for all but one error: a run publishes to three databases and swaps them
    in one at a time, so a failure part-way through that is the only path on which a
    fatal error leaves the tree changed. The message an operator reads has to say so."""

    def __init__(self, message, written=()):
        super().__init__(message)
        self.written = list(written)


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

def normalize_bssid(value):
    """Return the canonical 'xx:xx:xx:xx:xx:xx' form of a MAC address, or None if malformed.

    The BSSID is the network's identity (dedupe key). Different BSSIDs are different
    networks even when they share an SSID (mesh nodes, dual-band radios).
    """
    if not isinstance(value, str):
        return None
    text = value.strip().strip(_INVISIBLE).strip().lower()
    if not any(form.match(text) for form in _BSSID_FORMS):
        return None
    digits = re.sub(r"[^0-9a-f]", "", text)
    return ":".join(digits[i:i + 2] for i in range(0, 12, 2))


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


def ble_address_is_stable(bssid):
    """True when a BLE address identifies a device over time, rather than a person.

    A Bluetooth LE device may advertise a *random private* address that it changes on
    a timer — every ~15 minutes for a resolvable private address. Phones, watches and
    earbuds all do this, by design, so that they cannot be tracked. Such an address is
    useless as a dedupe key (the same handset returns as a new device on every pass)
    and publishing it would map the people who walked past, not the devices that live
    there. So only stable addresses are published.

    The address type is not a column in a WiGLE CSV, but the top two bits of the first
    octet carry it for random addresses (Bluetooth Core spec, Vol 6 Part B, 1.3.2):

        0b11  static random     stable for the device's power cycle  -> publish
        0b01  resolvable private    rotates on a timer               -> drop
        0b00  non-resolvable private    rotates on a timer           -> drop
        0b10  not a valid random type, so the address is public      -> publish

    A *public* (vendor-assigned) address carries no such marker, so one whose first
    octet happens to begin 0b00 or 0b01 is dropped along with the rotating ones. That
    is the safe direction to be wrong in: the cost is a missing marker, not a published
    person.
    """
    if bssid is None:
        return False
    return (int(bssid[:2], 16) >> 6) in (0b11, 0b10)


class FlockRules:
    """SSID substrings and MAC prefixes that mark a row as a Flock Safety camera.

    Kept in data as `data/flock-rules.json` rather than in code so a rule can be added
    without a code change, and so the file is the single auditable answer to "why is
    this marker on the map?". Both lists ship empty: no rule has been verified against
    a real observation yet, and guessing one would label a resident's access point as a
    surveillance camera on a public map.
    """

    def __init__(self, ssid_patterns=(), oui_prefixes=()):
        self.ssid_patterns = tuple(p.lower() for p in ssid_patterns)
        self.oui_prefixes = tuple(oui_prefixes)

    def __bool__(self):
        return bool(self.ssid_patterns or self.oui_prefixes)

    def match(self, row, bssid):
        """Return the rule that matched (for the record's `matched_by`), or None."""
        ssid = row["SSID"].strip().lower()
        if ssid:
            for pattern in self.ssid_patterns:
                if pattern in ssid:
                    return "ssid:" + pattern
        if bssid:
            for prefix in self.oui_prefixes:
                if bssid.startswith(prefix):
                    return "oui:" + prefix
        return None


def load_flock_rules(path):
    """Read data/flock-rules.json. Absent means "no rules"; malformed is fatal.

    Absence is a safe default — no rule matches, no camera is claimed — so a deleted
    file must not stop the daily job. A file that exists but is wrong is a different
    thing: it is a mis-edit, and running on a half-understood rule could mislabel
    somebody's network, so it stops the run.
    """
    if not os.path.exists(path):
        return FlockRules()
    try:
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
    except (OSError, ValueError) as exc:
        raise FatalError("cannot read flock rules {}: {}".format(path, exc))
    if not isinstance(data, dict):
        raise FatalError("flock rules {} is not an object".format(path))
    problems = []
    lists = {}
    for key in ("ssid_patterns", "oui_prefixes"):
        value = data.get(key, [])
        if not isinstance(value, list) or not all(isinstance(v, str) for v in value):
            problems.append("{} must be a list of strings".format(key))
            continue
        lists[key] = value
    for pattern in lists.get("ssid_patterns", []):
        if not pattern.strip():
            problems.append("ssid_patterns has a blank pattern")
    prefixes = []
    for prefix in lists.get("oui_prefixes", []):
        text = prefix.strip().lower().replace("-", ":")
        if not re.match(r"^[0-9a-f]{2}(:[0-9a-f]{2}){0,5}$", text):
            problems.append("oui_prefix {} is not a MAC prefix like aa:bb:cc".format(
                json.dumps(prefix, ensure_ascii=False)))
        else:
            prefixes.append(text)
    if problems:
        raise FatalError("flock rules {} needs a manual fix; {} problem(s): {}".format(
            path, len(problems), _preview(problems)))
    return FlockRules(lists.get("ssid_patterns", []), prefixes)


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
    # Decode leniently: an 802.11 SSID is an arbitrary 32-octet string, not text, and
    # the logger writes whatever bytes it saw over the air. A strict decode let one
    # undecodable octet in one SSID reject every other row in the file — and because an
    # unparseable file is deliberately kept (R4.10), the daily run then failed on it
    # forever. Rejection instead falls to the header check below, which is the more
    # accurate test of "is this a WiGLE log": a genuinely binary file has no WigleWifi
    # header. A row we cannot read is then dropped rather than trusted — see classify's
    # unreadable_ssid branch. Note the all-rows-malformed net below is NOT a general
    # guard for a partly corrupt file: it needs *every* row to be malformed, and a
    # single intact row disarms it, so a truncated log is processed for what survives
    # and the rest is counted as malformed (#55).
    text = raw.decode("utf-8-sig", errors="replace")
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

def load_db(path, key="networks"):
    if not os.path.exists(path):
        return {"updated_at": None, "count": 0, key: []}
    try:
        with open(path, encoding="utf-8") as fh:
            db = json.load(fh)
    except (OSError, ValueError) as exc:
        raise FatalError("cannot read database {}: {}".format(path, exc))
    if not isinstance(db, dict) or not isinstance(db.get(key), list):
        raise FatalError("database {} has no '{}' list".format(path, key))
    if not all(isinstance(n, dict) for n in db[key]):
        raise FatalError("database {} has a {} entry that is not an object".format(
            path, key[:-1] if key.endswith("s") else key))
    return db


def stored_bssids(db, path, key="networks"):
    """Canonical BSSIDs already in the database. Malformed or duplicate entries are fatal:
    the database is only ever hand-edited through a PR, and a broken one must be fixed by
    a human rather than republished (or grown) every day."""
    seen = {}
    malformed, duplicates = [], []
    for index, net in enumerate(db[key]):
        raw = net.get("bssid")
        bssid = normalize_bssid(raw)
        if bssid is None:
            malformed.append("#{} {}".format(index, json.dumps(raw, ensure_ascii=False)))
        elif bssid in seen:
            duplicates.append("#{} and #{} ({})".format(seen[bssid], index, bssid))
        else:
            seen[bssid] = index
    problems = []
    if malformed:
        problems.append("{} record(s) with a malformed bssid: {}".format(
            len(malformed), _preview(malformed)))
    if duplicates:
        problems.append("{} duplicate bssid(s): {}".format(
            len(duplicates), _preview(duplicates)))
    if problems:
        raise FatalError("database {} needs a manual fix; {}".format(path, "; ".join(problems)))
    return set(seen)


def load_denylist(path):
    """Canonical BSSIDs that were removed on request (docs/removals.md) and must never be
    added again. A missing or malformed denylist is fatal: half-applying it, or silently
    treating it as empty, would republish networks whose owners asked to be removed."""
    try:
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
    except (OSError, ValueError) as exc:
        raise FatalError("cannot read denylist {}: {}".format(path, exc))
    if not isinstance(data, dict) or not isinstance(data.get("removed"), list):
        raise FatalError("denylist {} has no 'removed' list".format(path))
    seen = {}
    problems = []
    for index, entry in enumerate(data["removed"]):
        where = "#{}".format(index)
        if not isinstance(entry, dict):
            problems.append("{} is not an object".format(where))
            continue
        keys = set(entry)
        if keys != set(DENYLIST_KEYS):
            extra = sorted(keys - set(DENYLIST_KEYS))
            missing = [k for k in DENYLIST_KEYS if k not in keys]
            detail = []
            if missing:
                detail.append("missing " + ", ".join(missing))
            if extra:
                detail.append("unexpected " + ", ".join(json.dumps(k, ensure_ascii=False)
                                                        for k in extra))
            problems.append("{} {}".format(where, "; ".join(detail)))
            continue
        raw = entry["bssid"]
        bssid = normalize_bssid(raw)
        if bssid is None or raw != bssid:
            problems.append("{} bssid {} is not a canonical xx:xx:xx:xx:xx:xx address".format(
                where, json.dumps(raw, ensure_ascii=False)))
        elif bssid in seen:
            problems.append("{} repeats {} from #{}".format(where, bssid, seen[bssid]))
        else:
            seen[bssid] = index
        date = entry["date"]
        valid_date = isinstance(date, str) and _DENY_DATE.match(date)
        if valid_date:
            try:
                datetime.date.fromisoformat(date)
            except ValueError:
                valid_date = False
        if not valid_date:
            problems.append("{} date {} is not YYYY-MM-DD".format(
                where, json.dumps(date, ensure_ascii=False)))
        issue = entry["issue"]
        if isinstance(issue, bool) or not isinstance(issue, int) or issue < 1:
            problems.append("{} issue {} is not a positive issue number".format(
                where, json.dumps(issue, ensure_ascii=False)))
    if problems:
        raise FatalError("denylist {} needs a manual fix; {} problem(s): {}".format(
            path, len(problems), _preview(problems)))
    return set(seen)


def _preview(items, limit=10):
    shown = ", ".join(items[:limit])
    return shown if len(items) <= limit else "{}, ... (+{} more)".format(shown, len(items) - limit)


def stage_db(path, db, key="networks"):
    """Write `db` to a temp file beside `path`; return a handle for commit_db.

    Nothing at `path` changes yet. This is the half that fails on a full disk or a
    read-only tree, split out so a run that publishes to several databases can finish
    all of its writing before it swaps any of them in. Throw a handle away with
    discard_db.
    """
    dump = lambda value: json.dumps(value, ensure_ascii=False)  # noqa: E731
    records = db[key]
    parts = [
        "{\n",
        '  "updated_at": {},\n'.format(dump(db["updated_at"])),
        '  "count": {},\n'.format(len(records)),
    ]
    if records:
        parts.append('  "{}": [\n'.format(key))
        parts.append(",\n".join("    " + dump(n) for n in records))
        parts.append("\n  ]\n")
    else:
        parts.append('  "{}": []\n'.format(key))
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
    except BaseException:
        _discard(tmp)
        raise
    return tmp, path


def _discard(tmp):
    """Remove a staged temp file, best effort.

    Deliberately swallows OSError. Every caller runs this while another exception is in
    flight, and on a tree that has just refused a write the remove can refuse too — which
    would replace a FatalError with a bare OSError that main() does not catch. That exits
    1, and publish_ingest.sh treats 1 as soft and commits. A leaked temp file cannot be
    published (publish stages an explicit list of data/*.json paths), so losing the
    cleanup is always the cheaper failure.
    """
    try:
        os.remove(tmp)
    except OSError:
        pass


def commit_db(staged):
    """Swap a staged write into place. On failure `path` is left as it was."""
    tmp, path = staged
    try:
        os.replace(tmp, path)
    except BaseException:
        _discard(tmp)
        raise


def discard_db(staged):
    """Drop a staged write without touching its database."""
    _discard(staged[0])


def save_db(path, db, key="networks"):
    """Atomically write valid JSON with one record per line (compact, diff-friendly)."""
    commit_db(stage_db(path, db, key))


# --- pipeline ------------------------------------------------------------------

def is_malformed(row):
    """True when a row carries no usable BSSID — classify()'s `malformed` verdict.

    run() shares this predicate so the file-level "every row is malformed" test can
    never drift from the per-row one.
    """
    if row is None or not row["MAC"].strip():
        return True
    # Cell rows (GSM/LTE/...) carry tower ids, not MACs, in this column: check Type first.
    if row["Type"].strip().upper() not in PUBLISHED_TYPES:
        return False
    return normalize_bssid(row["MAC"]) is None


def build_record(dataset, row, ssid, bssid, lat, lon, matched_by):
    """The published fields for one row. Never RSSI, altitude or accuracy (R4.12)."""
    if dataset == "bluetooth":
        # A BLE row's AuthMode is the constant "[BLE]" and its Channel is always 0, so
        # neither is published. The SSID column carries the advertised device name,
        # which is usually empty.
        return {
            "bssid": bssid,
            "name": ssid,
            "first_seen": normalize_first_seen(row["FirstSeen"]),
            "lat": lat,
            "lon": lon,
        }
    record = {
        "bssid": bssid,
        "ssid": ssid,
        "auth": row["AuthMode"].strip(),
        "channel": parse_channel(row["Channel"]),
        "first_seen": normalize_first_seen(row["FirstSeen"]),
        "lat": lat,
        "lon": lon,
    }
    if dataset == FLOCK:
        record["matched_by"] = matched_by
    return record


def classify(row, fence, known, removed=frozenset(), flock=None):
    """Route one row to the databases it belongs in.

    Returns (reason, entries, bssid, targets). `entries` is a list of (dataset, record)
    pairs to publish, and is empty for a dropped row — `reason` then says why. One row can
    produce two entries: a Flock match is published to its own database *as well as* the
    one its Type selects, so adding a rule never changes what the main map means.

    `targets` names the databases this row belongs in, whether or not they already hold
    it, and is empty for a row dropped before routing. It is what tells a duplicate that
    repeats a stored address apart from one that repeats an address added earlier in the
    same batch: `entries` cannot, because a duplicate has none.

    `known` maps a dataset to the BSSIDs it already holds. bssid is the canonical
    address, or None when the row has none.
    """
    if is_malformed(row):
        return "malformed", [], None, ()
    dataset = PUBLISHED_TYPES.get(row["Type"].strip().upper())
    if dataset is None:
        return "not_wifi", [], None, ()
    bssid = normalize_bssid(row["MAC"])
    # A removal request outranks everything, including the opt-out: the address is
    # already off the map for good, and reporting it as an opt-out would list it under
    # "already published but now opted out" and send the operator after a removal that
    # is done. It is address-scoped, so it holds for every row and every dataset.
    if bssid in removed:
        return "removed", [], bssid, ()
    # Then read the opt-out, ahead of every remaining drop. The caller registers it
    # batch-wide from this reason, so any branch that returns first silently loses it
    # and the same address is published from a row without the suffix (R4.5, R9.6).
    # Three branches used to shadow it:
    #   bad_coords / outside_area — a drive's first rows run on a stale or absent fix,
    #     so the suffix row is the one most likely to be dropped before it is read;
    #   ble_private — that test is per-dataset (BLE rows only), so it does NOT keep the
    #     address out of networks.json; a WIFI row with the same MAC is never tested.
    # The row is still dropped here and nothing out of area is stored, only withheld.
    ssid = row["SSID"]
    # An SSID we could not decode is an SSID whose opt-out we cannot verify, so it is
    # withheld rather than published. The opt-out is an `endswith` test and is the only
    # privacy filter that reads the END of a field: every other one fails closed under a
    # bad octet (a corrupt MAC is malformed, corrupt coords are bad_coords), but
    # b"Smith House_nomap\xa5" decodes to "Smith House_nomap\ufffd", which ends with
    # neither suffix and would publish the very network whose owner opted out. A
    # corrupted suffix (b"Home_nom\xa5p") fails open the same way. This is read ahead of
    # the opt-out for the reason given below: the caller registers it batch-wide, so a
    # branch that returns first loses it. A genuine U+FFFD in an SSID is withheld too —
    # rare, and the safe direction.
    if REPLACEMENT in ssid:
        return "unreadable_ssid", [], bssid, ()
    if ssid.strip().lower().endswith(OPT_OUT_SUFFIXES):
        return "opt_out", [], bssid, ()
    if dataset == "bluetooth" and not ble_address_is_stable(bssid):
        return "ble_private", [], bssid, ()
    lat = parse_coord(row["CurrentLatitude"])
    lon = parse_coord(row["CurrentLongitude"])
    if lat is None or lon is None or (lat == 0 and lon == 0):
        return "bad_coords", [], bssid, ()
    if not fence.contains(lat=lat, lon=lon):
        return "outside_area", [], bssid, ()
    matched_by = flock.match(row, bssid) if flock else None
    targets = [dataset] + ([FLOCK] if matched_by else [])
    entries = [(name, build_record(name, row, ssid, bssid, lat, lon, matched_by))
               for name in targets if bssid not in known[name]]
    if not entries:
        return "duplicate", [], bssid, targets
    return None, entries, bssid, targets


def check_data(db_paths, denylist_path):
    """Load and validate every database and the denylist. Returns (dbs, stored, removed).

    `dbs` and `stored` are keyed by dataset. A denylisted BSSID that is still in any
    database is fatal: a removal was half-done (or raced an ingest), and the device is
    still published."""
    removed = load_denylist(denylist_path)
    dbs, stored = {}, {}
    for dataset, path in db_paths.items():
        key = RECORD_KEY[dataset]
        dbs[dataset] = load_db(path, key)
        stored[dataset] = stored_bssids(dbs[dataset], path, key)
        still_published = sorted(stored[dataset] & removed)
        if still_published:
            raise FatalError(
                "database {} still contains {} removed record(s) listed in {}: {}; "
                "delete them from the database (docs/removals.md)".format(
                    path, len(still_published), denylist_path, _preview(still_published)))
    return dbs, stored, removed


def run(ingest_dir, db_path, boundary_path, denylist_path=DEFAULT_DENYLIST,
        ble_db_path=DEFAULT_BLE_DB, flock_db_path=DEFAULT_FLOCK_DB,
        flock_rules_path=DEFAULT_FLOCK_RULES, dry_run=False, now=None):
    """Run the pipeline and return a summary dict.

    Raises FatalError before any change, except on one path: the databases are swapped
    in one at a time, so a rename that fails after an earlier one succeeded raises with
    `written` naming what did change. The inbox is only emptied once every swap is done,
    so a re-run finishes the job either way.
    """
    try:
        with open(boundary_path, encoding="utf-8") as fh:
            fence = Fence(json.load(fh))
    except (OSError, ValueError, KeyError, TypeError, IndexError) as exc:
        raise FatalError("cannot load boundary {}: {}".format(boundary_path, exc))
    if not os.path.isdir(ingest_dir):
        raise FatalError("ingest directory {} does not exist".format(ingest_dir))
    db_paths = {"networks": db_path, "bluetooth": ble_db_path, FLOCK: flock_db_path}
    dbs, stored, removed = check_data(db_paths, denylist_path)
    flock_rules = load_flock_rules(flock_rules_path)
    known = {dataset: set(bssids) for dataset, bssids in stored.items()}
    # For the opt-out report, "already published" spans every database: the address is
    # on a map somewhere, and the operator has to go take it off whichever one holds it.
    # The duplicate breakdown below is NOT read this way — see there.
    stored_any = set().union(*stored.values()) if stored else set()

    summary = {
        "files_processed": [],
        "unparseable": [],
        "rows_read": 0,
        "dropped": {reason: 0 for reason, _ in REASONS},
        "duplicate_stored": 0,
        "added": 0,
        "added_by_dataset": {dataset: 0 for dataset in db_paths},
        "flock_rules": bool(flock_rules),
        "opted_out_but_published": [],
        "not_deleted": [],
        "dry_run": dry_run,
    }
    added = {dataset: [] for dataset in db_paths}
    opted_out = set()  # every BSSID seen with an opt-out SSID anywhere in this batch
    for name in candidate_files(ingest_dir):
        try:
            rows = read_log(os.path.join(ingest_dir, name))
        except (UnparseableFile, OSError) as exc:
            summary["unparseable"].append((name, str(exc)))
            continue
        # A file whose every data row is malformed is not a log we are reading
        # correctly — most likely the logger changed how it writes the MAC column.
        # Dropping all of its rows and deleting it would lose the data with an exit 0,
        # so treat the whole file as unparseable instead (R4.10).
        if rows and all(is_malformed(row) for row in rows):
            summary["unparseable"].append(
                (name, "every data row is malformed ({} row(s))".format(len(rows))))
            continue
        summary["files_processed"].append(name)
        for row in rows:
            summary["rows_read"] += 1
            reason, entries, bssid, targets = classify(
                row, fence, known, removed, flock_rules)
            if reason:
                summary["dropped"][reason] += 1
                # Split the duplicates into "we already published this" and "this batch
                # said it twice", which is how the operator spots a re-ingest of old
                # logs. Dedupe is per-dataset, so the test has to be per-dataset too:
                # against `stored` (the pre-run contents) for the databases this row
                # routes to, not against every database. Testing the union called an
                # in-batch repeat of a WIFI row "already in the database" whenever some
                # other database — bluetooth.json, flock.json — happened to hold the
                # same address, which is exactly backwards.
                if reason == "duplicate" and any(
                        bssid in stored[target] for target in targets):
                    summary["duplicate_stored"] += 1
                # "we must not publish this address" — a verified opt-out, or an SSID
                # we could not read well enough to rule one out. Both withhold every
                # other row for the same address in this batch (R4.5, R9.6).
                if reason in ("opt_out", "unreadable_ssid"):
                    opted_out.add(bssid)
                    if bssid in stored_any and bssid not in summary["opted_out_but_published"]:
                        summary["opted_out_but_published"].append(bssid)
            else:
                for dataset, record in entries:
                    known[dataset].add(bssid)
                    added[dataset].append(record)
    # An opt-out anywhere in the batch wins over the same BSSID seen without the suffix
    # (in any file order): never publish it. Its kept row is recounted as an opt-out.
    # Counted by address, not by record: a Flock match is held in two databases, but
    # withholding it is still one row dropped.
    withheld = set()
    for dataset, records in added.items():
        added[dataset] = [r for r in records if r["bssid"] not in opted_out]
        withheld.update(r["bssid"] for r in records if r["bssid"] in opted_out)
    summary["dropped"]["opt_out"] += len(withheld)
    for dataset, records in added.items():
        summary["added_by_dataset"][dataset] = len(records)
    summary["added"] = sum(summary["added_by_dataset"].values())

    if dry_run:
        return summary

    stamp = now or datetime.datetime.now(datetime.timezone.utc)
    # Write every database out before swapping any of them in. save_db is atomic per
    # file but there are three files now, and writing them in sequence meant a failure
    # on the second left the first already replaced while the run still reported that
    # nothing had been written. Staging first moves the failure an operator actually
    # meets — a full disk, a read-only tree — to a point where nothing has changed.
    staged, committed = [], 0
    try:
        for dataset, records in added.items():
            if not records:
                continue
            key = RECORD_KEY[dataset]
            db, path = dbs[dataset], db_paths[dataset]
            db[key].extend(records)
            db["count"] = len(db[key])
            db["updated_at"] = stamp.strftime("%Y-%m-%dT%H:%M:%SZ")
            try:
                staged.append(stage_db(path, db, key))
            except OSError as exc:
                raise FatalError("cannot write database {}: {}".format(path, exc))
        # Three renames still are not one atomic step. If a later one fails, report
        # which databases did change instead of claiming that none did.
        for pending in staged:
            try:
                commit_db(pending)
            except OSError as exc:
                raise FatalError("cannot write database {}: {}".format(pending[1], exc),
                                 written=[db_file for _, db_file in staged[:committed]])
            committed += 1
    except BaseException:
        # However this ended, leave no temp file behind: these sit in `data/`, which is
        # a git checkout the publish step commits from. commit_db already cleans up its
        # own failure, and discard_db is a no-op on a file that is gone.
        for pending in staged[committed:]:
            discard_db(pending)
        raise

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
        if reason == "duplicate":
            stored = summary["duplicate_stored"]
            out.append("    {:<15}{}".format("in database:", stored))
            out.append("    {:<15}{}".format("in this batch:", summary["dropped"][reason] - stored))
    out.append(line("rows added:", summary["added"]))
    for dataset in ("networks", "bluetooth", FLOCK):
        out.append(reason_line(dataset + ":", summary["added_by_dataset"][dataset]))
    if not summary["flock_rules"]:
        out.append("  (no flock rules configured: data/flock-rules.json is empty)")
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
    parser.add_argument("--ble-db", default=DEFAULT_BLE_DB,
                        help="Bluetooth database (default: data/bluetooth.json)")
    parser.add_argument("--flock-db", default=DEFAULT_FLOCK_DB,
                        help="Flock camera database (default: data/flock.json)")
    parser.add_argument("--flock-rules", default=DEFAULT_FLOCK_RULES,
                        help="what marks a row as a Flock camera (default: data/flock-rules.json)")
    parser.add_argument("--boundary", default=DEFAULT_BOUNDARY)
    parser.add_argument("--denylist", default=DEFAULT_DENYLIST,
                        help="removed BSSIDs that are never added (default: data/removed.json)")
    parser.add_argument("--dry-run", action="store_true",
                        help="report what would happen without writing or deleting")
    parser.add_argument("--check", action="store_true",
                        help="only validate the databases and the denylist, then exit")
    args = parser.parse_args(argv)
    db_paths = {"networks": args.db, "bluetooth": args.ble_db, FLOCK: args.flock_db}
    if args.check:
        try:
            check_data(db_paths, args.denylist)
            load_flock_rules(args.flock_rules)
        except FatalError as exc:
            print("error: {}".format(exc))
            return EXIT_FATAL
        print("databases, denylist and flock rules are consistent.")
        return EXIT_OK
    try:
        summary = run(args.ingest_dir, args.db, args.boundary,
                      denylist_path=args.denylist, ble_db_path=args.ble_db,
                      flock_db_path=args.flock_db, flock_rules_path=args.flock_rules,
                      dry_run=args.dry_run)
    except FatalError as exc:
        print("error: {}".format(exc))
        if exc.written:
            # Not "published": under scripts/publish_ingest.sh a fatal exit commits
            # nothing, and the runner's checkout is thrown away. What is true either way
            # is that these files changed on disk, which the blanket message below denied.
            print("{} database(s) changed on disk before the failure: {}".format(
                len(exc.written), ", ".join(os.path.relpath(p) for p in exc.written)))
            print("nothing was published and the inbox was not touched, "
                  "so re-running finishes the job.")
        else:
            print("nothing was written or deleted.")
        return EXIT_FATAL
    print(format_summary(summary))
    if summary["unparseable"] or summary["not_deleted"]:
        return EXIT_PROBLEMS
    return EXIT_OK


if __name__ == "__main__":
    sys.exit(main())
