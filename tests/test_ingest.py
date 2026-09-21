"""Unit tests for scripts/ingest.py (PRD R3, R4, R8.1, R8.3).

Every test runs the pipeline inside a temporary directory built from
tests/fixtures/. Tests never read from or write to the real ingest/ folder.
"""
import argparse
import importlib.util
import io
import json
import math
import os
import shutil
import sys
import tempfile
import unittest
from contextlib import redirect_stdout

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Load the script by path: a plain `import ingest` would resolve to the repo's
# ingest/ inbox folder as a namespace package.
_spec = importlib.util.spec_from_file_location(
    "ingest_pipeline", os.path.join(REPO, "scripts", "ingest.py"))
ingest = importlib.util.module_from_spec(_spec)
sys.modules[_spec.name] = ingest
_spec.loader.exec_module(ingest)

FIXTURES = os.path.join(REPO, "tests", "fixtures")
BOUNDARY = os.path.join(REPO, "data", "redlands-boundary.geojson")

HEADER = (
    "WigleWifi-1.4,appRelease=v1.2.0,model=ESP32 Marauder,release=v1.2.0\n"
    "MAC,SSID,AuthMode,FirstSeen,Channel,RSSI,CurrentLatitude,CurrentLongitude,"
    "AltitudeMeters,AccuracyMeters,Type\n"
)
IN_TOWN = ("34.0556", "-117.1825")      # downtown Redlands (92373)
OUT_OF_TOWN = ("34.0522", "-118.2437")  # downtown Los Angeles


def row(mac, ssid="Net", auth="[WPA2_PSK]", seen="2025-3-21 23:8:20", channel="6",
        lat=IN_TOWN[0], lon=IN_TOWN[1], typ="WIFI"):
    return ",".join([mac, ssid, auth, seen, channel, "-70", lat, lon, "368.00", "3.25", typ]) + "\n"


class PipelineCase(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="ingest-test-")
        self.inbox = os.path.join(self.tmp, "ingest")
        os.mkdir(self.inbox)
        self.db = os.path.join(self.tmp, "networks.json")
        self.write_db([])
        self.denylist = os.path.join(self.tmp, "removed.json")
        self.write_denylist([])
        self.ble_db = os.path.join(self.tmp, "bluetooth.json")
        self.flock_db = os.path.join(self.tmp, "flock.json")
        self.flock_rules = os.path.join(self.tmp, "flock-rules.json")
        self.write_flock_rules()
        # The repo commits both files, so the site never fetches a missing database.
        for path in (self.ble_db, self.flock_db):
            with open(path, "w", encoding="utf-8") as fh:
                json.dump({"updated_at": None, "count": 0, "devices": []}, fh)

    def tearDown(self):
        shutil.rmtree(self.tmp)

    # helpers -----------------------------------------------------------
    def write_db(self, networks, updated_at="2026-09-16T00:00:00Z"):
        with open(self.db, "w", encoding="utf-8") as fh:
            json.dump({"updated_at": updated_at, "count": len(networks),
                       "networks": networks}, fh, indent=2)
            fh.write("\n")

    def write_denylist(self, entries=None, raw=None):
        with open(self.denylist, "w", encoding="utf-8") as fh:
            fh.write(raw if raw is not None else json.dumps({"removed": entries}, indent=2))

    def read_db(self):
        with open(self.db, encoding="utf-8") as fh:
            return json.load(fh)

    def put(self, name, text=None, data=None):
        path = os.path.join(self.inbox, name)
        with open(path, "wb") as fh:
            fh.write(data if data is not None else text.encode("utf-8"))
        return path

    def write_flock_rules(self, ssid_patterns=None, oui_prefixes=None, raw=None):
        with open(self.flock_rules, "w", encoding="utf-8") as fh:
            fh.write(raw if raw is not None else json.dumps({
                "ssid_patterns": ssid_patterns or [],
                "oui_prefixes": oui_prefixes or []}))

    def snapshot_dbs(self):
        """The exact bytes of every database, to prove a failed run changed none of them."""
        out = {}
        for path in (self.db, self.ble_db, self.flock_db):
            with open(path, encoding="utf-8") as fh:
                out[path] = fh.read()
        return out

    def write_ble(self, devices, updated_at="2026-09-16T00:00:00Z"):
        with open(self.ble_db, "w", encoding="utf-8") as fh:
            json.dump({"updated_at": updated_at, "count": len(devices),
                       "devices": devices}, fh, indent=2)
            fh.write("\n")

    def read_ble(self):
        with open(self.ble_db, encoding="utf-8") as fh:
            return json.load(fh)

    def read_flock(self):
        with open(self.flock_db, encoding="utf-8") as fh:
            return json.load(fh)

    def run_pipeline(self, *extra, boundary=BOUNDARY):
        out = io.StringIO()
        argv = ["--ingest-dir", self.inbox, "--db", self.db, "--boundary", boundary,
                "--denylist", self.denylist, "--ble-db", self.ble_db,
                "--flock-db", self.flock_db, "--flock-rules", self.flock_rules, *extra]
        with redirect_stdout(out):
            code = ingest.main(argv)
        return code, out.getvalue()

    def inbox_files(self):
        return sorted(os.listdir(self.inbox))


class HappyPath(PipelineCase):
    def test_appends_in_area_rows_with_whitelisted_fields_and_deletes_file(self):
        shutil.copy(os.path.join(FIXTURES, "wigle", "sample.log"), self.inbox)
        code, out = self.run_pipeline()
        self.assertEqual(code, 0)
        db = self.read_db()
        self.assertEqual(db["count"], 2)
        self.assertEqual(len(db["networks"]), 2)
        self.assertNotEqual(db["updated_at"], "2026-09-16T00:00:00Z")
        self.assertRegex(db["updated_at"], r"^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$")
        first = db["networks"][0]
        self.assertEqual(first, {
            "bssid": "aa:bb:cc:00:00:01",
            "ssid": "Downtown Cafe",
            "auth": "[WPA2_PSK]",
            "channel": 9,
            "first_seen": "2025-03-21 23:08:20",
            "lat": 34.0556,
            "lon": -117.1825,
        })
        self.assertEqual(db["networks"][1]["auth"], "[OPEN]")
        self.assertEqual(self.inbox_files(), [])
        self.assertIn("rows added:        2", out)
        self.assertIn("outside area:    1", out)

    def test_never_stores_rssi_altitude_accuracy_or_type(self):
        self.put("a.log", HEADER + row("11:11:11:11:11:11"))
        self.run_pipeline()
        rec = self.read_db()["networks"][0]
        self.assertEqual(set(rec), {"bssid", "ssid", "auth", "channel", "first_seen", "lat", "lon"})

    def test_existing_records_are_kept_in_order_and_new_ones_appended(self):
        existing = {"bssid": "00:00:00:00:00:01", "ssid": "Old", "auth": "[OPEN]",
                    "channel": 1, "first_seen": "2024-01-01 00:00:00",
                    "lat": 34.05, "lon": -117.18}
        self.write_db([existing])
        self.put("a.log", HEADER + row("22:22:22:22:22:22"))
        self.run_pipeline()
        nets = self.read_db()["networks"]
        self.assertEqual(nets[0], existing)
        self.assertEqual(nets[1]["bssid"], "22:22:22:22:22:22")

    def test_output_is_valid_json_with_one_record_per_line(self):
        self.put("a.log", HEADER + row("11:11:11:11:11:11", ssid='Quote "and" comma, é')
                 + row("22:22:22:22:22:22"))
        self.run_pipeline()
        with open(self.db, encoding="utf-8") as fh:
            text = fh.read()
        db = json.loads(text)
        self.assertEqual(db["count"], len(db["networks"]))
        self.assertEqual(db["networks"][0]["ssid"], 'Quote "and" comma, é')
        record_lines = [ln for ln in text.splitlines() if '"bssid"' in ln]
        self.assertEqual(len(record_lines), 2)
        self.assertTrue(text.endswith("\n"))

    def test_database_stays_world_readable(self):
        os.chmod(self.db, 0o644)
        self.put("a.log", HEADER + row("11:11:11:11:11:11"))
        self.run_pipeline()
        self.assertEqual(os.stat(self.db).st_mode & 0o777, 0o644)
        self.assertEqual([n for n in os.listdir(self.tmp) if n.startswith(".networks-")], [])

    def test_missing_database_is_treated_as_empty(self):
        os.remove(self.db)
        self.put("a.log", HEADER + row("11:11:11:11:11:11"))
        code, _ = self.run_pipeline()
        self.assertEqual(code, 0)
        self.assertEqual(self.read_db()["count"], 1)


class DropReasons(PipelineCase):
    def assert_dropped(self, text, reason):
        self.put("a.log", HEADER + text)
        code, out = self.run_pipeline()
        self.assertEqual(code, 0)
        self.assertEqual(self.read_db()["count"], 0, out)
        return out

    def test_bad_coordinates(self):
        text = (row("01:00:00:00:00:01", lat="", lon="")
                + row("01:00:00:00:00:02", lat="abc", lon="-117.18")
                + row("01:00:00:00:00:03", lat="0", lon="0")
                + row("01:00:00:00:00:04", lat="0.000000", lon="0.0000000")
                + row("01:00:00:00:00:05", lat="nan", lon="-117.18")
                + row("01:00:00:00:00:06", lat="inf", lon="-117.18"))
        out = self.assert_dropped(text, "bad_coords")
        self.assertIn("bad coords:      6", out)

    def test_outside_area(self):
        out = self.assert_dropped(row("02:00:00:00:00:01", lat=OUT_OF_TOWN[0], lon=OUT_OF_TOWN[1]),
                                  "outside_area")
        self.assertIn("outside area:    1", out)

    def test_not_wifi(self):
        # Cell rows only: a BLE row is routed to the Bluetooth map, not dropped here.
        out = self.assert_dropped(row("03:00:00:00:00:01", typ="GSM")
                                  + row("03:00:00:00:00:02", typ="LTE"), "not_wifi")
        self.assertIn("not wifi:        2", out)

    def test_opt_out_suffixes_case_insensitive(self):
        text = (row("04:00:00:00:00:01", ssid="Home_nomap")
                + row("04:00:00:00:00:02", ssid="X_NOMAP")
                + row("04:00:00:00:00:03", ssid="y_OptOut "))
        out = self.assert_dropped(text, "opt_out")
        self.assertIn("opt-out:         3", out)

    def test_opt_out_only_matches_suffix(self):
        self.put("a.log", HEADER + row("04:00:00:00:00:09", ssid="nomap_home"))
        self.run_pipeline()
        self.assertEqual(self.read_db()["count"], 1)

    def test_duplicate_of_existing_record_is_dropped_and_existing_unchanged(self):
        existing = {"bssid": "05:00:00:00:00:0a", "ssid": "Original", "auth": "[OPEN]",
                    "channel": 1, "first_seen": "2024-01-01 00:00:00",
                    "lat": 34.05, "lon": -117.18}
        self.write_db([existing])
        before = self.read_db()
        self.put("a.log", HEADER + row("05:00:00:00:00:0A", ssid="Changed"))
        code, out = self.run_pipeline()
        self.assertEqual(code, 0)
        self.assertEqual(self.read_db(), before)
        self.assertIn("duplicate:       1", out)
        self.assertEqual(self.inbox_files(), [])

    def test_duplicate_within_batch_first_file_in_natural_order_wins(self):
        self.put("wardrive_10.log", HEADER + row("06:00:00:00:00:01", ssid="from-10"))
        self.put("wardrive_2.log", HEADER + row("06:00:00:00:00:01", ssid="from-2"))
        code, out = self.run_pipeline()
        nets = self.read_db()["networks"]
        self.assertEqual([n["ssid"] for n in nets], ["from-2"])
        self.assertIn("duplicate:       1", out)

    def test_first_surviving_occurrence_wins_within_batch(self):
        text = (row("07:00:00:00:00:01", ssid="far", lat=OUT_OF_TOWN[0], lon=OUT_OF_TOWN[1])
                + row("07:00:00:00:00:01", ssid="near"))
        self.put("a.log", HEADER + text)
        self.run_pipeline()
        self.assertEqual([n["ssid"] for n in self.read_db()["networks"]], ["near"])

    def test_malformed_row_is_dropped_but_rest_of_file_is_used(self):
        text = row("08:00:00:00:00:01") + "08:00:00:00:00:02,Trunc,[WPA2_PSK],2025-3-21 2"
        self.put("a.log", HEADER + text)
        code, out = self.run_pipeline()
        self.assertEqual(code, 0)
        self.assertEqual(self.read_db()["count"], 1)
        self.assertIn("malformed:       1", out)
        self.assertEqual(self.inbox_files(), [])

    def test_blank_mac_is_malformed(self):
        self.put("a.log", HEADER + row("") + row("08:00:00:00:00:03"))
        code, out = self.run_pipeline()
        self.assertEqual(self.read_db()["count"], 1)
        self.assertIn("malformed:       1", out)

    def test_leading_quote_ssid_cannot_swallow_later_rows(self):
        # An unquoted SSID starting with '"' must not open a CSV quote that runs into
        # the following rows (which would smuggle opt-out / out-of-area rows in).
        text = (row("11:00:00:00:00:01", ssid='"quoted start')
                + row("11:00:00:00:00:02", ssid="Hide_nomap")
                + row("11:00:00:00:00:03", lat=OUT_OF_TOWN[0], lon=OUT_OF_TOWN[1])
                + row("11:00:00:00:00:04", ssid='end quote"'))
        self.put("a.log", HEADER + text)
        code, out = self.run_pipeline()
        self.assertEqual(code, 0)
        nets = self.read_db()["networks"]
        self.assertEqual([n["ssid"] for n in nets], ['"quoted start', 'end quote"'])
        self.assertIn("opt-out:         1", out)
        self.assertIn("outside area:    1", out)

    def test_quoted_ssid_with_commas_is_unquoted(self):
        self.put("a.log", HEADER + row("12:00:00:00:00:01", ssid='"a, b ""c"", d"')
                 + row("12:00:00:00:00:02", ssid="x,y,z"))
        self.run_pipeline()
        self.assertEqual([n["ssid"] for n in self.read_db()["networks"]],
                         ['a, b "c", d', "x,y,z"])

    def test_nul_bytes_and_huge_fields_do_not_crash_the_run(self):
        text = (row("13:00:00:00:00:01", ssid="bad\x00ssid")
                + row("13:00:00:00:00:02", ssid='"' + "A" * 200_000)
                + row("13:00:00:00:00:03"))
        self.put("a.log", HEADER + text)
        self.put("b.log", HEADER + row("13:00:00:00:00:04"))
        code, out = self.run_pipeline()
        self.assertEqual(code, 0)
        self.assertEqual([n["bssid"] for n in self.read_db()["networks"]],
                         ["13:00:00:00:00:02", "13:00:00:00:00:03", "13:00:00:00:00:04"])
        self.assertIn("malformed:       1", out)

    def test_line_separator_characters_inside_ssid_do_not_split_the_row(self):
        self.put("a.log", HEADER + row("14:00:00:00:00:01", ssid="a\u2028b\x0cc\x1ed")
                 + row("14:00:00:00:00:02").replace("\n", "\r\n"))
        code, out = self.run_pipeline()
        nets = self.read_db()["networks"]
        self.assertEqual([n["ssid"] for n in nets], ["a\u2028b\x0cc\x1ed", "Net"])
        self.assertIn("malformed:       0", out)

    def test_opt_out_of_already_published_network_is_flagged_for_manual_removal(self):
        existing = {"bssid": "15:00:00:00:00:01", "ssid": "Home", "auth": "[OPEN]",
                    "channel": 1, "first_seen": "2024-01-01 00:00:00",
                    "lat": 34.05, "lon": -117.18}
        self.write_db([existing])
        self.put("a.log", HEADER + row("15:00:00:00:00:01", ssid="Home_nomap"))
        code, out = self.run_pipeline()
        self.assertEqual(code, 0)
        self.assertIn("already published but now opted out", out)
        self.assertIn("15:00:00:00:00:01", out)

    def test_blank_lines_are_ignored(self):
        self.put("a.log", HEADER + "\n" + row("09:00:00:00:00:01") + "\n\n")
        code, out = self.run_pipeline()
        self.assertEqual(self.read_db()["count"], 1)
        self.assertIn("rows read:         1", out)


