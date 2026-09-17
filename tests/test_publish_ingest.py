"""Tests for scripts/publish_ingest.sh (PRD R5.3, R5.4, R4.9, R4.10).

Each test builds a throwaway git repo (a copy of the ingest script, the boundary, and
an empty database) with a bare repo as `origin`, then runs the publish script there.
Nothing touches this repo's real ingest/ folder or data/.
"""
import json
import os
import shutil
import subprocess
import tempfile
import unittest

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAMPLE_LOG = os.path.join(REPO, "tests", "fixtures", "wigle", "sample.log")
HEADER = (
    "WigleWifi-1.4,appRelease=v1.2.0,model=ESP32 Marauder,release=v1.2.0\n"
    "MAC,SSID,AuthMode,FirstSeen,Channel,RSSI,CurrentLatitude,CurrentLongitude,"
    "AltitudeMeters,AccuracyMeters,Type\n"
)
OUT_OF_TOWN_ROW = "AA:BB:CC:00:00:09,LA Net,[WPA2_PSK],2025-3-21 23:8:20,6,-70,34.0522,-118.2437,90.00,3.25,WIFI\n"

HAVE_TOOLS = all(shutil.which(t) for t in ("git", "bash", "jq"))


def git(cwd, *args):
    return subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True,
                          text=True).stdout.strip()


