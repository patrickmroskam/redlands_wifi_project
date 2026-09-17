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

    def tearDown(self):
        shutil.rmtree(self.tmp)

    # helpers -----------------------------------------------------------
    def write_db(self, networks, updated_at="2026-09-16T00:00:00Z"):
        with open(self.db, "w", encoding="utf-8") as fh:
            json.dump({"updated_at": updated_at, "count": len(networks),
                       "networks": networks}, fh, indent=2)
            fh.write("\n")

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
                *extra]
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

    def test_blank_lines_are_ignored(self):
        self.put("a.log", HEADER + "\n" + row("09:00:00:00:00:01") + "\n\n")
        code, out = self.run_pipeline()
        self.assertEqual(self.read_db()["count"], 1)
        self.assertIn("rows read:         1", out)


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

    def test_summary_lists_every_reason(self):
        code, out = self.run_pipeline()
        for label in ("files processed", "rows read", "bad coords", "outside area",
                      "not wifi", "opt-out", "duplicate", "malformed", "rows added"):
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