class BssidDedupe(PipelineCase):
    """Issue #15: the BSSID is the network's identity, whatever its spelling."""

    def net(self, bssid, ssid="Stored"):
        return {"bssid": bssid, "ssid": ssid, "auth": "[OPEN]", "channel": 1,
                "first_seen": "2024-01-01 00:00:00", "lat": 34.05, "lon": -117.18}

    def device(self, bssid, name="Stored"):
        """A bluetooth.json record of the shape the pipeline really writes."""
        return {"bssid": bssid, "name": name, "first_seen": "2024-01-01 00:00:00",
                "lat": 34.05, "lon": -117.18}

    def test_normalize_accepts_every_supported_spelling(self):
        for raw in ("aa:bb:cc:0d:0e:0f", "AA:BB:CC:0D:0E:0F", "aa-bb-cc-0d-0e-0f",
                    "AA-BB-CC-0D-0E-0F", "aabb.cc0d.0e0f", "AABB.CC0D.0E0F",
                    "aabbcc0d0e0f", "  AaBbCc0d0E0f\t"):
            self.assertEqual(ingest.normalize_bssid(raw), "aa:bb:cc:0d:0e:0f", raw)

    def test_normalize_rejects_malformed_addresses(self):
        for raw in ("", "   ", "aa:bb:cc:dd:ee", "aa:bb:cc:dd:ee:ff:00", "aa:bb:cc:dd:ee:fg",
                    "aa:bb-cc:dd:ee:ff", "a:bb:cc:dd:ee:fff", "aabbccddeef",
                    "aabbccddeeff0", "aa:bb:cc:dd:ee:ff ,x", "aabb.ccdd.eef",
                    "aa bb cc dd ee ff", "aa::bb:cc:dd:ee:ff", "ａａ:bb:cc:dd:ee:ff",
                    "٠٠:bb:cc:dd:ee:ff", None, 42):
            self.assertIsNone(ingest.normalize_bssid(raw), repr(raw))

    def test_rows_are_stored_in_canonical_form(self):
        self.put("a.log", HEADER + row("AA-BB-CC-00-00-10") + row("aabb.cc00.0011")
                 + row("AABBCC000012"))
        code, _ = self.run_pipeline()
        self.assertEqual(code, 0)
        self.assertEqual([n["bssid"] for n in self.read_db()["networks"]],
                         ["aa:bb:cc:00:00:10", "aa:bb:cc:00:00:11", "aa:bb:cc:00:00:12"])

    def test_separator_and_case_variants_are_duplicates_within_a_batch(self):
        self.put("a.log", HEADER + row("AA:BB:CC:00:00:20", ssid="first")
                 + row("aa-bb-cc-00-00-20", ssid="dash") + row("aabb.cc00.0020", ssid="dot")
                 + row("AABBCC000020", ssid="bare"))
        code, out = self.run_pipeline()
        self.assertEqual(code, 0)
        self.assertEqual([n["ssid"] for n in self.read_db()["networks"]], ["first"])
        self.assertIn("duplicate:       3", out)
        self.assertIn("in database:   0", out)
        self.assertIn("in this batch: 3", out)

    def test_variant_of_a_stored_bssid_never_overwrites_it(self):
        self.write_db([self.net("aa:bb:cc:00:00:21")])
        before = self.read_db()
        self.put("a.log", HEADER + row("AA-BB-CC-00-00-21", ssid="Changed")
                 + row("aabbcc000021", ssid="Again"))
        code, out = self.run_pipeline()
        self.assertEqual(code, 0)
        self.assertEqual(self.read_db(), before)
        self.assertIn("in database:   2", out)
        self.assertIn("in this batch: 0", out)

    def test_duplicates_across_batches(self):
        self.put("a.log", HEADER + row("aa:bb:cc:00:00:22", ssid="day one"))
        self.run_pipeline()
        self.put("b.log", HEADER + row("AA-BB-CC-00-00-22", ssid="day two")
                 + row("aa:bb:cc:00:00:23", ssid="new"))
        code, out = self.run_pipeline()
        self.assertEqual(code, 0)
        self.assertEqual([(n["bssid"], n["ssid"]) for n in self.read_db()["networks"]],
                         [("aa:bb:cc:00:00:22", "day one"), ("aa:bb:cc:00:00:23", "new")])
        self.assertIn("in database:   1", out)
        self.assertEqual(self.inbox_files(), [])

    def test_a_batch_repeat_is_not_blamed_on_another_database_holding_it(self):
        # Dedupe is per-dataset, so the breakdown has to be too. This address sits in
        # bluetooth.json and has never been in networks.json, so the second WIFI row
        # repeats the first one *inside this batch*. Counting against the union of all
        # three databases reported it as "already in the database" — backwards, and
        # this is the line an operator reads to spot a re-ingest of old logs.
        self.write_ble([self.device("43:00:00:00:00:01")])
        self.put("a.log", HEADER + row("43:00:00:00:00:01", ssid="first")
                 + row("43:00:00:00:00:01", ssid="again"))
        code, out = self.run_pipeline()
        self.assertEqual(code, 0, out)
        self.assertEqual([n["ssid"] for n in self.read_db()["networks"]], ["first"])
        self.assertIn("duplicate:       1", out)
        self.assertIn("in database:   0", out)
        self.assertIn("in this batch: 1", out)

    def test_a_re_ingest_is_still_counted_when_another_database_holds_it_too(self):
        # The control for the test above: same two databases, but networks.json already
        # holds the address, so this really is a re-ingest and must be counted as one.
        self.write_ble([self.device("43:00:00:00:00:02")])
        self.write_db([self.net("43:00:00:00:00:02")])
        self.put("a.log", HEADER + row("43:00:00:00:00:02", ssid="again"))
        code, out = self.run_pipeline()
        self.assertEqual(code, 0, out)
        self.assertIn("duplicate:       1", out)
        self.assertIn("in database:   1", out)
        self.assertIn("in this batch: 0", out)

    def test_a_camera_already_on_the_main_map_counts_as_stored(self):
        # A Flock match routes one row to two databases. It is a re-ingest as soon as
        # either of them published the address before this run — here networks.json did
        # and flock.json did not, so the row adds nothing new on the second pass.
        self.write_flock_rules(ssid_patterns=["flock"])
        self.write_db([self.net("43:00:00:00:00:03", ssid="Flock 1")])
        self.put("a.log", HEADER + row("43:00:00:00:00:03", ssid="Flock 1"))
        code, out = self.run_pipeline()
        self.assertEqual(code, 0, out)
        # Only flock.json gains a record: networks.json already held the address.
        self.assertEqual([c["bssid"] for c in self.read_flock()["devices"]],
                         ["43:00:00:00:00:03"])
        self.assertEqual(self.read_db()["count"], 1)
        self.put("b.log", HEADER + row("43:00:00:00:00:03", ssid="Flock 1"))
        code, out = self.run_pipeline()
        self.assertEqual(code, 0, out)
        self.assertIn("duplicate:       1", out)
        self.assertIn("in database:   1", out)
        self.assertIn("in this batch: 0", out)

    def test_malformed_macs_are_dropped_as_malformed(self):
        self.put("a.log", HEADER + row("aa:bb:cc:dd:ee") + row("zz:bb:cc:dd:ee:ff")
                 + row("aa:bb:cc:dd:ee:ff:00") + row("aa:bb:cc:00:00:24"))
        code, out = self.run_pipeline()
        self.assertEqual(code, 0)
        self.assertEqual([n["bssid"] for n in self.read_db()["networks"]], ["aa:bb:cc:00:00:24"])
        self.assertIn("malformed:       3", out)

    def test_same_ssid_on_different_bssids_is_kept_as_distinct_networks(self):
        # Mesh nodes and dual-band radios: one SSID, several BSSIDs. Not duplicates.
        self.put("a.log", HEADER + row("aa:bb:cc:00:00:30", ssid="HomeMesh", channel="6")
                 + row("aa:bb:cc:00:00:31", ssid="HomeMesh", channel="36")
                 + row("ae:bb:cc:00:00:30", ssid="HomeMesh", channel="149"))
        code, out = self.run_pipeline()
        self.assertEqual(code, 0)
        self.assertEqual(self.read_db()["count"], 3)
        self.assertIn("duplicate:       0", out)

    def test_cell_rows_with_tower_ids_count_as_not_wifi(self):
        self.put("a.log", HEADER + row("310260_7_1234", typ="LTE") + row("310410_1_2", typ="GSM")
                 + row("aa:bb:cc:00:00:25"))
        code, out = self.run_pipeline()
        self.assertEqual(code, 0)
        self.assertIn("not wifi:        2", out)
        self.assertIn("malformed:       0", out)

    def test_invisible_characters_around_a_mac_are_ignored(self):
        self.put("a.log", HEADER + row("\ufeffAA:BB:CC:00:00:26") + row("\u200baabbcc000027\u200b"))
        code, _ = self.run_pipeline()
        self.assertEqual(code, 0)
        self.assertEqual([n["bssid"] for n in self.read_db()["networks"]],
                         ["aa:bb:cc:00:00:26", "aa:bb:cc:00:00:27"])

    def test_opt_out_anywhere_in_the_batch_wins_in_either_file_order(self):
        for first, second in (("Home_nomap", "Home"), ("Home", "Home_nomap")):
            with self.subTest(first=first):
                self.write_db([])
                self.put("wardrive_1.log", HEADER + row("aa:bb:cc:00:00:50", ssid=first)
                         + row("aa:bb:cc:00:00:51", ssid="Neighbour"))
                self.put("wardrive_2.log", HEADER + row("AA-BB-CC-00-00-50", ssid=second)
                         + row("aa:bb:cc:00:00:50", ssid="Home"))
                code, out = self.run_pipeline()
                self.assertEqual(code, 0)
                self.assertEqual([n["bssid"] for n in self.read_db()["networks"]],
                                 ["aa:bb:cc:00:00:51"])
                self.assertIn("rows added:        1", out)
                self.assertIn("opt-out:         2", out)
                self.assertIn("duplicate:       1", out)
                self.assertEqual(self.inbox_files(), [])

    def test_opt_out_in_batch_withholds_but_does_not_touch_other_networks(self):
        self.put("a.log", HEADER + row("aa:bb:cc:00:00:52", ssid="Cafe")
                 + row("aa:bb:cc:00:00:53", ssid="Cafe")
                 + row("aa:bb:cc:00:00:52", ssid="Cafe_optout"))
        _, dry = self.run_pipeline("--dry-run")
        self.assertIn("rows added:        1", dry)
        self.run_pipeline()
        self.assertEqual([n["bssid"] for n in self.read_db()["networks"]], ["aa:bb:cc:00:00:53"])

    def assert_opt_out_survives(self, bssid, suffix="_nomap", **bad_fix):
        """The suffix row is dropped by an earlier check; the clean row must still lose."""
        suffix_row = row(bssid, ssid="Home" + suffix, **bad_fix)
        clean_row = row(bssid, ssid="Home")
        for suffix_first in (True, False):
            with self.subTest(suffix_row_first=suffix_first):
                self.write_db([])
                first, second = ((suffix_row, clean_row) if suffix_first
                                 else (clean_row, suffix_row))
                self.put("wardrive_1.log", HEADER + first)
                self.put("wardrive_2.log", HEADER + second)
                code, out = self.run_pipeline()
                self.assertEqual(code, 0, out)
                self.assertEqual(self.read_db()["networks"], [], out)
                self.assertEqual(self.read_ble()["devices"], [], out)
                self.assertEqual(self.read_flock()["devices"], [], out)
                self.assertIn("rows added:        0", out)
                self.assertIn("opt-out:         2", out)

    def test_opt_out_is_registered_when_its_row_is_outside_the_area(self):
        # The first rows of a drive run on a stale fix, so the row carrying the
        # suffix is exactly the one most likely to be dropped before it is read.
        self.assert_opt_out_survives("aa:bb:cc:00:00:54",
                                     lat=OUT_OF_TOWN[0], lon=OUT_OF_TOWN[1])

    def test_opt_out_is_registered_when_its_row_has_no_fix(self):
        # 0,0 is how a Marauder log spells "no GPS lock yet". Both suffixes, since the
        # reordered branch is the only place either one is read.
        self.assert_opt_out_survives("aa:bb:cc:00:00:55", lat="0", lon="0")
        self.assert_opt_out_survives("aa:bb:cc:00:00:56", suffix="_optout",
                                     lat="0", lon="0")

    def test_opt_out_of_a_published_network_is_flagged_even_with_a_bad_fix(self):
        # The manual-removal flag is the operator's only signal that a network already
        # on the map has opted out, so it must not depend on that row having a fix.
        published = {"bssid": "aa:bb:cc:00:00:57", "ssid": "Home", "auth": "[WPA2_PSK]",
                     "channel": 6, "first_seen": "2025-03-21 23:08:20",
                     "lat": 34.0556, "lon": -117.1825}
        for label, bad_fix in (("no fix", {"lat": "0", "lon": "0"}),
                               ("out of area", {"lat": OUT_OF_TOWN[0],
                                                "lon": OUT_OF_TOWN[1]})):
            with self.subTest(bad_fix=label):
                self.write_db([dict(published)])
                self.put("a.log", HEADER + row(published["bssid"], ssid="Home_nomap",
                                               **bad_fix))
                code, out = self.run_pipeline()
                self.assertEqual(code, 0, out)
                self.assertIn("already published but now opted out", out)
                self.assertIn(published["bssid"], out)

    def assert_fatal_and_untouched(self, networks, *expected):
        self.write_db(networks)
        with open(self.db, "rb") as fh:
            before = fh.read()
        self.put("a.log", HEADER + row("aa:bb:cc:00:00:99"))
        code, out = self.run_pipeline()
        self.assertEqual(code, 2, out)
        self.assertEqual(self.inbox_files(), ["a.log"])
        with open(self.db, "rb") as fh:
            self.assertEqual(fh.read(), before)
        self.assertIn("needs a manual fix", out)
        self.assertIn("nothing was written or deleted", out)
        for text in expected:
            self.assertIn(text, out)

    def test_stored_exact_duplicates_are_fatal(self):
        self.assert_fatal_and_untouched(
            [self.net("aa:bb:cc:00:00:40"), self.net("aa:bb:cc:00:00:41"),
             self.net("aa:bb:cc:00:00:40")],
            "1 duplicate bssid(s): #0 and #2 (aa:bb:cc:00:00:40)")

    def test_stored_duplicates_differing_in_case_or_separator_are_fatal(self):
        self.assert_fatal_and_untouched(
            [self.net("aa:bb:cc:00:00:42"), self.net("AA-BB-CC-00-00-42"),
             self.net("aabb.cc00.0042")],
            "2 duplicate bssid(s)", "#0 and #1", "#0 and #2")

    def test_stored_malformed_or_missing_bssid_is_fatal(self):
        missing = self.net("x")
        del missing["bssid"]
        self.assert_fatal_and_untouched(
            [self.net("aa:bb:cc:00:00:43"), self.net("not-a-mac"), missing, self.net(None)],
            '3 record(s) with a malformed bssid: #1 "not-a-mac", #2 null, #3 null')

    def test_fatal_report_is_capped(self):
        self.assert_fatal_and_untouched(
            [self.net("aa:bb:cc:00:00:44") for _ in range(13)],
            "12 duplicate bssid(s)", "(+2 more)")

    def test_dry_run_also_refuses_a_database_with_duplicates(self):
        self.write_db([self.net("aa:bb:cc:00:00:45"), self.net("AA:BB:CC:00:00:45")])
        self.put("a.log", HEADER + row("aa:bb:cc:00:00:46"))
        code, out = self.run_pipeline("--dry-run")
        self.assertEqual(code, 2)
        self.assertIn("duplicate bssid", out)

    def test_stored_valid_non_canonical_spelling_is_accepted(self):
        self.write_db([self.net("AA-BB-CC-00-00-47")])
        self.put("a.log", HEADER + row("aa:bb:cc:00:00:47") + row("aa:bb:cc:00:00:48"))
        code, _ = self.run_pipeline()
        self.assertEqual(code, 0)
        self.assertEqual([n["bssid"] for n in self.read_db()["networks"]],
                         ["AA-BB-CC-00-00-47", "aa:bb:cc:00:00:48"])

    def test_opt_out_of_published_network_matches_any_spelling(self):
        self.write_db([self.net("aa:bb:cc:00:00:49")])
        self.put("a.log", HEADER + row("AA-BB-CC-00-00-49", ssid="Home_nomap"))
        _, out = self.run_pipeline()
        self.assertIn("already published but now opted out", out)
        self.assertIn("  aa:bb:cc:00:00:49", out)


