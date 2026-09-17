"""Unit tests for scripts/ingest.py (PRD R3, R4, R8.1, R8.3).

Every test runs the pipeline inside a temporary directory built from
tests/fixtures/. Tests never read from or write to the real ingest/ folder.
"""
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

    def run_pipeline(self, *extra, boundary=BOUNDARY):
        out = io.StringIO()
        argv = ["--ingest-dir", self.inbox, "--db", self.db, "--boundary", boundary,
                "--denylist", self.denylist, *extra]
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
        out = self.assert_dropped(row("03:00:00:00:00:01", typ="BLE")
                                  + row("03:00:00:00:00:02", typ="GSM"), "not_wifi")
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
            '3 network(s) with a malformed bssid: #1 "not-a-mac", #2 null, #3 null')

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

    def test_removed_network_still_in_the_database_is_fatal(self):
        self.write_db([{"bssid": "AA-BB-CC-00-00-67", "ssid": "Gone", "auth": "",
                        "channel": 1, "first_seen": "", "lat": 34.05, "lon": -117.18}])
        self.write_denylist([self.entry("aa:bb:cc:00:00:67")])
        self.assert_fatal_and_untouched("still contains 1 removed network(s)",
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

    def remove(self, *args):
        out = io.StringIO()
        with redirect_stdout(out):
            code = remove_network.main([*args, "--db", self.db, "--denylist", self.denylist])
        return code, out.getvalue()

    def read_denylist(self):
        with open(self.denylist, encoding="utf-8") as fh:
            return json.load(fh)["removed"]

    def snapshot(self):
        result = []
        for path in (self.db, self.denylist):
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
        db_path = os.path.join(REPO, "data", "networks.json")
        stored = ingest.stored_bssids(ingest.load_db(db_path), db_path)
        removed = ingest.load_denylist(os.path.join(REPO, "data", "removed.json"))
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
        self.put("a.log", HEADER + row("0d:00:00:00:00:01") + row("0d:00:00:00:00:02", typ="BLE"))
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
        original = ingest.save_db

        def boom(*_a, **_k):
            raise OSError("disk full")

        ingest.save_db = boom
        try:
            code, out = self.run_pipeline()
        finally:
            ingest.save_db = original
        self.assertEqual(code, 2)
        self.assertEqual(self.inbox_files(), ["a.log"])
        self.assertIn("disk full", out)

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
        text = HEADER + row("17:00:00:00:00:01") + row("17:00:00:00:00:02", typ="BLE") + row("")
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


if __name__ == "__main__":
    unittest.main()
