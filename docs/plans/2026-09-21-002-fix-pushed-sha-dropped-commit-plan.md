---
title: "fix: publish_ingest.sh reports pushed_sha only for a commit this run pushed"
type: fix
status: active
date: 2026-09-21
issue: 45
---

# fix: publish_ingest.sh reports pushed_sha only for a commit this run pushed

**Target repo:** patrickmroskam/redlands_wifi_project · Issue #45 (part of #1)

## Summary

On a rejected push, `scripts/publish_ingest.sh` runs `git pull --rebase` and pushes again.
If an identical database change is already upstream, the rebase drops our commit, the
second push is a no-op (`Everything up-to-date`, exit 0), and `HEAD` is someone else's
commit. The script then prints `pushed <their sha>` and writes `pushed_sha=<their sha>` to
`$GITHUB_OUTPUT`. `.github/workflows/ingest.yml` waits for a Pages build of that SHA, which
can burn five minutes and fail the run if another commit lands first.

Latent: needs a byte-identical `data/networks.json` (including its second-resolution
`updated_at`) pushed by someone else mid-run.

## Decisions

- **Detect the drop directly.** After the rebase, `git rev-list --count FETCH_HEAD..HEAD`
  is `0` exactly when none of our commits survived. Then there is nothing of ours to push:
  skip the removal re-check and the second push, print that the change is already
  upstream, and do **not** write `pushed_sha`. Any other value (including an error, which
  yields an empty string) keeps today's path — the fix can only remove a false report,
  never skip a real push.
- **Content check before trusting the drop (added in review).** Rebase drops a commit
  whose patch matches *any* upstream commit, even one reverted since. So before treating
  the drop as "already published", compare the databases in our pre-rebase commit with
  `HEAD`. If they differ, exit 2 with nothing pushed and no log deleted — loud, never lossy.
- **Log deletion still runs.** The database content is already public (it is identical),
  so the processed logs may be deleted, exactly as after a normal push. Exit code is the
  ingest's own code, unchanged.
- **Production path.** This script runs unattended nightly. The change is confined to the
  push-retry branch; the first-push path and the inbox push are untouched.

## Implementation units

1. `scripts/publish_ingest.sh` — a `pushed` flag; in the retry branch, test for a dropped
   commit before `ingest.py --check` and the second push; print/write `pushed_sha` only
   when `pushed` is set.
2. `tests/test_publish_ingest.py`:
   - a helper that installs a one-shot `pre-push` hook which pushes a commit with the
     *same tree* as ours (different message, so a different SHA) and then rejects our
     push — a deterministic reproduction of the race.
   - the dropped commit: exit 0, no `pushed_sha`, no `pushed ` line, remote head is the
     other commit, the log is gone from the remote.
   - the same with a separate inbox: the log is still deleted from the inbox.
   - a twin that is reverted upstream at once: exit 2, logs kept in the inbox.
   - the existing retry test additionally asserts the remote ref moved.

## Verification

`python3 -m unittest discover -s tests -v && npx playwright test` (the constitution's
`ci_command`).