class Denylist(PipelineCase):
    """Removed networks (data/removed.json, issue #27) are never added again."""

    def entry(self, bssid, date="2026-09-17", issue=27):
        return {"bssid": bssid, "date": date, "issue": issue}

    def test_denylisted_bssid_is_never_added_even_with_a_normal_ssid(self):
        self.write_denylist([self.entry("aa:bb:cc:00:00:60")])
        self.put("a.log", HEADER + row("AA:BB:CC:00:00:60", ssid="Totally Normal")
                 + row("aa-bb-cc-00-00-60", ssid="Other spelling")
                 + row("AA:BB:CC:00:00:61", ssid="Kept"))
        code, out = self.run_pipeline()
        self.assertEqual(code, 0, out)
        self.assertEqual([n["bssid"] for n in self.read_db()["networks"]],
                         ["aa:bb:cc:00:00:61"])
        self.assertIn("  removed:         2", out)
        self.assertIn("rows added:        1", out)
        self.assertEqual(self.inbox_files(), [])

    def test_removed_takes_precedence_over_other_drop_reasons(self):
        self.write_denylist([self.entry("aa:bb:cc:00:00:62")])
        self.put("a.log", HEADER
                 + row("AA:BB:CC:00:00:62", lat=OUT_OF_TOWN[0], lon=OUT_OF_TOWN[1])
                 + row("AA:BB:CC:00:00:62", ssid="x_nomap")
                 + row("AA:BB:CC:00:00:62", lat="0", lon="0"))
        _, out = self.run_pipeline()
        self.assertIn("  removed:         3", out)
        self.assertIn("  outside area:    0", out)
        self.assertIn("  opt-out:         0", out)
        self.assertNotIn("already published but now opted out", out)

    def test_dry_run_reports_removed_rows(self):
        self.write_denylist([self.entry("aa:bb:cc:00:00:63")])
        self.put("a.log", HEADER + row("AA:BB:CC:00:00:63"))
        code, out = self.run_pipeline("--dry-run")
        self.assertEqual(code, 0, out)
        self.assertIn("  removed:         1", out)
        self.assertEqual(self.inbox_files(), ["a.log"])

    def test_empty_denylist_changes_nothing(self):
        self.put("a.log", HEADER + row("AA:BB:CC:00:00:64"))
        code, out = self.run_pipeline()
        self.assertEqual(code, 0, out)
        self.assertIn("  removed:         0", out)
        self.assertEqual(self.read_db()["count"], 1)

    def assert_fatal_and_untouched(self, *expected):
        self.put("a.log", HEADER + row("AA:BB:CC:00:00:65"))
        with open(self.db, "rb") as fh:
            before = fh.read()
        code, out = self.run_pipeline()
        self.assertEqual(code, 2, out)
        self.assertIn("nothing was written or deleted", out)
        for text in expected:
            self.assertIn(text, out)
        with open(self.db, "rb") as fh:
            self.assertEqual(fh.read(), before)
        self.assertEqual(self.inbox_files(), ["a.log"])

    def test_missing_denylist_is_fatal(self):
        os.remove(self.denylist)
        self.assert_fatal_and_untouched("cannot read denylist")

    def test_unparseable_denylist_is_fatal(self):
        self.write_denylist(raw="{not json")
        self.assert_fatal_and_untouched("cannot read denylist")

    def test_denylist_without_removed_list_is_fatal(self):
        for raw in ("[]", "{}", '{"removed": {}}'):
            with self.subTest(raw=raw):
                self.write_denylist(raw=raw)
                self.assert_fatal_and_untouched("has no 'removed' list")

    def test_malformed_entries_are_fatal(self):
        good = "aa:bb:cc:00:00:66"
        cases = [
            ("not an object", [good], "#0 is not an object"),
            ("missing key", [{"bssid": good, "date": "2026-09-17"}], "#0 missing issue"),
            ("extra identifying key", [dict(self.entry(good), ssid="Home")],
             'unexpected "ssid"'),
            ("malformed bssid", [self.entry("aa:bb:cc:00:00")], "is not a canonical"),
            ("non-canonical bssid", [self.entry("AA-BB-CC-00-00-66")], "is not a canonical"),
            ("non-string bssid", [self.entry(None)], "is not a canonical"),
            ("impossible date", [self.entry(good, date="2026-02-30")], "is not YYYY-MM-DD"),
            ("date with time", [self.entry(good, date="2026-09-17T00:00")],
             "is not YYYY-MM-DD"),
            ("zero issue", [self.entry(good, issue=0)], "positive issue"),
            ("string issue", [self.entry(good, issue="27")], "positive issue"),
            ("bool issue", [self.entry(good, issue=True)], "positive issue"),
            ("repeated bssid", [self.entry(good), self.entry(good, issue=28)],
             "#1 repeats aa:bb:cc:00:00:66 from #0"),
        ]
        for name, entries, text in cases:
            with self.subTest(name):
                self.write_denylist(entries)
                self.assert_fatal_and_untouched("needs a manual fix", text)

    def test_check_mode_validates_without_touching_the_inbox(self):
        self.put("a.log", HEADER + row("AA:BB:CC:00:00:68"))
        code, out = self.run_pipeline("--check")
        self.assertEqual(code, 0, out)
        self.assertIn("consistent", out)
        self.write_db([{"bssid": "aa:bb:cc:00:00:68", "ssid": "Gone", "auth": "",
                        "channel": 1, "first_seen": "", "lat": 34.05, "lon": -117.18}])
        self.write_denylist([self.entry("aa:bb:cc:00:00:68")])
        code, out = self.run_pipeline("--check")
        self.assertEqual(code, 2, out)
        self.assertIn("still contains 1 removed record(s)", out)
        self.assertEqual(self.inbox_files(), ["a.log"])

    def test_removed_network_still_in_the_database_is_fatal(self):
        self.write_db([{"bssid": "AA-BB-CC-00-00-67", "ssid": "Gone", "auth": "",
                        "channel": 1, "first_seen": "", "lat": 34.05, "lon": -117.18}])
        self.write_denylist([self.entry("aa:bb:cc:00:00:67")])
        self.assert_fatal_and_untouched("still contains 1 removed record(s)",
                                        "aa:bb:cc:00:00:67", "docs/removals.md")


