"""Tests for scripts/publish_ingest.sh (PRD R5.3, R5.4, R4.9, R4.10).

Each test builds a throwaway git repo (a copy of the ingest script, the boundary, and
an empty database) with a bare repo as `origin`, then runs the publish script there.
Nothing touches this repo's real ingest/ folder or data/.
"""
import json
import os
import re
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
        # The real repo commits the Bluetooth and Flock databases too, so the publish
        # script must stage all three.
        for name in ("bluetooth.json", "flock.json"):
            self.write(os.path.join("data", name), json.dumps(
                {"updated_at": None, "count": 0, "devices": []}) + "\n")
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
        # The daily job declares INBOX_DIR at job level, so it is set for every step of
        # that workflow — including the one that runs these tests. Inheriting it pointed
        # the script at an inbox inside each throwaway repo, which does not exist.
        env.pop("INBOX_DIR", None)
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

    def test_bluetooth_devices_are_committed_and_pushed_too(self):
        # Without this the daily job would write data/bluetooth.json, never stage it, and
        # leave the next run's tree dirty.
        ble = ("C1:00:00:00:00:01,Speaker,[BLE],2026-9-19 23:32:05,0,-70,"
               "34.0556,-117.1825,368.00,3.25,BLE\n")
        rotating = ("70:09:71:00:00:01,,[BLE],2026-9-19 23:32:05,0,-70,"
                    "34.0556,-117.1825,368.00,3.25,BLE\n")
        self.add_log("mixed.log", HEADER + ble + rotating)
        result = self.publish()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        db = json.loads(self.remote_file("data/bluetooth.json"))
        self.assertEqual([d["bssid"] for d in db["devices"]], ["c1:00:00:00:00:01"])
        changed = git(self.remote, "show", "--name-only", "--format=", "main").splitlines()
        self.assertIn("data/bluetooth.json", changed)
        # The subject line still counts networks; the devices go in the body.
        self.assertEqual(self.remote_log()[0], "ingest: +0 networks, 1 files processed")
        body = git(self.remote, "log", "-1", "--format=%b", "main")
        self.assertIn("+1 bluetooth devices", body)
        self.assertEqual(self.remote_ls("ingest"), ["ingest/README.md"])

    def test_a_run_that_finds_nothing_leaves_every_database_untouched(self):
        self.add_log("far.log", HEADER + OUT_OF_TOWN_ROW)
        before = {name: self.remote_file("data/" + name)
                  for name in ("networks.json", "bluetooth.json", "flock.json")}
        result = self.publish()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        for name, text in before.items():
            self.assertEqual(self.remote_file("data/" + name), text, name)
        self.assertEqual(git(self.work, "status", "--porcelain"), "")

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


    def test_removal_landing_during_the_run_is_never_pushed(self):
        # The removal only touches data/removed.json, so the rebase is clean (#27).
        self.add_log("wardrive_1.log")
        bssid = "aa:bb:cc:00:00:01"  # in town in sample.log, so this run adds it
        other = os.path.join(self.tmp, "other")
        git(self.tmp, "clone", "--quiet", self.remote, other)
        with open(os.path.join(other, "data", "removed.json"), "w", encoding="utf-8") as fh:
            json.dump({"removed": [{"bssid": bssid, "date": "2026-09-17", "issue": 27}]}, fh)
        self.commit_all("remove a network", cwd=other)
        git(other, "push", "--quiet", "origin", "main")
        head = self.remote_head()
        result = self.publish()
        self.assertEqual(result.returncode, 2, result.stdout + result.stderr)
        self.assertIn("retrying once", result.stdout)
        self.assertIn("removed on request during this run", result.stdout)
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