@unittest.skipUnless(HAVE_TOOLS, "needs git, bash and jq")
class PublishCase(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="publish-test-")
        self.remote = os.path.join(self.tmp, "origin.git")
        self.work = os.path.join(self.tmp, "work")
        git(self.tmp, "init", "--quiet", "--bare", "-b", "main", self.remote)
        git(self.tmp, "init", "--quiet", "-b", "main", self.work)
        for rel in ("scripts/ingest.py", "scripts/publish_ingest.sh",
                    "data/redlands-boundary.geojson", "data/removed.json",
                    "ingest/README.md"):
            dest = os.path.join(self.work, rel)
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            shutil.copy2(os.path.join(REPO, rel), dest)
        self.write(os.path.join("data", "networks.json"), json.dumps(
            {"updated_at": "2026-09-16T00:00:00Z", "count": 0, "networks": []}) + "\n")
        self.commit_all("seed")
        git(self.work, "remote", "add", "origin", self.remote)
        git(self.work, "push", "--quiet", "origin", "main")
        self.summary = os.path.join(self.tmp, "summary.md")
        self.output = os.path.join(self.tmp, "output.txt")

    def tearDown(self):
        shutil.rmtree(self.tmp)

    # helpers -----------------------------------------------------------
    def write(self, rel, text):
        path = os.path.join(self.work, rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(text)

    def commit_all(self, msg, cwd=None):
        cwd = cwd or self.work
        git(cwd, "add", "-A")
        git(cwd, "-c", "user.name=t", "-c", "user.email=t@example.com",
            "commit", "--quiet", "-m", msg)

    def add_log(self, name, text=None):
        if text is None:
            shutil.copy(SAMPLE_LOG, os.path.join(self.work, "ingest", name))
        else:
            self.write(os.path.join("ingest", name), text)
        self.commit_all("add " + name)
        git(self.work, "push", "--quiet", "origin", "main")

    def publish(self, *args):
        env = dict(os.environ, GITHUB_STEP_SUMMARY=self.summary,
                   GITHUB_OUTPUT=self.output)
        return subprocess.run(["bash", "scripts/publish_ingest.sh", *args], cwd=self.work,
                              env=env, capture_output=True, text=True)

    def remote_head(self):
        return git(self.remote, "rev-parse", "main")

    def remote_log(self):
        return git(self.remote, "log", "--format=%s", "main").splitlines()

    def remote_file(self, rel):
        return git(self.remote, "show", "main:" + rel)

    def remote_ls(self, rel):
        return git(self.remote, "ls-tree", "--name-only", "main", rel + "/").splitlines()

    def read(self, path):
        if not os.path.exists(path):
            return ""
        with open(path, encoding="utf-8") as fh:
            return fh.read()


class Publishes(PublishCase):
    def test_new_networks_are_committed_and_pushed_with_the_deletion(self):
        self.add_log("wardrive_1.log")
        result = self.publish()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(self.remote_log()[0], "ingest: +2 networks, 1 files processed")
        db = json.loads(self.remote_file("data/networks.json"))
        self.assertEqual(db["count"], 2)
        self.assertEqual(self.remote_ls("ingest"), ["ingest/README.md"])
        head = self.remote_head()
        self.assertEqual(git(self.work, "rev-parse", "HEAD"), head)
        self.assertIn("pushed_sha=" + head, self.read(self.output))
        self.assertIn("rows added:        2", self.read(self.summary))
        author = git(self.remote, "log", "-1", "--format=%an", "main")
        self.assertEqual(author, "github-actions[bot]")

    def test_one_commit_touches_only_the_database_and_the_inbox(self):
        self.add_log("wardrive_1.log")
        self.write("stray.txt", "left by some other step\n")
        result = self.publish()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        changed = git(self.remote, "show", "--name-only", "--format=", "main").splitlines()
        self.assertEqual(sorted(changed), ["data/networks.json", "ingest/wardrive_1.log"])
        self.assertIn("stray.txt", git(self.work, "status", "--porcelain"))

    def test_file_with_only_dropped_rows_is_still_deleted_in_a_commit(self):
        self.add_log("far.log", HEADER + OUT_OF_TOWN_ROW)
        before = self.remote_file("data/networks.json")
        result = self.publish()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(self.remote_log()[0], "ingest: +0 networks, 1 files processed")
        self.assertEqual(self.remote_file("data/networks.json"), before)
        self.assertEqual(self.remote_ls("ingest"), ["ingest/README.md"])

    def test_push_retries_after_a_concurrent_push(self):
        self.add_log("wardrive_1.log")
        # Someone else pushes new logs after this checkout was taken.
        other = os.path.join(self.tmp, "other")
        git(self.tmp, "clone", "--quiet", self.remote, other)
        shutil.copy(SAMPLE_LOG, os.path.join(other, "ingest", "wardrive_2.log"))
        self.commit_all("owner adds a log", cwd=other)
        git(other, "push", "--quiet", "origin", "main")
        result = self.publish()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("retrying once", result.stdout)
        log = self.remote_log()
        self.assertEqual(log[0], "ingest: +2 networks, 1 files processed")
        self.assertEqual(log[1], "owner adds a log")
        # The owner's new log is kept for the next run.
        self.assertIn("ingest/wardrive_2.log", self.remote_ls("ingest"))
        self.assertIn("pushed_sha=" + self.remote_head(), self.read(self.output))

    def test_rebase_conflict_on_the_database_pushes_nothing_and_exits_2(self):
        self.add_log("wardrive_1.log")
        other = os.path.join(self.tmp, "other")
        git(self.tmp, "clone", "--quiet", self.remote, other)
        with open(os.path.join(other, "data", "networks.json"), "w", encoding="utf-8") as fh:
            fh.write(json.dumps({"updated_at": "2026-09-17T01:00:00Z", "count": 0,
                                 "networks": []}) + "\n")
        self.commit_all("hand edit of the database", cwd=other)
        git(other, "push", "--quiet", "origin", "main")
        head = self.remote_head()
        result = self.publish()
        self.assertEqual(result.returncode, 2, result.stdout + result.stderr)
        self.assertIn("::error::", result.stdout)
        self.assertIn("rebase conflict", result.stdout)
        self.assertEqual(self.remote_head(), head)
        self.assertNotIn("pushed_sha", self.read(self.output))


class DoesNotPublish(PublishCase):
    def test_empty_inbox_makes_no_commit(self):
        head = self.remote_head()
        result = self.publish()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("nothing changed", result.stdout)
        self.assertEqual(self.remote_head(), head)
        self.assertNotIn("pushed_sha", self.read(self.output))

    def test_dry_run_commits_and_deletes_nothing(self):
        self.add_log("wardrive_1.log")
        head = self.remote_head()
        result = self.publish("--dry-run")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(self.remote_head(), head)
        self.assertEqual(git(self.work, "status", "--porcelain"), "")
        self.assertIn("DRY RUN", self.read(self.summary))

    def test_fatal_ingest_error_commits_nothing_and_exits_2(self):
        self.add_log("wardrive_1.log")
        os.remove(os.path.join(self.work, "data", "redlands-boundary.geojson"))
        head = self.remote_head()
        result = self.publish()
        self.assertEqual(result.returncode, 2, result.stdout + result.stderr)
        self.assertEqual(self.remote_head(), head)
        self.assertTrue(os.path.exists(os.path.join(self.work, "ingest", "wardrive_1.log")))
        self.assertIn("::error::", result.stdout)

    def test_unknown_argument_is_rejected(self):
        result = self.publish("--force")
        self.assertEqual(result.returncode, 2)


class PartialFailure(PublishCase):
    def test_unparseable_file_is_kept_but_good_files_are_published_then_exit_1(self):
        self.add_log("wardrive_1.log")
        self.add_log("notes.txt", "this is not a wardrive log\n")
        result = self.publish()
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertEqual(self.remote_log()[0], "ingest: +2 networks, 1 files processed")
        self.assertEqual(sorted(self.remote_ls("ingest")),
                         ["ingest/README.md", "ingest/notes.txt"])
        self.assertIn("notes.txt", self.read(self.summary))

    def test_only_unparseable_files_makes_no_commit_but_still_fails(self):
        self.add_log("notes.txt", "this is not a wardrive log\n")
        head = self.remote_head()
        result = self.publish()
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertEqual(self.remote_head(), head)


    def test_untracked_unparseable_file_is_never_committed(self):
        self.add_log("wardrive_1.log")
        self.write(os.path.join("ingest", "local-notes.txt"), "not a log\n")
        result = self.publish()
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertEqual(self.remote_ls("ingest"), ["ingest/README.md"])
        self.assertIn("?? ingest/local-notes.txt", git(self.work, "status", "--porcelain"))


class Warnings(PublishCase):
    def test_report_lines_cannot_act_as_workflow_commands(self):
        self.add_log("::error::fake.log", "not a log\n")
        result = self.publish()
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        lines = result.stdout.splitlines()
        start = next(i for i, ln in enumerate(lines) if ln.startswith("::stop-commands::"))
        token = lines[start].split("::stop-commands::", 1)[1]
        end = lines.index("::{}::".format(token))
        self.assertTrue(any("::error::fake.log" in ln for ln in lines[start + 1:end]))
        self.assertFalse(any("::error::fake.log" in ln for ln in lines[end:]))


    def test_opted_out_but_published_network_becomes_an_annotation(self):
        record = {"bssid": "aa:bb:cc:00:00:07", "ssid": "Home", "auth": "[WPA2_PSK]",
                  "channel": 6, "first_seen": "2025-03-21 23:08:20",
                  "lat": 34.0556, "lon": -117.1825}
        self.write(os.path.join("data", "networks.json"), json.dumps(
            {"updated_at": "2026-09-16T00:00:00Z", "count": 1, "networks": [record]}) + "\n")
        self.add_log("opt.log", HEADER +
                     "AA:BB:CC:00:00:07,Home_nomap,[WPA2_PSK],2025-3-21 23:8:20,6,-70,"
                     "34.0556,-117.1825,368.00,3.25,WIFI\n")
        result = self.publish()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("::warning title=Opted-out network still published::aa:bb:cc:00:00:07",
                      result.stdout)


if __name__ == "__main__":
    unittest.main()