_rm_spec = importlib.util.spec_from_file_location(
    "remove_network", os.path.join(REPO, "scripts", "remove_network.py"))
remove_network = importlib.util.module_from_spec(_rm_spec)
_rm_spec.loader.exec_module(remove_network)


class RemoveNetwork(PipelineCase):
    """scripts/remove_network.py deletes the record and denylists it in one step."""

    def net(self, bssid, ssid="Stored"):
        return {"bssid": bssid, "ssid": ssid, "auth": "[WPA2_PSK]", "channel": 6,
                "first_seen": "2025-03-21 23:08:20", "lat": 34.0556, "lon": -117.1825}

    def db_paths(self):
        """Every database the ingest publishes to, keyed as ingest.RECORD_KEY keys them."""
        return {"networks": self.db, "bluetooth": self.ble_db, ingest.FLOCK: self.flock_db}

    def write_dataset(self, dataset, records):
        """Seed one dataset's database directly, whatever JSON key it uses."""
        with open(self.db_paths()[dataset], "w", encoding="utf-8") as fh:
            json.dump({"updated_at": "2026-09-16T00:00:00Z", "count": len(records),
                       ingest.RECORD_KEY[dataset]: records}, fh, indent=2)
            fh.write("\n")

    def read_dataset(self, dataset):
        with open(self.db_paths()[dataset], encoding="utf-8") as fh:
            return json.load(fh)

    def remove(self, *args):
        out = io.StringIO()
        with redirect_stdout(out):
            code = remove_network.main([*args, "--db", self.db, "--denylist", self.denylist,
                                        "--ble-db", self.ble_db, "--flock-db", self.flock_db])
        return code, out.getvalue()

    def read_denylist(self):
        with open(self.denylist, encoding="utf-8") as fh:
            return json.load(fh)["removed"]

    def snapshot(self):
        result = []
        for path in (self.db, self.ble_db, self.flock_db, self.denylist):
            with open(path, "rb") as fh:
                result.append(fh.read())
        return result

    def test_removes_record_and_denylists_it_so_ingest_never_re_adds_it(self):
        self.write_db([self.net("aa:bb:cc:00:00:70"), self.net("aa:bb:cc:00:00:71")],
                      updated_at="2026-09-17T10:00:00Z")
        code, out = self.remove("--issue", "40", "AA-BB-CC-00-00-70")
        self.assertEqual(code, 0, out)
        db = self.read_db()
        self.assertEqual([n["bssid"] for n in db["networks"]], ["aa:bb:cc:00:00:71"])
        self.assertEqual(db["count"], 1)
        self.assertEqual(db["updated_at"], "2026-09-17T10:00:00Z")
        [entry] = self.read_denylist()
        self.assertEqual(sorted(entry), ["bssid", "date", "issue"])
        self.assertEqual((entry["bssid"], entry["issue"]), ("aa:bb:cc:00:00:70", 40))
        ingest.load_denylist(self.denylist)  # valid by the ingest's own rules

        self.put("a.log", HEADER + row("AA:BB:CC:00:00:70", ssid="Back again"))
        code, out = self.run_pipeline()
        self.assertEqual(code, 0, out)
        self.assertIn("  removed:         1", out)
        self.assertEqual(self.read_db()["count"], 1)

    def test_network_not_on_the_map_is_still_denylisted(self):
        code, out = self.remove("--issue", "41", "aabbcc000072")
        self.assertEqual(code, 0, out)
        self.assertIn("no matching record", out)
        self.assertEqual([e["bssid"] for e in self.read_denylist()], ["aa:bb:cc:00:00:72"])

    def test_already_denylisted_bssid_is_not_listed_twice(self):
        old = {"bssid": "aa:bb:cc:00:00:73", "date": "2026-09-01", "issue": 5}
        self.write_denylist([old])
        code, out = self.remove("--issue", "42", "aa:bb:cc:00:00:73", "AA:BB:CC:00:00:73")
        self.assertEqual(code, 0, out)
        self.assertEqual(self.read_denylist(), [old])

    def test_invalid_input_writes_nothing(self):
        self.write_db([self.net("aa:bb:cc:00:00:74")])
        before = self.snapshot()
        for args in (["--issue", "0", "aa:bb:cc:00:00:74"],
                     ["--issue", "43", "aa:bb:cc:00:00:74", "not-a-mac"]):
            with self.subTest(args=args):
                code, out = self.remove(*args)
                self.assertEqual(code, 2, out)
                self.assertIn("nothing was written", out)
                self.assertEqual(self.snapshot(), before)

    def test_missing_database_path_is_refused(self):
        os.remove(self.db)
        with open(self.denylist, "rb") as fh:
            before = fh.read()
        code, out = self.remove("--issue", "45", "aa:bb:cc:00:00:76")
        self.assertEqual(code, 2, out)
        self.assertIn("does not exist", out)
        with open(self.denylist, "rb") as fh:
            self.assertEqual(fh.read(), before)

    def test_failed_database_write_is_reported_and_a_re_run_finishes_the_job(self):
        self.write_db([self.net("aa:bb:cc:00:00:77")])
        real_stage = remove_network.ingest.stage_db

        def boom(*_a, **_k):
            raise OSError("disk full")

        remove_network.ingest.stage_db = boom
        try:
            code, out = self.remove("--issue", "46", "aa:bb:cc:00:00:77")
        finally:
            remove_network.ingest.stage_db = real_stage
        self.assertEqual(code, 2, out)
        self.assertIn("re-run this command", out)
        self.assertNotIn("nothing was written", out)
        self.assertEqual(self.read_db()["count"], 1)
        self.assertEqual([e["bssid"] for e in self.read_denylist()], ["aa:bb:cc:00:00:77"])
        # Half-done: the ingest refuses to run.
        self.assertEqual(self.run_pipeline()[0], 2)

        code, out = self.remove("--issue", "46", "aa:bb:cc:00:00:77")
        self.assertEqual(code, 0, out)
        self.assertEqual(self.read_db()["count"], 0)
        self.assertEqual(len(self.read_denylist()), 1)
        self.assertEqual(self.run_pipeline()[0], 0)

    def test_removal_covers_every_database_the_ingest_checks(self):
        """#59: a removal honoured in one database only leaves the device published in
        the others, and then check_data() stops every later run on it."""
        for dataset in ingest.RECORD_KEY:
            with self.subTest(dataset=dataset):
                bssid = "c1:00:00:00:00:01"
                self.write_dataset(dataset, [self.net(bssid, ssid="Dual radio")])
                code, out = self.remove("--issue", "59", bssid)
                self.assertEqual(code, 0, out)
                self.assertEqual(self.read_dataset(dataset)[ingest.RECORD_KEY[dataset]], [])
                self.assertEqual(self.read_dataset(dataset)["count"], 0)
                self.assertNotIn("no matching record", out)
                # The gate that used to wedge here now has nothing to complain about.
                self.assertEqual(self.run_pipeline()[0], 0, out)
                self.write_denylist([])

    def test_one_removal_clears_the_same_address_from_every_database_at_once(self):
        """A dual-radio device answering on one address is in two databases (see
        test_wifi_and_bluetooth_may_share_a_bssid_without_colliding); one run clears both."""
        bssid = "c1:00:00:00:00:02"
        self.write_db([self.net(bssid), self.net("aa:bb:cc:00:00:99")])
        self.write_dataset("bluetooth", [self.net(bssid, ssid="BLE side")])
        self.write_dataset(ingest.FLOCK, [self.net(bssid, ssid="Flock side")])
        code, out = self.remove("--issue", "59", "C1-00-00-00-00-02")
        self.assertEqual(code, 0, out)
        self.assertEqual([n["bssid"] for n in self.read_db()["networks"]], ["aa:bb:cc:00:00:99"])
        self.assertEqual(self.read_ble()["devices"], [])
        self.assertEqual(self.read_flock()["devices"], [])
        self.assertEqual(self.run_pipeline()[0], 0)

    def test_a_write_failure_part_way_through_names_the_databases_it_changed(self):
        """Three renames are not one atomic step: say which ones landed."""
        bssid = "c1:00:00:00:00:03"
        self.write_db([self.net(bssid)])
        self.write_dataset("bluetooth", [self.net(bssid)])
        real_commit = remove_network.ingest.commit_db
        calls = []

        def boom(staged):
            calls.append(staged[1])
            if len(calls) == 1:
                return real_commit(staged)
            raise OSError("disk full")

        remove_network.ingest.commit_db = boom
        try:
            code, out = self.remove("--issue", "59", bssid)
        finally:
            remove_network.ingest.commit_db = real_commit
        self.assertEqual(code, 2, out)
        self.assertIn(os.path.basename(calls[0]), out)   # the one that did land
        self.assertIn(os.path.basename(calls[1]), out)   # the one that did not
        self.assertIn("re-run this command", out)
        self.assertNotIn("nothing was written", out)
        self.assertEqual(self.run_pipeline()[0], 2)      # wedged until the re-run
        code, out = self.remove("--issue", "59", bssid)
        self.assertEqual(code, 0, out)
        self.assertEqual(self.run_pipeline()[0], 0)
        # No staged temp file is left in data/ for the publish step to commit.
        self.assertEqual([f for f in os.listdir(self.tmp) if f.startswith(".")], [])

    def test_a_missing_secondary_database_is_refused_before_anything_is_written(self):
        self.write_db([self.net("aa:bb:cc:00:00:78")])
        os.remove(self.ble_db)
        before = [self.read_db(), self.read_denylist()]
        code, out = self.remove("--issue", "47", "aa:bb:cc:00:00:78")
        self.assertEqual(code, 2, out)
        self.assertIn("does not exist", out)
        self.assertIn("nothing was written", out)
        self.assertEqual([self.read_db(), self.read_denylist()], before)

    def test_paths_outside_the_working_directory_are_printed_as_given(self):
        self.write_db([self.net("aa:bb:cc:00:00:79")])
        code, out = self.remove("--issue", "48", "aa:bb:cc:00:00:79")
        self.assertEqual(code, 0, out)
        self.assertNotIn("..", out)
        self.assertIn(self.db, out)

    def test_remove_network_and_the_ingest_gate_cover_the_same_databases(self):
        """The silent half of #59: check_data() scans every dataset in RECORD_KEY and
        treats a leftover as fatal, so remove_network must delete from all of them.
        Adding a dataset to the pipeline without teaching this tool fails here."""
        args = argparse.Namespace(db="a.json", ble_db="b.json", flock_db="c.json")
        self.assertEqual(set(remove_network.db_paths_from_args(args)),
                         set(ingest.RECORD_KEY))
        self.assertEqual(set(self.db_paths()), set(ingest.RECORD_KEY))

    def test_refuses_a_broken_denylist(self):
        self.write_db([self.net("aa:bb:cc:00:00:75")])
        self.write_denylist(raw="{}")
        before = self.snapshot()
        code, out = self.remove("--issue", "44", "aa:bb:cc:00:00:75")
        self.assertEqual(code, 2, out)
        self.assertEqual(self.snapshot(), before)