class SeparateInboxCase(PublishCase):
    """The production layout (issue #30): raw logs live in a private inbox REPO.

    The site repo publishes the databases; the inbox repo is where the processed logs
    are deleted. No raw log may ever reach the site repo.
    """

    def setUp(self):
        super().setUp()
        self.inbox_remote = os.path.join(self.tmp, "inbox.git")
        self.inbox = os.path.join(self.tmp, "inbox")
        git(self.tmp, "init", "--quiet", "--bare", "-b", "main", self.inbox_remote)
        git(self.tmp, "init", "--quiet", "-b", "main", self.inbox)
        with open(os.path.join(self.inbox, "README.md"), "w", encoding="utf-8") as fh:
            fh.write("# raw wardrive logs\n")
        self.commit_all("seed inbox", cwd=self.inbox)
        git(self.inbox, "remote", "add", "origin", self.inbox_remote)
        git(self.inbox, "push", "--quiet", "origin", "main")

    # helpers -----------------------------------------------------------
    def add_inbox_log(self, name, text=None):
        dest = os.path.join(self.inbox, name)
        if text is None:
            shutil.copy(SAMPLE_LOG, dest)
        else:
            with open(dest, "w", encoding="utf-8") as fh:
                fh.write(text)
        self.commit_all("add " + name, cwd=self.inbox)
        git(self.inbox, "push", "--quiet", "origin", "main")

    def publish(self, *args):
        env = dict(os.environ, GITHUB_STEP_SUMMARY=self.summary,
                   GITHUB_OUTPUT=self.output, INBOX_DIR=self.inbox)
        return subprocess.run(["bash", "scripts/publish_ingest.sh", *args], cwd=self.work,
                              env=env, capture_output=True, text=True)

    def inbox_ls(self):
        return git(self.inbox_remote, "ls-tree", "--name-only", "-r", "main").splitlines()

    def inbox_log(self):
        return git(self.inbox_remote, "log", "--format=%s", "main").splitlines()

    def site_ls(self):
        return git(self.remote, "ls-tree", "--name-only", "-r", "main").splitlines()


