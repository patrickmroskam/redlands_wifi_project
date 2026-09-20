#!/usr/bin/env bash
# Run the ingest pipeline and publish its result (PRD R5.3, R5.4, R4.9, R4.10).
#
# Raw logs are read from $INBOX_DIR. In CI that is a checkout of the private inbox repo
# (issue #30 / docs/setup/private-inbox.md); locally it defaults to ingest/ in this repo.
# The script runs scripts/ingest.py over that folder, commits the changed databases here
# as one commit, and pushes. The processed logs are deleted where they came from: inside
# this repo's commit when the inbox is this repo, otherwise in a second commit pushed to
# the private inbox.
#
# Order matters: the database is published BEFORE the logs are deleted. If the run dies
# in between, the logs stay in the inbox and the next run re-reads them — the BSSID
# dedupe makes that a no-op. The other order would lose logs that were never published.
#
# Usage: scripts/publish_ingest.sh [--dry-run]
#
# Exit codes follow scripts/ingest.py:
#   0  ok (committed + pushed, or nothing to do)
#   1  some files could not be parsed or deleted — whatever was processed is still
#      committed and pushed first, then the script fails so the run shows red
#   2  fatal: ingest wrote nothing, or the commit/push failed
#
# Optional environment (set by GitHub Actions):
#   INBOX_DIR            where the raw logs are (default: ingest/)
#
# Both repos are assumed to start with a clean index — true for a CI checkout. A
# deletion staged before the script runs is not counted as processed work.
#   GITHUB_STEP_SUMMARY  the ingest report is appended here
#   GITHUB_OUTPUT        receives pushed_sha=<sha> after a push
set -uo pipefail

DB=data/networks.json
BLE_DB=data/bluetooth.json
FLOCK_DB=data/flock.json
# Every database the pipeline writes. A database missing from this list would be written
# by the ingest and then silently left behind, dirtying the next run's tree.
DBS=("$DB" "$BLE_DB" "$FLOCK_DB")
INBOX=${INBOX_DIR:-ingest}

BOT_NAME="github-actions[bot]"
BOT_EMAIL="41898282+github-actions[bot]@users.noreply.github.com"

dry_run=""
case "${1:-}" in
  "") ;;
  --dry-run) dry_run="--dry-run" ;;
  *) echo "usage: $0 [--dry-run]" >&2; exit 2 ;;
esac

root=$(git rev-parse --show-toplevel) || exit 2
cd "$root" || exit 2

if [ ! -d "$INBOX" ]; then
  echo "::error::inbox directory $INBOX does not exist"
  exit 2
fi
inbox_root=$(git -C "$INBOX" rev-parse --show-toplevel 2>/dev/null) || {
  echo "::error::inbox directory $INBOX is not inside a git repository"
  exit 2
}
# A separate inbox repo gets its own deletion commit; the local ingest/ rides along in
# this repo's commit, the way it always has.
separate_inbox=""
[ "$inbox_root" != "$root" ] && separate_inbox=1

# `rev-parse --show-toplevel` walks UP, so a plain directory nested in this repo reports
# this repo's root and would be mistaken for the legacy ingest/ layout. The giveaway is
# that it is ignored here: a real inbox checkout is its own repo, and ingest/ is tracked.
# Without this the logs are deleted, `git add -u` dies on an unmatched pathspec, and the
# run fails with no annotation saying why.
if [ -z "$separate_inbox" ] && git check-ignore -q "$INBOX" 2>/dev/null; then
  echo "::error::$INBOX is ignored by this repository and is not a git repository of its own — the inbox checkout is missing or misconfigured"
  exit 2
fi

report=$(mktemp)
trap 'rm -f "$report"' EXIT

python3 scripts/ingest.py --ingest-dir "$INBOX" $dry_run >"$report" 2>&1
code=$?
# The report echoes file names from the inbox; never let a line act as a workflow command.
token="ingest-report-$$-$RANDOM"
echo "::stop-commands::$token"
cat "$report"
echo "::$token::"

if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  {
    echo "## Ingest report"
    echo
    echo '~~~~~~~~~~~~'
    cat "$report"
    echo '~~~~~~~~~~~~'
  } >>"$GITHUB_STEP_SUMMARY"
fi

# Networks that were published before their owner opted out need a human removal PR.
if grep -q '^already published but now opted out' "$report"; then
  sed -n '/^already published but now opted out/,/^$/p' "$report" | grep '^  ' |
    while read -r bssid; do
      echo "::warning title=Opted-out network still published::$bssid needs a manual removal PR (see privacy policy)"
    done
fi

if [ "$code" -ne 0 ] && [ "$code" -ne 1 ]; then
  echo "::error::ingest failed (exit $code); nothing was committed"
  exit 2
fi

if [ -n "$dry_run" ]; then
  echo "dry run: nothing committed"
  exit "$code"
fi

# Tracked logs the ingest removed. Read from inside the inbox so this works whether the
# inbox is this repo or a separate checkout. Untracked files (e.g. one that failed to
# parse in a local run) are never counted and never published. The list is kept, NUL
# separated, so the deletion commit stages exactly these files rather than whatever else
# happens to be dirty — and so a newline in a file name cannot inflate the count.
deleted_logs=$(mktemp)
trap 'rm -f "$report" "$deleted_logs"' EXIT
git -C "$INBOX" ls-files -z --deleted -- . >"$deleted_logs"
processed=$(tr -cd '\0' <"$deleted_logs" | wc -c | tr -d ' ')

if [ -z "$(git status --porcelain -- "${DBS[@]}")" ] && [ "$processed" -eq 0 ]; then
  echo "nothing changed: no commit"
  exit "$code"