class CommittedDatabase(unittest.TestCase):
    """The published database must pass the pipeline's own checks (catches hand edits in PRs)."""

    def test_committed_database_has_canonical_unique_bssids(self):
        path = os.path.join(REPO, "data", "networks.json")
        db = ingest.load_db(path)
        ingest.stored_bssids(db, path)  # raises FatalError on malformed/duplicate
        for net in db["networks"]:
            self.assertEqual(net["bssid"], ingest.normalize_bssid(net["bssid"]))
        self.assertEqual(db["count"], len(db["networks"]))

    def test_committed_denylist_is_valid_and_no_removed_network_is_published(self):
        removed = ingest.load_denylist(os.path.join(REPO, "data", "removed.json"))
        # Every published database, not just the map: a leftover in any of them is the
        # half-done removal check_data() refuses to run on (#59).
        for dataset, name in (("networks", "networks.json"), ("bluetooth", "bluetooth.json"),
                              (ingest.FLOCK, "flock.json")):
            with self.subTest(dataset=dataset):
                path = os.path.join(REPO, "data", name)
                key = ingest.RECORD_KEY[dataset]
                stored = ingest.stored_bssids(ingest.load_db(path, key), path, key)
                self.assertEqual(sorted(stored & removed), [])


class FieldNormalisation(unittest.TestCase):
    def test_first_seen_is_zero_padded_when_parseable(self):
        self.assertEqual(ingest.normalize_first_seen("2025-3-1 3:8:0"), "2025-03-01 03:08:00")
        self.assertEqual(ingest.normalize_first_seen("2025-12-31 23:59:59"), "2025-12-31 23:59:59")

    def test_first_seen_is_kept_raw_when_not_parseable(self):
        self.assertEqual(ingest.normalize_first_seen(" 1970 "), "1970")
        self.assertEqual(ingest.normalize_first_seen("2025-13-40 99:99:99"), "2025-13-40 99:99:99")

    def test_channel_is_int_or_none(self):
        self.assertEqual(ingest.parse_channel("11"), 11)
        self.assertIsNone(ingest.parse_channel(""))
        self.assertIsNone(ingest.parse_channel("x"))


class FilesAndExitCodes(PipelineCase):
    def test_unparseable_files_are_left_in_place_and_reported_with_exit_1(self):
        self.put("notes.txt", "hello, this is not a wigle file\n")
        self.put("binary.log", data=b"WigleWifi-1.4\n\xff\xfe\x00garbage")
        self.put("empty.log", "")
        self.put("good.log", HEADER + row("0a:00:00:00:00:01"))
        code, out = self.run_pipeline()
        self.assertEqual(code, 1)
        self.assertEqual(self.inbox_files(), ["binary.log", "empty.log", "notes.txt"])
        self.assertEqual(self.read_db()["count"], 1)
        for name in ("notes.txt", "binary.log", "empty.log"):
            self.assertIn(name, out)

    def test_missing_required_column_is_unparseable(self):
        self.put("a.log", "WigleWifi-1.4,x\nMAC,SSID,AuthMode,FirstSeen,Channel,RSSI,Type\n"
                 + "0b:00:00:00:00:01,N,[OPEN],2025-1-1 0:0:0,1,-50,WIFI\n")
        code, _ = self.run_pipeline()
        self.assertEqual(code, 1)
        self.assertEqual(self.inbox_files(), ["a.log"])

    def test_wigle_header_without_column_line_is_unparseable(self):
        self.put("a.log", "WigleWifi-1.4,appRelease=v1.2.0\n")
        self.put("b.log", "WigleWifi-1.4,appRelease=v1.2.0")
        code, out = self.run_pipeline()
        self.assertEqual(code, 1)
        self.assertEqual(self.inbox_files(), ["a.log", "b.log"])
        self.assertIn("missing column header line", out)

    def test_file_whose_every_row_is_malformed_is_kept_and_reported_with_exit_1(self):
        # A logger update that changed the MAC separator would drop every row as
        # malformed; the file must not be deleted on an exit 0 (#25, R4.10).
        text = (row("aa.bb.cc.dd.ee.01") + row("aa.bb.cc.dd.ee.02")
                + row("aa.bb.cc.dd.ee.03"))
        self.put("broken.log", HEADER + text)
        self.put("good.log", HEADER + row("0c:00:00:00:00:01"))
        code, out = self.run_pipeline()
        self.assertEqual(code, 1)
        self.assertEqual(self.inbox_files(), ["broken.log"])
        self.assertEqual([n["bssid"] for n in self.read_db()["networks"]],
                         ["0c:00:00:00:00:01"])
        self.assertIn("broken.log: every data row is malformed (3 row(s))", out)
        # The kept file's rows are not counted: it was never processed.
        self.assertIn("rows read:         1", out)
        self.assertIn("malformed:       0", out)
        self.assertIn("files processed:   1", out)

    def test_one_good_row_keeps_the_file_processable(self):
        # The rule is "every row", not "most rows": a single usable row still ships.
        self.put("a.log", HEADER + row("nonsense") + row("0d:00:00:00:00:01")
                 + row("also-nonsense"))
        code, out = self.run_pipeline()
        self.assertEqual(code, 0)
        self.assertEqual(self.inbox_files(), [])
        self.assertEqual(self.read_db()["count"], 1)
        self.assertIn("malformed:       2", out)

    def test_all_rows_malformed_is_not_triggered_by_non_wifi_rows(self):
        # Cell rows are `not wifi`, not malformed, so a cell-only log is still a log
        # we read correctly: process it and delete it.
        self.put("a.log", HEADER + row("310-410-1234", typ="GSM")
                 + row("310-410-5678", typ="LTE"))
        code, out = self.run_pipeline()
        self.assertEqual(code, 0)
        self.assertEqual(self.inbox_files(), [])
        self.assertIn("not wifi:        2", out)
        self.assertIn("malformed:       0", out)

    def test_all_rows_malformed_file_is_reported_even_when_it_is_the_only_file(self):
        self.put("a.log", HEADER + row(""))
        code, out = self.run_pipeline()
        self.assertEqual(code, 1)
        self.assertEqual(self.inbox_files(), ["a.log"])
        self.assertEqual(self.read_db()["count"], 0)
        self.assertIn("could not parse 1 file(s) (left in place):", out)
        self.assertIn("every data row is malformed (1 row(s))", out)

    def test_header_only_file_is_processed_and_deleted(self):
        self.put("a.log", HEADER)
        code, _ = self.run_pipeline()
        self.assertEqual(code, 0)
        self.assertEqual(self.inbox_files(), [])

    def test_readme_gitkeep_dotfiles_and_subdirs_are_never_touched(self):
        self.put("README.md", "# inbox\n")
        self.put(".gitkeep", "")
        self.put(".DS_Store", data=b"\x00\x00\x00\x01Bud1")
        os.mkdir(os.path.join(self.inbox, "sub"))
        code, out = self.run_pipeline()
        self.assertEqual(code, 0)
        self.assertEqual(self.inbox_files(), [".DS_Store", ".gitkeep", "README.md", "sub"])
        self.assertIn("files processed:   0", out)

    def test_no_additions_leaves_database_bytes_and_mtime_untouched(self):
        with open(self.db, "rb") as fh:
            before = fh.read()
        os.utime(self.db, (1_000_000_000, 1_000_000_000))
        self.put("a.log", HEADER + row("0c:00:00:00:00:01", lat=OUT_OF_TOWN[0], lon=OUT_OF_TOWN[1]))
        code, _ = self.run_pipeline()
        self.assertEqual(code, 0)
        with open(self.db, "rb") as fh:
            self.assertEqual(fh.read(), before)
        self.assertEqual(os.stat(self.db).st_mtime, 1_000_000_000)
        self.assertEqual(self.inbox_files(), [], "processed file is still deleted")

    def test_empty_inbox_is_a_clean_no_op(self):
        with open(self.db, "rb") as fh:
            before = fh.read()
        code, out = self.run_pipeline()
        self.assertEqual(code, 0)
        with open(self.db, "rb") as fh:
            self.assertEqual(fh.read(), before)
        self.assertIn("rows added:        0", out)

    def test_dry_run_writes_and_deletes_nothing_but_reports_counts(self):
        self.put("a.log", HEADER + row("0d:00:00:00:00:01") + row("0d:00:00:00:00:02", typ="GSM"))
        with open(self.db, "rb") as fh:
            before = fh.read()
        code, out = self.run_pipeline("--dry-run")
        self.assertEqual(code, 0)
        with open(self.db, "rb") as fh:
            self.assertEqual(fh.read(), before)
        self.assertEqual(self.inbox_files(), ["a.log"])
        self.assertIn("rows added:        1", out)
        self.assertIn("not wifi:        1", out)
        self.assertIn("dry run", out.lower())

    def test_missing_boundary_is_fatal_exit_2_and_nothing_deleted(self):
        self.put("a.log", HEADER + row("0e:00:00:00:00:01"))
        code, out = self.run_pipeline(boundary=os.path.join(self.tmp, "nope.geojson"))
        self.assertEqual(code, 2)
        self.assertEqual(self.inbox_files(), ["a.log"])
        self.assertEqual(self.read_db()["count"], 0)

    def test_boundary_without_polygons_is_fatal_exit_2(self):
        bad = os.path.join(self.tmp, "bad.geojson")
        with open(bad, "w") as fh:
            json.dump({"type": "FeatureCollection", "features": []}, fh)
        self.put("a.log", HEADER + row("0e:00:00:00:00:02"))
        code, out = self.run_pipeline(boundary=bad)
        self.assertEqual(code, 2)
        self.assertEqual(self.inbox_files(), ["a.log"])

    def test_missing_ingest_dir_is_fatal_exit_2(self):
        shutil.rmtree(self.inbox)
        with open(self.db, "rb") as fh:
            before = fh.read()
        code, out = self.run_pipeline()
        self.assertEqual(code, 2)
        self.assertIn("does not exist", out)
        with open(self.db, "rb") as fh:
            self.assertEqual(fh.read(), before)

    def test_database_with_non_object_entry_is_fatal_exit_2(self):
        with open(self.db, "w") as fh:
            json.dump({"updated_at": None, "count": 1, "networks": ["oops"]}, fh)
        self.put("a.log", HEADER + row("0f:00:00:00:00:02"))
        code, _ = self.run_pipeline()
        self.assertEqual(code, 2)
        self.assertEqual(self.inbox_files(), ["a.log"])

    def test_corrupt_database_is_fatal_exit_2_and_nothing_deleted(self):
        with open(self.db, "w") as fh:
            fh.write("{not json")
        self.put("a.log", HEADER + row("0f:00:00:00:00:01"))
        code, _ = self.run_pipeline()
        self.assertEqual(code, 2)
        self.assertEqual(self.inbox_files(), ["a.log"])
        with open(self.db) as fh:
            self.assertEqual(fh.read(), "{not json")

    def test_database_write_failure_deletes_nothing(self):
        self.put("a.log", HEADER + row("10:00:00:00:00:01"))
        original = ingest.stage_db

        def boom(*_a, **_k):
            raise OSError("disk full")

        ingest.stage_db = boom
        try:
            code, out = self.run_pipeline()
        finally:
            ingest.stage_db = original
        self.assertEqual(code, 2)
        self.assertEqual(self.inbox_files(), ["a.log"])
        self.assertIn("disk full", out)
        self.assertIn("nothing was written or deleted", out)

    def test_a_write_failure_on_one_database_leaves_all_of_them_untouched(self):
        # Every database is staged before any is swapped in, so the failure an operator
        # actually meets (a full disk, a read-only tree) still changes nothing at all —
        # which is what "nothing was written or deleted" promises. Writing them one by
        # one meant networks.json was already replaced when bluetooth.json failed.
        before = self.snapshot_dbs()
        self.put("a.log", HEADER + row("11:00:00:00:00:01") + ble_row(STATIC_RANDOM))
        original = ingest.stage_db

        def boom(path, *a, **k):
            if path == self.ble_db:
                raise OSError("disk full")
            return original(path, *a, **k)

        ingest.stage_db = boom
        try:
            code, out = self.run_pipeline()
        finally:
            ingest.stage_db = original
        self.assertEqual(code, 2)
        self.assertIn("nothing was written or deleted", out)
        self.assertEqual(self.snapshot_dbs(), before)
        self.assertEqual(self.inbox_files(), ["a.log"])
        # No temp file is left behind for the database that did stage successfully.
        self.assertEqual([n for n in os.listdir(self.tmp) if n.startswith(".networks-")], [])

    def test_a_swap_that_fails_part_way_names_the_databases_it_changed(self):
        # Three renames cannot be made one atomic step. When a later one fails the run
        # must say which databases did change: the blanket "nothing was written" sent
        # the operator away from a networks.json that had already grown.
        self.put("a.log", HEADER + row("12:00:00:00:00:01") + ble_row(STATIC_RANDOM))
        order = []
        code, out = self.fail_commit_on(self.ble_db, order=order)
        # These tests only mean what they say if networks is committed before bluetooth.
        self.assertEqual(order, [self.db, self.ble_db])
        self.assertEqual(code, 2)
        self.assertNotIn("nothing was written", out)
        self.assertIn("1 database(s) changed on disk", out)
        self.assertIn(os.path.relpath(self.db), out)
        self.assertNotIn(os.path.relpath(self.ble_db), out.split("changed on disk", 1)[1])
        # The database that never got swapped in leaves no temp file behind either.
        self.assertEqual([n for n in os.listdir(self.tmp) if n.startswith(".networks-")], [])
        # The report matches the tree: networks.json grew, bluetooth.json did not.
        self.assertEqual([n["bssid"] for n in self.read_db()["networks"]],
                         ["12:00:00:00:00:01"])
        self.assertEqual(self.read_ble()["devices"], [])
        # The inbox is untouched, so a re-run finishes the job without double-adding.
        self.assertEqual(self.inbox_files(), ["a.log"])
        code, out = self.run_pipeline()
        self.assertEqual(code, 0, out)
        self.assertEqual(self.read_db()["count"], 1)
        self.assertEqual([d["bssid"] for d in self.read_ble()["devices"]], [STATIC_RANDOM])
        self.assertEqual(self.inbox_files(), [])

    def fail_commit_on(self, target, order=None, on_discard=None):
        """Run the pipeline with the swap into `target` failing. Returns (code, out)."""
        original = ingest.commit_db

        def boom(staged):
            if order is not None:
                order.append(staged[1])
            if staged[1] == target:
                raise OSError("disk full")
            return original(staged)

        real_remove = ingest.os.remove

        def remove(path, *a, **k):
            if on_discard is not None and os.path.basename(path).startswith(".networks-"):
                raise on_discard
            return real_remove(path, *a, **k)

        ingest.commit_db = boom
        ingest.os.remove = remove
        try:
            return self.run_pipeline()
        finally:
            ingest.commit_db = original
            ingest.os.remove = real_remove

    def test_a_swap_that_fails_on_the_first_database_still_says_nothing_was_written(self):
        # written=[] must read as the blanket message, not as an empty "0 database(s)"
        # line: at that point nothing on disk had changed and the old wording is true.
        before = self.snapshot_dbs()
        self.put("a.log", HEADER + row("13:00:00:00:00:01") + ble_row(STATIC_RANDOM))
        code, out = self.fail_commit_on(self.db)
        self.assertEqual(code, 2)
        self.assertIn("nothing was written or deleted", out)
        self.assertNotIn("changed on disk", out)
        self.assertEqual(self.snapshot_dbs(), before)
        self.assertEqual(self.inbox_files(), ["a.log"])
        self.assertEqual([n for n in os.listdir(self.tmp) if n.startswith(".networks-")], [])

    def test_a_cleanup_that_fails_does_not_swallow_the_error_that_caused_it(self):
        # A tree that has just refused a rename can refuse the tidy-up remove too. If
        # that second error replaces the FatalError, main() never sees it: the process
        # dies with a traceback and exit 1, which publish_ingest.sh treats as soft and
        # commits from. Losing the temp file is always the cheaper failure.
        self.put("a.log", HEADER + row("14:00:00:00:00:01") + ble_row(STATIC_RANDOM))
        code, out = self.fail_commit_on(self.ble_db, on_discard=OSError("read-only"))
        self.assertEqual(code, 2, out)
        self.assertIn("1 database(s) changed on disk", out)
        self.assertNotIn("read-only", out)

    def test_delete_failure_is_reported_with_exit_1_after_saving(self):
        self.put("a.log", HEADER + row("16:00:00:00:00:01"))
        original = ingest.os.remove

        def refuse(path):
            raise PermissionError("read-only")

        ingest.os.remove = refuse
        try:
            code, out = self.run_pipeline()
        finally:
            ingest.os.remove = original
        self.assertEqual(code, 1)
        self.assertEqual(self.read_db()["count"], 1)
        self.assertIn("could not delete 1 file(s)", out)
        self.assertIn("a.log: read-only", out)

    def test_dry_run_counts_match_a_real_run(self):
        text = HEADER + row("17:00:00:00:00:01") + row("17:00:00:00:00:02", typ="GSM") + row("")
        self.put("a.log", text)
        _, dry = self.run_pipeline("--dry-run")
        _, real = self.run_pipeline()
        strip = lambda out: [ln for ln in out.splitlines() if not ln.startswith("DRY RUN")]  # noqa: E731
        self.assertEqual(strip(dry), strip(real))

    def test_natural_sort_handles_non_ascii_digits(self):
        self.assertEqual(sorted(["w10", "w2", "w²", "W1"], key=ingest.natural_key),
                         ["W1", "w2", "w10", "w²"])

    def test_summary_lists_every_reason(self):
        code, out = self.run_pipeline()
        for label in ("files processed", "rows read", "bad coords", "outside area",
                      "not wifi", "opt-out", "duplicate", "in database", "in this batch",
                      "malformed", "rows added"):
            self.assertIn(label, out)


