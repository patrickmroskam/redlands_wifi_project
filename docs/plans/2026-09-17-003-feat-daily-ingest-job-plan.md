---
title: "feat: Daily ingest job (GitHub Actions → commit to main → Pages)"
type: feat
status: active
date: 2026-09-17
origin: docs/spec/PRD.md
issue: 5
---

# feat: Daily ingest job

## Summary

Add a scheduled GitHub Actions workflow, "Ingest wardrive logs". Once a day it runs
`scripts/ingest.py` on the `ingest/` inbox, commits the database change and the deleted
logs to `main` as one commit, and makes sure GitHub Pages rebuilds. The commit-and-push
logic lives in a small shell script, so unit tests can run it against throwaway git repos.
The workflow file itself only wires the script together.

## Problem Frame

The ingest pipeline from #3 exists, but nothing runs it. PRD R5 asks for a daily run and
a manual trigger. The job must commit only when something changed, and it must request only
the permissions it needs. R4.10 adds one more rule: a file that can't be parsed must fail the
job visibly, but the files that were processed must still be committed. Pushes made with
`GITHUB_TOKEN` do not trigger other workflows, so CI does not run on the daily commit. The
job therefore runs the unit tests itself before it touches data.

## Requirements

- R5.1, R5.2: a daily `schedule` trigger plus `workflow_dispatch`.
- R5.3, R5.4: commit and push to `main` only when the database or the inbox changed.
- R5.5: least-privilege permissions, scoped to the job.
- R4.9, R4.10: deletions go in the same commit as the database change. On an unparseable file the processed work is still committed, then the job fails.
- Issue #5: the summary appears in the job summary panel. The job has a `concurrency` group. It uses `GITHUB_TOKEN` only, with no PAT or secrets. The Pages rebuild after the push is verified, with an API fallback. This PR must not process the real `ingest/` files; that is #8.

## Key Technical Decisions

- **Logic in `scripts/publish_ingest.sh`, not inline YAML.** Workflow YAML can't be unit tested. A script can be run against a temp repo with a bare remote. It is bash, and it stays compatible with macOS bash 3.2 so local runs work.
- **Exit-code contract (from #3).** Exit 2 (fatal) → no commit, fail. Exit 1 → commit whatever changed, then fail. Exit 0 → commit if anything changed.
- **Stage only `data/networks.json` and `ingest/`.** A stray file written by the job can never be published by accident.
- **Commit message `ingest: +N networks, M files processed`.** N is the `count` delta against `HEAD`, read with `jq`, which the runners ship. M is the number of staged deletions under `ingest/`.
- **Push the current branch, with one `pull --rebase` retry.** The owner may push new logs while the job runs; those touch different paths, so a rebase is clean. The workflow refuses non-dry runs on any ref other than `main`.
- **Pages fallback needs `pages: write`.** Pages builds for this repo show up in `GET /pages/builds` and are keyed by commit. After a push, the job polls for a build of the pushed SHA for about 2 minutes. If none appears, it calls `POST /pages/builds`. This adds one permission beyond the PRD's `contents: write` example. It is job-scoped, and it is recorded in the PR for the PRD ratification. The top-level `permissions: {}`.
- **`dry_run` dispatch input.** It passes `--dry-run`, and the commit step is skipped. This gives a safe manual acceptance run.
- **Cron `0 10 * * *`.** That is 03:00 PDT, or 02:00 PST, since cron runs in UTC.
- **Concurrency group `ingest`, `cancel-in-progress: false`.** A queued run waits instead of killing a run that is halfway through a commit.
- **Opted-out-but-published BSSIDs become `::warning::` annotations.** They need a human removal PR (PRD out of scope for automation).

## Implementation Units

### U1. Publish script

**Goal:** Run the ingest, and commit and push its result according to the exit-code contract.
**Requirements:** R5.3, R5.4, R4.9, R4.10.
**Files:** `scripts/publish_ingest.sh` (new), `tests/test_publish_ingest.py` (new).
**Approach:** The script accepts `--dry-run` and runs from the repo root. It appends the summary to `$GITHUB_STEP_SUMMARY` inside a code fence when that variable is set. It writes `pushed_sha` to `$GITHUB_OUTPUT` when it pushes. The committer identity is `github-actions[bot]`.
**Test scenarios** (each builds a temp repo with a copy of the script, `scripts/ingest.py`, the boundary, and a seeded DB, plus a bare `origin`, from `tests/fixtures/wigle`; never the real `ingest/`):
- A log with in-town rows → one commit on the remote whose message is `ingest: +N networks, 1 files processed`. The log is gone and the DB count grew. Exit 0 and `pushed_sha` is written.
- A log whose rows are all dropped (out of town) → a commit that contains only the deletion, `+0 networks`.
- An empty inbox (only `README.md`) → no commit, and the remote head is unchanged. Exit 0.
- A good log plus an unparseable file → the good log is committed, the bad file is still present and untracked-clean. Exit 1.
- `--dry-run` → no commit, and the files are untouched. Exit 0. The summary is still written.
- A missing boundary (fatal) → no commit. Exit 2.
- The remote advanced during the run (a concurrent unrelated commit) → the push succeeds after the rebase retry.
- An unrelated dirty file in the worktree → it is not committed.

### U2. Workflow

**Goal:** Wire the triggers, permissions, tests, the script, and the Pages check.
**Requirements:** R5.1, R5.2, R5.5, issue #5 acceptance.
**Dependencies:** U1.
**Files:** `.github/workflows/ingest.yml` (new).
**Approach:** Use the same SHA-pinned checkout and setup-python actions as `ci.yml`. Run the unit tests, then the script. After a push, run the Pages verify/fallback step using `gh api` with `GITHUB_TOKEN`.
**Test expectation:** none in unit tests (YAML wiring). Verified after merge with a `workflow_dispatch` `dry_run=true` run whose job summary shows the report.

### U3. Docs

**Files:** `README.md`, `ingest/README.md` (text only, no fixtures).
**Approach:** Explain when the job runs, how to start it by hand, and what a red run means. Note that GitHub turns off schedules in public repos after 60 days without activity; re-enable the workflow from the Actions tab.
**Test expectation:** none — documentation.

## Scope Boundaries

- Processing the real first batch → #8.
- Dedupe hardening across concurrent runs → #15. The concurrency group covers this job.

## Risks

- Whether a `GITHUB_TOKEN` push triggers `pages-build-deployment` is unverified until #8's first real commit. The fallback step covers both outcomes and logs which path it took.
- Scheduled workflows auto-disable after 60 idle days. This is documented; re-enabling it is a one-click human step when it happens.