class SeparateInbox(SeparateInboxCase):
    def test_database_is_published_here_and_the_log_is_deleted_there(self):
        self.add_inbox_log("wardrive_1.log")
        result = self.publish()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

        db = json.loads(self.remote_file("data/networks.json"))
        self.assertEqual(db["count"], 2)
        self.assertEqual(self.remote_log()[0], "ingest: +2 networks, 1 files processed")
        self.assertIn("pushed_sha=" + self.remote_head(), self.read(self.output))

        self.assertEqual(self.inbox_ls(), ["README.md"])
        self.assertEqual(self.inbox_log()[0], "ingest: 1 files processed")
        self.assertEqual(git(self.inbox_remote, "log", "-1", "--format=%an", "main"),
                         "github-actions[bot]")

    def test_no_raw_log_ever_reaches_the_public_repo(self):
        # The whole point of #30. The site commit must touch the databases only.
        self.add_inbox_log("wardrive_1.log")
        result = self.publish()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertFalse([p for p in self.site_ls() if p.endswith(".log")],
                         "a raw log was published to the public repo")
        touched = git(self.remote, "show", "--name-only", "--format=", "main").split()
        self.assertTrue(touched)
        self.assertEqual([p for p in touched if not p.startswith("data/")], [],
                         "the site commit must touch nothing outside data/")

    def test_a_log_that_adds_nothing_is_still_deleted_from_the_inbox(self):
        # Second pass over the same networks: the BSSID dedupe means no database change,
        # but the log must still go, or every later run would re-read it forever.
        self.add_inbox_log("wardrive_1.log")
        self.assertEqual(self.publish().returncode, 0)
        head = self.remote_head()

        self.add_inbox_log("wardrive_2.log")
        result = self.publish()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(self.remote_head(), head, "nothing new: R5.4 forbids a commit")
        self.assertEqual(self.inbox_ls(), ["README.md"])
        self.assertIn("only the processed logs are being deleted", result.stdout)

    def test_out_of_area_only_log_is_deleted_without_a_commit(self):
        self.add_inbox_log("away.log", HEADER + OUT_OF_TOWN_ROW)
        head = self.remote_head()
        result = self.publish()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(self.remote_head(), head)
        self.assertEqual(self.inbox_ls(), ["README.md"])

    def test_empty_inbox_touches_neither_repo(self):
        head, inbox_head = self.remote_head(), git(self.inbox_remote, "rev-parse", "main")
        result = self.publish()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("nothing changed", result.stdout)
        self.assertEqual(self.remote_head(), head)
        self.assertEqual(git(self.inbox_remote, "rev-parse", "main"), inbox_head)

    def test_an_unparseable_log_stays_in_the_inbox(self):
        self.add_inbox_log("wardrive_1.log")
        self.add_inbox_log("notes.txt", "this is not a wardrive log\n")
        result = self.publish()
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertEqual(json.loads(self.remote_file("data/networks.json"))["count"], 2)
        self.assertEqual(sorted(self.inbox_ls()), ["README.md", "notes.txt"])

    def test_dry_run_deletes_nothing_from_the_inbox(self):
        self.add_inbox_log("wardrive_1.log")
        head, inbox_head = self.remote_head(), git(self.inbox_remote, "rev-parse", "main")
        result = self.publish("--dry-run")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(self.remote_head(), head)
        self.assertEqual(git(self.inbox_remote, "rev-parse", "main"), inbox_head)
        self.assertEqual(self.inbox_ls(), ["README.md", "wardrive_1.log"])

    def test_a_new_log_arriving_mid_run_does_not_block_the_deletion(self):
        self.add_inbox_log("wardrive_1.log")
        # The owner uploads another log while the ingest is running.
        other = os.path.join(self.tmp, "other")
        git(self.tmp, "clone", "--quiet", self.inbox_remote, other)
        with open(os.path.join(other, "wardrive_9.log"), "w", encoding="utf-8") as fh:
            fh.write(HEADER + OUT_OF_TOWN_ROW)
        self.commit_all("owner adds a log", cwd=other)
        git(other, "push", "--quiet", "origin", "main")

        result = self.publish()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("rebasing", result.stdout)
        # Ours is gone; the one that arrived mid-run is untouched and waits for next time.
        self.assertEqual(sorted(self.inbox_ls()), ["README.md", "wardrive_9.log"])

    def test_the_database_is_published_even_when_the_inbox_push_fails(self):
        # Ordering guarantee: publish first, delete second. A lost deletion costs one
        # duplicate re-read; a lost publish would cost the data.
        self.add_inbox_log("wardrive_1.log")
        other = os.path.join(self.tmp, "other")
        git(self.tmp, "clone", "--quiet", self.inbox_remote, other)
        with open(os.path.join(other, "wardrive_1.log"), "a", encoding="utf-8") as fh:
            fh.write(OUT_OF_TOWN_ROW)
        self.commit_all("owner edits the same log", cwd=other)
        git(other, "push", "--quiet", "origin", "main")

        result = self.publish()
        self.assertEqual(result.returncode, 2, result.stdout + result.stderr)
        self.assertEqual(json.loads(self.remote_file("data/networks.json"))["count"], 2,
                         "the database must already be published")
        self.assertIn("wardrive_1.log", self.inbox_ls())
        self.assertIn("the database was published but the logs are still there",
                      result.stdout)

    def test_a_missing_inbox_is_a_fatal_error_not_a_silent_no_op(self):
        shutil.rmtree(self.inbox)
        result = self.publish()
        self.assertEqual(result.returncode, 2, result.stdout + result.stderr)
        self.assertIn("::error::", result.stdout)