class PointInPolygon(unittest.TestCase):
    SQUARE_WITH_HOLE = {"type": "Polygon", "coordinates": [
        [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
        [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]],
    ]}

    def fence(self, *geoms):
        return ingest.Fence({"type": "FeatureCollection", "features": [
            {"type": "Feature", "properties": {}, "geometry": g} for g in geoms]})

    def test_polygon_with_hole(self):
        f = self.fence(self.SQUARE_WITH_HOLE)
        self.assertTrue(f.contains(lat=1, lon=1))
        self.assertFalse(f.contains(lat=5, lon=5), "inside the hole")
        self.assertFalse(f.contains(lat=11, lon=5))
        self.assertFalse(f.contains(lat=-1, lon=-1))

    def test_multipolygon(self):
        f = self.fence({"type": "MultiPolygon", "coordinates": [
            [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
            [[[20, 20], [21, 20], [21, 21], [20, 21], [20, 20]]],
        ]})
        self.assertTrue(f.contains(lat=20.5, lon=20.5))
        self.assertTrue(f.contains(lat=0.5, lon=0.5))
        self.assertFalse(f.contains(lat=10, lon=10))

    def test_real_redlands_boundary(self):
        with open(BOUNDARY, encoding="utf-8") as fh:
            f = ingest.Fence(json.load(fh))
        self.assertTrue(f.contains(lat=float(IN_TOWN[0]), lon=float(IN_TOWN[1])))
        self.assertFalse(f.contains(lat=float(OUT_OF_TOWN[0]), lon=float(OUT_OF_TOWN[1])))
        self.assertFalse(f.contains(lat=math.nan, lon=-117.18))

    def test_fence_without_polygons_is_rejected(self):
        with self.assertRaises(ValueError):
            self.fence({"type": "Point", "coordinates": [0, 0]})


# A BLE row: the Marauder writes the device name in the SSID column, "[BLE]" as the
# auth mode and 0 as the channel, exactly like the real logs.
def ble_row(mac, name="", seen="2026-9-19 23:32:05", lat=IN_TOWN[0], lon=IN_TOWN[1]):
    return row(mac, ssid=name, auth="[BLE]", seen=seen, channel="0", lat=lat, lon=lon, typ="BLE")


# Addresses whose first octet fixes the BLE address type (top two bits).
STATIC_RANDOM = "c1:00:00:00:00:01"      # 0b11 -> stable
PUBLIC_ADDR = "84:70:d7:00:00:01"        # 0b10 -> not a valid random type, so public
RESOLVABLE = "70:09:71:00:00:01"         # 0b01 -> rotates
NON_RESOLVABLE = "05:dd:76:00:00:01"     # 0b00 -> rotates


class BluetoothDatabase(PipelineCase):
    def test_stable_addresses_are_published_and_rotating_ones_are_dropped(self):
        self.put("a.log", HEADER + ble_row(STATIC_RANDOM) + ble_row(PUBLIC_ADDR)
                 + ble_row(RESOLVABLE) + ble_row(NON_RESOLVABLE))
        code, out = self.run_pipeline()
        self.assertEqual(code, 0)
        self.assertEqual([d["bssid"] for d in self.read_ble()["devices"]],
                         [STATIC_RANDOM, PUBLIC_ADDR])
        self.assertIn("ble private:     2", out)
        self.assertIn("  bluetooth:       2", out)

    def test_ble_rows_never_reach_the_wifi_database(self):
        self.put("a.log", HEADER + ble_row(STATIC_RANDOM) + row("20:00:00:00:00:01"))
        self.run_pipeline()
        self.assertEqual([n["bssid"] for n in self.read_db()["networks"]], ["20:00:00:00:00:01"])
        self.assertEqual([d["bssid"] for d in self.read_ble()["devices"]], [STATIC_RANDOM])

    def test_published_device_carries_no_rssi_altitude_accuracy_auth_or_channel(self):
        self.put("a.log", HEADER + ble_row(STATIC_RANDOM, name="Speaker"))
        self.run_pipeline()
        device = self.read_ble()["devices"][0]
        self.assertEqual(set(device), {"bssid", "name", "first_seen", "lat", "lon"})
        self.assertEqual(device["name"], "Speaker")
        self.assertEqual(device["first_seen"], "2026-09-19 23:32:05")

    def test_cell_rows_are_still_not_wifi_rather_than_bluetooth(self):
        self.put("a.log", HEADER + row("310-410-1234", typ="GSM") + row("21:00:00:00:00:01"))
        code, out = self.run_pipeline()
        self.assertEqual(code, 0)
        self.assertIn("not wifi:        1", out)
        self.assertEqual(self.read_ble()["count"], 0)

    def test_a_ble_row_with_a_broken_mac_is_malformed(self):
        self.put("a.log", HEADER + ble_row("not-a-mac") + ble_row(STATIC_RANDOM))
        code, out = self.run_pipeline()
        self.assertIn("malformed:       1", out)
        self.assertEqual(self.read_ble()["count"], 1)

    def test_fence_opt_out_and_denylist_apply_to_bluetooth(self):
        self.write_denylist([{"bssid": "c2:00:00:00:00:02", "date": "2026-09-20", "issue": 1}])
        self.put("a.log", HEADER
                 + ble_row("c3:00:00:00:00:03", lat=OUT_OF_TOWN[0], lon=OUT_OF_TOWN[1])
                 + ble_row("c4:00:00:00:00:04", name="Beacon_nomap")
                 + ble_row("c2:00:00:00:00:02")
                 + ble_row(STATIC_RANDOM))
        code, out = self.run_pipeline()
        self.assertEqual(code, 0)
        self.assertEqual([d["bssid"] for d in self.read_ble()["devices"]], [STATIC_RANDOM])
        self.assertIn("outside area:    1", out)
        self.assertIn("opt-out:         1", out)
        self.assertIn("removed:         1", out)

    def test_an_opt_out_on_a_private_ble_row_still_withholds_the_wifi_record(self):
        # `ble_private` only tests BLE rows, so it never kept this address out of
        # networks.json — the opt-out has to be read before it, not after.
        for order in (lambda a, b: a + b, lambda a, b: b + a):
            with self.subTest():
                self.write_db([])
                self.put("a.log", HEADER + order(
                    ble_row(RESOLVABLE, name="Home_nomap"),
                    row(RESOLVABLE, ssid="Home")))
                code, out = self.run_pipeline()
                self.assertEqual(code, 0, out)
                self.assertEqual(self.read_db()["networks"], [], out)
                self.assertEqual(self.read_ble()["devices"], [], out)

    def test_an_opt_out_on_a_wifi_row_withholds_the_bluetooth_record_too(self):
        # One address, two databases: the opt-out is keyed on the address, so it
        # withholds every record it produced, not just the one that carried it.
        self.put("a.log", HEADER + row(STATIC_RANDOM, ssid="Beacon_nomap")
                 + ble_row(STATIC_RANDOM, name="Beacon"))
        code, out = self.run_pipeline()
        self.assertEqual(code, 0, out)
        self.assertEqual(self.read_ble()["devices"], [], out)
        self.assertEqual(self.read_db()["networks"], [], out)

    # --- a classic-Bluetooth (Type=BT) row's opt-out (#50) ------------------------
    # BT rows are never published, but they carry a real MAC and the device's own name,
    # so an opt-out on one must still withhold that address everywhere.
    BT_ADDR = "c1:00:00:00:00:09"

    @staticmethod
    def bt_row(mac, name=""):
        return row(mac, ssid=name, auth="[BT]", channel="0", typ="BT")

    def test_an_opt_out_on_a_bt_row_withholds_the_ble_record(self):
        for order in (lambda a, b: a + b, lambda a, b: b + a):
            with self.subTest():
                self.write_ble([])
                self.put("a.log", HEADER + order(
                    self.bt_row(self.BT_ADDR, name="Speaker_nomap"),
                    ble_row(self.BT_ADDR, name="Speaker")))
                code, out = self.run_pipeline()
                self.assertEqual(code, 0, out)
                self.assertEqual(self.read_ble()["devices"], [], out)
                # The BT row keeps its own reason; the withheld BLE row is the opt-out.
                self.assertIn("not wifi:        1", out)
                self.assertIn("opt-out:         1", out)

    def test_an_opt_out_on_a_bt_row_withholds_the_wifi_record(self):
        self.put("a.log", HEADER + self.bt_row(self.BT_ADDR, name="Speaker_OPTOUT")
                 + row(self.BT_ADDR, ssid="Speaker"))
        code, out = self.run_pipeline()
        self.assertEqual(code, 0, out)
        self.assertEqual(self.read_db()["networks"], [], out)

    def test_a_bt_opt_out_in_another_file_of_the_batch_still_wins(self):
        self.put("wardrive_1.log", HEADER + ble_row(self.BT_ADDR, name="Speaker"))
        self.put("wardrive_2.log", HEADER + self.bt_row(self.BT_ADDR, name="Speaker_nomap"))
        code, out = self.run_pipeline()
        self.assertEqual(code, 0, out)
        self.assertEqual(self.read_ble()["devices"], [], out)

    def test_an_unreadable_bt_name_withholds_the_address(self):
        line = self.bt_row(self.BT_ADDR, name="@NAME@").encode("utf-8").replace(
            b"@NAME@", b"Speaker_nomap\xa5")
        self.put("a.log", data=HEADER.encode("utf-8") + line
                 + ble_row(self.BT_ADDR, name="Speaker").encode("utf-8"))
        code, out = self.run_pipeline()
        self.assertEqual(code, 0, out)
        self.assertEqual(self.read_ble()["devices"], [], out)

    def test_a_bt_opt_out_of_a_published_device_is_flagged_for_removal(self):
        self.write_ble([{"bssid": self.BT_ADDR, "name": "Speaker",
                         "first_seen": "2026-09-19 23:32:05", "lat": 34.05, "lon": -117.18}])
        self.put("a.log", HEADER + self.bt_row(self.BT_ADDR.upper(), name="Speaker_nomap"))
        code, out = self.run_pipeline()
        self.assertEqual(code, 0, out)
        self.assertIn("already published but now opted out", out)
        self.assertIn(self.BT_ADDR, out)

    def test_a_bt_row_without_a_suffix_withholds_nothing(self):
        self.put("a.log", HEADER + self.bt_row(self.BT_ADDR, name="Speaker")
                 + ble_row(self.BT_ADDR, name="Speaker"))
        code, out = self.run_pipeline()
        self.assertEqual(code, 0, out)
        self.assertEqual([d["bssid"] for d in self.read_ble()["devices"]], [self.BT_ADDR])
        self.assertIn("not wifi:        1", out)
        self.assertIn("opt-out:         0", out)

    def test_cell_rows_with_opt_out_names_register_nothing(self):
        # A tower id is not a MAC: it must never be normalized into an address.
        self.put("a.log", HEADER + row("310260_7_1234", ssid="Carrier_nomap", typ="LTE")
                 + row("310-410-1234", ssid="Carrier_nomap", typ="GSM")
                 + row("21:00:00:00:00:09"))
        code, out = self.run_pipeline()
        self.assertEqual(code, 0, out)
        self.assertIn("not wifi:        2", out)
        self.assertIn("malformed:       0", out)
        self.assertIn("opt-out:         0", out)
        self.assertNotIn("already published but now opted out", out)
        self.assertEqual([n["bssid"] for n in self.read_db()["networks"]],
                         ["21:00:00:00:00:09"])

    def test_same_device_is_never_added_twice_across_runs(self):
        self.put("a.log", HEADER + ble_row(STATIC_RANDOM))
        self.run_pipeline()
        self.put("b.log", HEADER + ble_row(STATIC_RANDOM.upper().replace(":", "-")))
        code, out = self.run_pipeline()
        self.assertEqual(code, 0)
        self.assertEqual(self.read_ble()["count"], 1)
        self.assertIn("in database:   1", out)

    def test_wifi_and_bluetooth_may_share_a_bssid_without_colliding(self):
        # A dual-radio device can answer to the same address on both. Each database
        # dedupes on its own, so neither suppresses the other.
        self.put("a.log", HEADER + row(STATIC_RANDOM) + ble_row(STATIC_RANDOM))
        code, _ = self.run_pipeline()
        self.assertEqual(code, 0)
        self.assertEqual(self.read_db()["count"], 1)
        self.assertEqual(self.read_ble()["count"], 1)

    def test_empty_run_leaves_the_bluetooth_database_untouched(self):
        self.put("a.log", HEADER + row("22:00:00:00:00:01"))
        before = open(self.ble_db, encoding="utf-8").read() if os.path.exists(self.ble_db) else None
        self.run_pipeline()
        after = open(self.ble_db, encoding="utf-8").read() if os.path.exists(self.ble_db) else None
        self.assertEqual(before, after)


class FlockDatabase(PipelineCase):
    def test_no_rules_means_no_cameras(self):
        self.put("a.log", HEADER + row("30:00:00:00:00:01", ssid="Flock Safety 123"))
        code, out = self.run_pipeline()
        self.assertEqual(code, 0)
        self.assertEqual(self.read_flock()["count"], 0)
        self.assertIn("no flock rules configured", out)

    def test_ssid_rule_matches_case_insensitively_and_records_the_rule(self):
        self.write_flock_rules(ssid_patterns=["flock safety"])
        self.put("a.log", HEADER + row("31:00:00:00:00:01", ssid="FLOCK SAFETY 4417"))
        code, out = self.run_pipeline()
        self.assertEqual(code, 0)
        camera = self.read_flock()["devices"][0]
        self.assertEqual(camera["bssid"], "31:00:00:00:00:01")
        self.assertEqual(camera["matched_by"], "ssid:flock safety")
        self.assertIn("  flock:           1", out)

    def test_oui_rule_matches_the_address_prefix(self):
        self.write_flock_rules(oui_prefixes=["A4:DA:22"])
        self.put("a.log", HEADER + row("a4:da:22:00:00:01") + row("a4:da:23:00:00:02"))
        self.run_pipeline()
        cameras = self.read_flock()["devices"]
        self.assertEqual([c["bssid"] for c in cameras], ["a4:da:22:00:00:01"])
        self.assertEqual(cameras[0]["matched_by"], "oui:a4:da:22")

    def test_a_camera_is_published_to_both_maps_not_moved_between_them(self):
        # Adding a rule must never remove a network from the main map.
        self.write_flock_rules(ssid_patterns=["flock"])
        self.put("a.log", HEADER + row("32:00:00:00:00:01", ssid="Flock 1"))
        self.run_pipeline()
        self.assertEqual([n["bssid"] for n in self.read_db()["networks"]], ["32:00:00:00:00:01"])
        self.assertEqual([c["bssid"] for c in self.read_flock()["devices"]], ["32:00:00:00:00:01"])

    def test_a_matching_ble_device_is_a_camera_too(self):
        self.write_flock_rules(oui_prefixes=["c1:00:00"])
        self.put("a.log", HEADER + ble_row(STATIC_RANDOM, name="cam"))
        self.run_pipeline()
        self.assertEqual(self.read_ble()["count"], 1)
        self.assertEqual(self.read_flock()["count"], 1)

    def test_a_ble_camera_keeps_the_ble_record_shape(self):
        # R9.3 bars auth mode and channel from every published BLE device, including
        # the Flock copy: the shape follows the row's Type, not the destination (#42).
        self.write_flock_rules(oui_prefixes=["c1:00:00"])
        self.put("a.log", HEADER + ble_row(STATIC_RANDOM, name="cam"))
        code, _ = self.run_pipeline()
        self.assertEqual(code, 0)
        camera = self.read_flock()["devices"][0]
        self.assertEqual(sorted(camera), ["bssid", "first_seen", "lat", "lon", "matched_by", "name"])
        self.assertEqual(camera["name"], "cam")
        self.assertEqual(camera["matched_by"], "oui:c1:00:00")
        # The Bluetooth map's copy is the plain BLE record: matched_by is Flock-only.
        device = self.read_ble()["devices"][0]
        self.assertEqual(sorted(device), ["bssid", "first_seen", "lat", "lon", "name"])

    def test_a_wifi_camera_keeps_the_wifi_record_shape(self):
        self.write_flock_rules(ssid_patterns=["flock"])
        self.put("a.log", HEADER + row("35:00:00:00:00:01", ssid="Flock 5"))
        self.run_pipeline()
        camera = self.read_flock()["devices"][0]
        self.assertEqual(sorted(camera), ["auth", "bssid", "channel", "first_seen", "lat", "lon",
                                          "matched_by", "ssid"])
        self.assertNotIn("matched_by", self.read_db()["networks"][0])

    def test_a_rotating_ble_address_is_never_a_camera(self):
        # The privacy filter runs before the flock rules: a rule cannot re-admit a
        # rotating address by matching its prefix.
        self.write_flock_rules(oui_prefixes=["70:09:71"])
        self.put("a.log", HEADER + ble_row(RESOLVABLE))
        code, out = self.run_pipeline()
        self.assertEqual(code, 0)
        self.assertEqual(self.read_flock()["count"], 0)
        self.assertIn("ble private:     1", out)

    def test_opt_out_and_denylist_still_win_over_a_flock_rule(self):
        self.write_flock_rules(ssid_patterns=["flock"])
        self.write_denylist([{"bssid": "33:00:00:00:00:02", "date": "2026-09-20", "issue": 1}])
        self.put("a.log", HEADER + row("33:00:00:00:00:01", ssid="Flock_nomap")
                 + row("33:00:00:00:00:02", ssid="Flock 2"))
        code, _ = self.run_pipeline()
        self.assertEqual(code, 0)
        self.assertEqual(self.read_flock()["count"], 0)

    def test_missing_rules_file_is_not_fatal(self):
        os.remove(self.flock_rules)
        self.put("a.log", HEADER + row("34:00:00:00:00:01"))
        code, out = self.run_pipeline()
        self.assertEqual(code, 0)
        self.assertEqual(self.read_db()["count"], 1)
        self.assertIn("no flock rules configured", out)

    def test_malformed_rules_file_is_fatal_and_nothing_is_written_or_deleted(self):
        for raw in ('{"ssid_patterns": "flock"}', '{"oui_prefixes": ["zz:zz:zz"]}',
                    "[]", "{ not json"):
            with self.subTest(raw=raw):
                self.write_flock_rules(raw=raw)
                self.put("a.log", HEADER + row("35:00:00:00:00:01"))
                code, out = self.run_pipeline()
                self.assertEqual(code, 2)
                self.assertIn("nothing was written or deleted", out)
                self.assertEqual(self.inbox_files(), ["a.log"])
                self.assertEqual(self.read_db()["count"], 0)

    def test_check_flag_validates_the_rules_file(self):
        self.write_flock_rules(raw='{"ssid_patterns": [""]}')
        code, out = self.run_pipeline("--check")
        self.assertEqual(code, 2)
        self.assertIn("blank pattern", out)


class CommittedDataFiles(unittest.TestCase):
    """The files the site actually serves must stay loadable by the pipeline."""

    def test_committed_bluetooth_and_flock_databases_are_valid(self):
        for name, key in (("bluetooth.json", "devices"), ("flock.json", "devices")):
            path = os.path.join(REPO, "data", name)
            with self.subTest(name=name):
                db = ingest.load_db(path, key)
                ingest.stored_bssids(db, path, key)

    def test_committed_flock_rules_load(self):
        rules = ingest.load_flock_rules(os.path.join(REPO, "data", "flock-rules.json"))
        self.assertIsInstance(rules, ingest.FlockRules)


class UndecodableBytes(PipelineCase):
    """An 802.11 SSID is an arbitrary 32-octet string, not text: nothing requires it to
    be valid UTF-8, and the Marauder writes whatever it saw over the air. One such octet
    must not reject the thousands of well-formed rows around it (#53, R4.1)."""

    @staticmethod
    def bad_ssid_log(*macs, bad_index=0):
        """A WiGLE log whose bad_index-th row carries a raw 0xa5 byte in its SSID."""
        out = HEADER.encode("utf-8")
        for i, mac in enumerate(macs):
            line = row(mac, ssid="Cafe" if i != bad_index else "Caf¿").encode("utf-8")
            if i == bad_index:
                line = line.replace("Caf¿".encode("utf-8"), b"Caf\xa5")
            out += line
        return out

    def test_one_undecodable_ssid_byte_does_not_reject_the_whole_file(self):
        self.put("wardrive.log", data=self.bad_ssid_log(
            "0d:00:00:00:00:01", "0d:00:00:00:00:02", "0d:00:00:00:00:03", bad_index=1))
        code, out = self.run_pipeline()
        self.assertEqual(code, 0, out)
        # Processed, so deleted (R4.9) — not kept as unparseable.
        self.assertEqual(self.inbox_files(), [])
        # The two readable rows survive; the unreadable one is withheld rather than
        # published, because its opt-out cannot be verified (UnreadableSsidIsWithheld).
        self.assertEqual([n["bssid"] for n in self.read_db()["networks"]],
                         ["0d:00:00:00:00:01", "0d:00:00:00:00:03"])

    def test_only_the_unreadable_row_is_lost_not_its_neighbours(self):
        # The whole point of the change: a bad octet costs one row, not the file.
        self.put("wardrive.log", data=self.bad_ssid_log(
            "0e:00:00:00:00:01", "0e:00:00:00:00:02", bad_index=1))
        code, out = self.run_pipeline()
        self.assertEqual(code, 0, out)
        self.assertEqual([(n["bssid"], n["ssid"]) for n in self.read_db()["networks"]],
                         [("0e:00:00:00:00:01", "Cafe")])

    def test_a_bom_prefixed_log_with_a_bad_byte_still_parses_and_keeps_its_columns(self):
        # The fix must not drop the utf-8-sig BOM strip: a leaked BOM would corrupt the
        # first column name ("MAC") and make every required column look missing.
        self.put("wardrive.log", data=b"\xef\xbb\xbf" + self.bad_ssid_log(
            "0f:00:00:00:00:01", "0f:00:00:00:00:02", bad_index=0))
        code, out = self.run_pipeline()
        self.assertEqual(code, 0, out)
        # Row 0 carries the bad octet and is withheld; row 1 proves the BOM was stripped
        # (a leaked BOM would corrupt the "MAC" column and reject the file outright).
        self.assertEqual([n["bssid"] for n in self.read_db()["networks"]],
                         ["0f:00:00:00:00:02"])

    def test_a_file_that_is_not_a_wigle_log_is_still_kept_and_still_fails(self):
        # Leniency must not swallow genuine garbage: rejection moves from the decode to
        # the header check, which is the more accurate test anyway (R4.10).
        self.put("photo.log", data=b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\xa5\xff\xfe")
        self.put("good.log", HEADER + row("10:00:00:00:00:01"))
        code, out = self.run_pipeline()
        self.assertEqual(code, 1)
        self.assertEqual(self.inbox_files(), ["photo.log"])
        self.assertIn("photo.log", out)
        self.assertEqual(self.read_db()["count"], 1)

    def test_a_log_of_undecodable_bytes_after_a_valid_header_is_kept_as_all_malformed(self):
        # The R4.10 all-rows-malformed net still catches a wholly corrupt body.
        self.put("corrupt.log", data=HEADER.encode("utf-8") + b"\xa5\xff\xfe\xa5\n" * 4)
        code, out = self.run_pipeline()
        self.assertEqual(code, 1)
        self.assertEqual(self.inbox_files(), ["corrupt.log"])
        self.assertEqual(self.read_db()["count"], 0)



class DamagedLogsAreNotSilentlyAccepted(PipelineCase):
    """The file-level net asked "is every row malformed?", which one ordinary cell row
    answered "no" for a corrupt file; a partly corrupt file went unreported; and a
    malformed row returned before its opt-out was read (#55)."""

    CORRUPT = "\x00garbage line with no columns\n"

    def test_one_cell_row_cannot_vouch_for_an_otherwise_corrupt_file(self):
        self.put("a.log", HEADER + row("310-410-1234", typ="GSM") + self.CORRUPT * 20)
        code, out = self.run_pipeline()
        self.assertEqual(code, 1)
        self.assertEqual(self.inbox_files(), ["a.log"])
        self.assertIn("a.log: no usable row: 20 of 21 row(s) malformed", out)
        self.assertIn("files processed:   0", out)

    def test_a_healthy_cell_and_bluetooth_only_log_is_still_processed(self):
        # No usable row, but no damage either: nothing to keep back.
        self.put("a.log", HEADER + row("310-410-1234", typ="GSM")
                 + row("0e:00:00:00:00:01", typ="BT"))
        code, out = self.run_pipeline()
        self.assertEqual(code, 0)
        self.assertEqual(self.inbox_files(), [])
        self.assertIn("not wifi:        2", out)
        self.assertNotIn("damaged rows", out)

    def test_a_partly_corrupt_file_is_processed_and_named_with_its_damage(self):
        self.put("a.log", HEADER + row("0e:00:00:00:00:01") + row("0e:00:00:00:00:02")
                 + row("0e:00:00:00:00:03") + self.CORRUPT * 2)
        self.put("b.log", HEADER + row("0e:00:00:00:00:04"))
        code, out = self.run_pipeline()
        self.assertEqual(code, 0)
        self.assertEqual(self.inbox_files(), [])
        self.assertEqual(self.read_db()["count"], 4)
        self.assertIn("processed 1 file(s) with damaged rows (dropped as malformed):", out)
        self.assertIn("  a.log: 2 of 5 row(s)", out)
        self.assertNotIn("b.log:", out)

    def test_a_healthy_log_reports_no_damage(self):
        self.put("a.log", HEADER + row("0e:00:00:00:00:01"))
        code, out = self.run_pipeline()
        self.assertEqual(code, 0)
        self.assertNotIn("damaged rows", out)

    def test_an_opt_out_on_a_row_with_a_damaged_mac_is_registered_batch_wide(self):
        # The only row with the suffix has a bad digit in its MAC; a clean row of the
        # same device, without the suffix, is in another file. Neither is published.
        self.put("a.log", data=HEADER.encode("utf-8")
                 + row("0f:00:00:00:00:0\u00bf", ssid="Home_nomap").encode("utf-8")
                 .replace("\u00bf".encode("utf-8"), b"\xa5")
                 + row("0f:00:00:00:01:00", ssid="Neighbour").encode("utf-8"))
        self.put("b.log", HEADER + row("0f:00:00:00:00:01", ssid="Home"))
        code, out = self.run_pipeline()
        self.assertEqual(code, 0)
        self.assertEqual([n["bssid"] for n in self.read_db()["networks"]],
                         ["0f:00:00:00:01:00"])
        self.assertIn("malformed:       1", out)
        self.assertIn("opt-out:         1", out)

    def test_a_damaged_mac_opt_out_reports_an_already_published_match(self):
        self.write_db([{"bssid": "0f:00:00:00:00:02", "ssid": "Home", "auth": "[OPEN]",
                        "channel": 6, "first_seen": "2025-03-21 23:08:20",
                        "lat": 34.0556, "lon": -117.1825}])
        self.put("a.log", HEADER + row("0f:00:00:00:00:0z", ssid="Home_optout")
                 + row("0f:00:00:00:01:00"))
        code, out = self.run_pipeline()
        self.assertEqual(code, 0)
        self.assertIn("already published but now opted out", out)
        self.assertIn("  0f:00:00:00:00:02", out)

    def test_a_bt_row_with_a_broken_mac_is_malformed_and_its_opt_out_holds(self):
        self.put("a.log", HEADER + row("10:00:00:00:00:0z", ssid="Car_nomap", typ="BT")
                 + row("10:00:00:00:00:01", ssid="Car", typ="BLE"))
        code, out = self.run_pipeline()
        self.assertEqual(code, 0)
        self.assertEqual(self.read_ble()["count"], 0)
        self.assertIn("malformed:       1", out)
        self.assertIn("not wifi:        0", out)

    def test_an_opt_out_on_a_mac_too_damaged_to_match_is_reported_by_file(self):
        self.put("a.log", HEADER + row("zz:zz:zz:zz:zz:z1", ssid="Home_nomap")
                 + row("11:00:00:00:00:01"))
        code, out = self.run_pipeline()
        self.assertEqual(code, 0)
        self.assertEqual(self.read_db()["count"], 1)
        self.assertIn("opt-out on a row whose MAC is too damaged to match (check by hand):\n"
                      "  a.log", out)

    def test_a_cell_row_is_never_malformed_and_never_matched(self):
        self.put("a.log", HEADER + row("not-a-mac_", ssid="Tower_nomap", typ="LTE")
                 + row("12:00:00:00:00:01"))
        code, out = self.run_pipeline()
        self.assertEqual(code, 0)
        self.assertEqual(self.read_db()["count"], 1)
        self.assertIn("malformed:       0", out)
        self.assertNotIn("too damaged", out)


class UnreadableSsidIsWithheld(PipelineCase):
    """Decoding leniently means an SSID can arrive unreadable. The opt-out is the one
    privacy filter that reads the END of a field, so a trailing bad octet would slip an
    opted-out network onto the public map. Fail closed instead (#53)."""

    @staticmethod
    def log(*rows):
        return HEADER.encode("utf-8") + b"".join(
            r if isinstance(r, bytes) else r.encode("utf-8") for r in rows)

    @staticmethod
    def bad(mac, ssid_bytes, **kw):
        line = row(mac, ssid="¿SSID¿", **kw).encode("utf-8")
        return line.replace("¿SSID¿".encode("utf-8"), ssid_bytes)

    def test_a_trailing_bad_octet_does_not_defeat_the_nomap_opt_out(self):
        self.put("drive.log", data=self.log(
            self.bad("cc:00:00:00:00:01", b"Smith House_nomap\xa5"),
            row("cc:00:00:00:00:02")))
        code, out = self.run_pipeline()
        self.assertEqual(code, 0, out)
        # The opted-out address must NOT reach the public map.
        self.assertEqual([n["bssid"] for n in self.read_db()["networks"]],
                         ["cc:00:00:00:00:02"])

    def test_a_corrupted_opt_out_suffix_is_also_withheld(self):
        self.put("drive.log", data=self.log(self.bad("cc:00:00:00:00:03", b"Home_nom\xa5p")))
        code, out = self.run_pipeline()
        self.assertEqual(code, 0, out)
        self.assertEqual(self.read_db()["networks"], [])

    def test_an_unreadable_ssid_withholds_that_address_across_the_whole_batch(self):
        # The same address seen cleanly elsewhere must not sneak past the withheld row.
        self.put("a.log", data=self.log(self.bad("cc:00:00:00:00:04", b"Smith_nomap\xa5")))
        self.put("b.log", HEADER + row("cc:00:00:00:00:04", ssid="Smith"))
        code, out = self.run_pipeline()
        self.assertEqual(code, 0, out)
        self.assertEqual(self.read_db()["networks"], [])

    def test_it_is_reported_under_its_own_reason(self):
        self.put("drive.log", data=self.log(self.bad("cc:00:00:00:00:05", b"Caf\xa5")))
        code, out = self.run_pipeline()
        self.assertEqual(code, 0, out)
        self.assertIn("unreadable ssid", out)

    def test_a_bad_octet_before_the_suffix_still_registers_the_opt_out(self):
        # Pre-existing behaviour that must not regress: this one already dropped
        # correctly, because the suffix itself survived at the end of the field.
        self.put("drive.log", data=self.log(self.bad("cc:00:00:00:00:06", b"Caf\xe9_nomap")))
        code, out = self.run_pipeline()
        self.assertEqual(code, 0, out)
        self.assertEqual(self.read_db()["networks"], [])

    def test_a_clean_log_is_untouched_by_the_new_branch(self):
        self.put("drive.log", HEADER + row("cc:00:00:00:00:07") + row("cc:00:00:00:00:08"))
        code, out = self.run_pipeline()
        self.assertEqual(code, 0, out)
        self.assertEqual(len(self.read_db()["networks"]), 2)
        self.assertNotIn("unreadable ssid:  1", out)


if __name__ == "__main__":
    unittest.main()