fi

# The commit subject counts networks; the other databases are reported in the body so
# one line still reads the way it always has.
count_in() {  # count_in <ref-or-file> <json key>
  case "$1" in
    HEAD:*) git show "$1" 2>/dev/null | jq "$2 | length" 2>/dev/null || echo 0 ;;
    *) jq "$2 | length" "$1" 2>/dev/null || echo 0 ;;
  esac
}
before=$(count_in "HEAD:$DB" .networks)
after=$(jq '.networks | length' "$DB") || { echo "::error::cannot read $DB"; exit 2; }
added=$((after - before))
ble_added=$(( $(count_in "$BLE_DB" .devices) - $(count_in "HEAD:$BLE_DB" .devices) ))
flock_added=$(( $(count_in "$FLOCK_DB" .devices) - $(count_in "HEAD:$FLOCK_DB" .devices) ))

# Only the databases — and, when the inbox is this repo, the deletions of tracked logs.
# A database with no records yet may not exist on disk; `git add` on a missing path is
# fatal, and there is nothing to stage for it anyway.
for db in "${DBS[@]}"; do
  [ -e "$db" ] && { git add -- "$db" || exit 2; }
done
if [ -z "$separate_inbox" ]; then
  git add -u -- "$INBOX" || exit 2
fi

# With a separate inbox a run can process logs that add nothing new (all duplicates or
# all out of area). There is nothing to publish then, but the logs must still be deleted.
if [ -n "$(git diff --cached --name-only)" ]; then
  git -c user.name="$BOT_NAME" -c user.email="$BOT_EMAIL" \
      commit --quiet -m "ingest: +$added networks, $processed files processed" \
             -m "+$ble_added bluetooth devices, +$flock_added flock cameras" || exit 2

  branch=$(git branch --show-current)
  if [ -z "$branch" ]; then
    echo "::error::detached HEAD: refusing to push"
    exit 2
  fi

  if ! git push --quiet origin "HEAD:$branch"; then
    # The owner may have pushed meanwhile; those changes touch other paths, so a
    # rebase is clean. One retry only — a second failure needs a human look.
    echo "push rejected; rebasing onto origin/$branch and retrying once"
    git -c user.name="$BOT_NAME" -c user.email="$BOT_EMAIL" \
        pull --quiet --rebase origin "$branch" || {
      git rebase --abort 2>/dev/null
      echo "::error::main changed a published database or a processed log during this run (rebase conflict); nothing was pushed — re-run the workflow"
      exit 2
    }
    # A removal (data/removed.json) may have landed meanwhile without touching the
    # database, so the rebase is clean but this commit could republish a removed
    # network. Re-check on the rebased tree; the next run will drop it properly.
    python3 scripts/ingest.py --check || {
      echo "::error::a network removed on request during this run is in this commit; nothing was pushed — re-run the workflow"
      exit 2
    }
    git push --quiet origin "HEAD:$branch" || { echo "::error::push to $branch failed twice; nothing was pushed"; exit 2; }
  fi

  sha=$(git rev-parse HEAD)
  echo "pushed $sha: +$added networks, $processed files processed"
  if [ -n "${GITHUB_OUTPUT:-}" ]; then
    echo "pushed_sha=$sha" >>"$GITHUB_OUTPUT"
  fi
elif [ "$processed" -gt 0 ]; then
  echo "no database change to publish; only the processed logs are being deleted"
else
  # The gate above saw a change under data/ that staging could not pick up — a deleted
  # or retyped database. Never report that as a quiet success.
  echo "::error::a published database changed in a way this script cannot stage:"
  git status --porcelain -- "${DBS[@]}"
  exit 2
fi

# The database is public now, so the logs can go. A failure from here on is loud but not
# lossy: the logs simply stay in the inbox and the next run re-reads them.
if [ -n "$separate_inbox" ] && [ "$processed" -gt 0 ]; then
  # Only the logs the pipeline consumed — never a blanket `add -u`, which would sweep up
  # any other change in the inbox and push it unreviewed.
  xargs -0 git -C "$INBOX" add -- <"$deleted_logs" ||
    { echo "::error::could not stage the processed logs in the inbox"; exit 2; }
  git -C "$INBOX" -c user.name="$BOT_NAME" -c user.email="$BOT_EMAIL" \
      commit --quiet -m "ingest: $processed files processed" || {
    echo "::error::could not commit the processed logs in the inbox"
    exit 2
  }
  inbox_branch=$(git -C "$INBOX" branch --show-current)
  if [ -z "$inbox_branch" ]; then
    echo "::error::inbox is on a detached HEAD: refusing to push"
    exit 2
  fi
  if ! git -C "$INBOX" push --quiet origin "HEAD:$inbox_branch"; then
    # The owner may have uploaded a new log meanwhile — a different file, so the rebase
    # is clean. One retry only.
    echo "inbox push rejected; rebasing onto origin/$inbox_branch and retrying once"
    git -C "$INBOX" -c user.name="$BOT_NAME" -c user.email="$BOT_EMAIL" \
        pull --quiet --rebase origin "$inbox_branch" || {
      git -C "$INBOX" rebase --abort 2>/dev/null
      echo "::error::the inbox changed a processed log during this run (rebase conflict); the database was published but the logs are still there — re-run the workflow"
      exit 2
    }
    git -C "$INBOX" push --quiet origin "HEAD:$inbox_branch" || {
      echo "::error::push to the inbox failed twice; the database was published but the logs are still there — re-run the workflow"
      exit 2
    }
  fi
  echo "deleted $processed processed log(s) from the inbox"
fi

exit "$code"