class NestedInbox(SeparateInbox):
    """The layout CI actually uses: the inbox is checked out INSIDE the site worktree.

    Re-runs every SeparateInbox test with the inbox at `work/inbox`, ignored by the site
    repo, so the `separate_inbox` detection and the `/inbox/` ignore rule are exercised
    in the shape production runs in — not just the side-by-side shape.
    """

    def setUp(self):
        super().setUp()
        nested = os.path.join(self.work, "inbox")
        shutil.move(self.inbox, nested)
        self.inbox = nested
        with open(os.path.join(self.work, ".gitignore"), "w", encoding="utf-8") as fh:
            fh.write("/inbox/\n")
        self.commit_all("ignore the inbox checkout")
        git(self.work, "push", "--quiet", "origin", "main")

    def test_the_ignored_inbox_is_never_added_to_the_site_repo(self):
        self.add_inbox_log("wardrive_1.log")
        self.assertEqual(self.publish().returncode, 0)
        self.assertEqual([p for p in self.site_ls() if p.startswith("inbox/")], [])
        self.assertEqual(git(self.work, "status", "--porcelain", "--", "inbox"), "")


class InboxMisconfigured(SeparateInboxCase):
    def test_an_ignored_plain_directory_is_refused_instead_of_failing_opaquely(self):
        # `rev-parse --show-toplevel` walks up, so a non-repo inbox nested in the site
        # repo looks like the legacy ingest/ layout. It must be named, not guessed at.
        nested = os.path.join(self.work, "inbox")
        os.makedirs(nested)
        shutil.copy(SAMPLE_LOG, os.path.join(nested, "wardrive_1.log"))
        with open(os.path.join(self.work, ".gitignore"), "w", encoding="utf-8") as fh:
            fh.write("/inbox/\n")
        self.commit_all("ignore the inbox checkout")
        self.inbox = nested

        head = self.remote_head()
        result = self.publish()
        self.assertEqual(result.returncode, 2, result.stdout + result.stderr)
        self.assertIn("::error::", result.stdout)
        self.assertIn("misconfigured", result.stdout)
        self.assertEqual(self.remote_head(), head)
        # The logs are still there: the run refused before ingest.py could eat them.
        self.assertTrue(os.path.exists(os.path.join(nested, "wardrive_1.log")))


@unittest.skipUnless(HAVE_TOOLS, "needs git")
class WorkflowWiring(unittest.TestCase):
    def test_the_workflow_inbox_path_is_gitignored(self):
        """The checkout path in ingest.yml and the ignore rule must stay in step.

        Keeping the owner's raw logs out of this public repo rests first on the explicit
        staging allowlist; this ignore rule is the backstop. A rename of INBOX_DIR that
        forgot .gitignore would remove the backstop silently.
        """
        workflow = os.path.join(REPO, ".github", "workflows", "ingest.yml")
        with open(workflow, encoding="utf-8") as fh:
            text = fh.read()
        match = re.search(r"^\s*INBOX_DIR:\s*(\S+)\s*$", text, re.MULTILINE)
        self.assertIsNotNone(match, "ingest.yml no longer declares INBOX_DIR")
        path = match.group(1).strip("\"'")
        ignored = subprocess.run(["git", "check-ignore", "-q", path], cwd=REPO)
        self.assertEqual(ignored.returncode, 0,
                         "ingest.yml checks the private inbox out to {!r}, which "
                         ".gitignore does not cover".format(path))


class AmbientEnvironment(PublishCase):
    def test_an_inherited_inbox_dir_does_not_reach_the_default_layout(self):
        """The suite must not change behaviour because the ambient env has INBOX_DIR.

        `.github/workflows/ingest.yml` sets INBOX_DIR at job level for its own checkout,
        and the unit-test step inherits it. When these tests inherited it too, every
        legacy same-repo test looked for an inbox inside its throwaway repo and the whole
        publish suite failed — but only inside that one workflow, so ci.yml stayed green.
        """
        self.add_log("wardrive_1.log")
        os.environ["INBOX_DIR"] = "inbox"
        self.addCleanup(os.environ.pop, "INBOX_DIR", None)

        result = self.publish()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(json.loads(self.remote_file("data/networks.json"))["count"], 2)
        self.assertEqual(self.remote_ls("ingest"), ["ingest/README.md"])


if __name__ == "__main__":
    unittest.main()
