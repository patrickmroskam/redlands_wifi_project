#!/usr/bin/env bash
# Run the ingest pipeline and publish its result (PRD R5.3, R5.4, R4.9, R4.10).
#
# Runs scripts/ingest.py on ingest/, then — if data/networks.json or ingest/ changed —
# commits exactly those paths as one commit and pushes the current branch. Used by
# .github/workflows/ingest.yml; safe to run locally in a scratch clone.
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
#   GITHUB_STEP_SUMMARY  the ingest report is appended here
#   GITHUB_OUTPUT        receives pushed_sha=<sha> after a push
set -uo pipefail

DB=data/networks.json
INBOX=ingest

dry_run=""
case "${1:-}" in
  "") ;;
  --dry-run) dry_run="--dry-run" ;;
  *) echo "usage: $0 [--dry-run]" >&2; exit 2 ;;
esac

root=$(git rev-parse --show-toplevel) || exit 2
cd "$root" || exit 2

report=$(mktemp)
trap 'rm -f "$report"' EXIT

python3 scripts/ingest.py $dry_run >"$report" 2>&1
code=$?
# The report echoes file names from ingest/; never let a line act as a workflow command.
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

if [ -z "$(git status --porcelain -- "$DB" "$INBOX")" ]; then
  echo "nothing changed: no commit"
  exit "$code"
fi

before=$(git show "HEAD:$DB" 2>/dev/null | jq '.networks | length' 2>/dev/null || echo 0)
after=$(jq '.networks | length' "$DB") || { echo "::error::cannot read $DB"; exit 2; }
added=$((after - before))

# Only the database and deletions of tracked logs: an untracked file (e.g. one that
# failed to parse in a local run) is never published by this script.
git add -- "$DB" && git add -u -- "$INBOX" || exit 2
processed=$(git diff --cached --name-only --diff-filter=D -- "$INBOX" | wc -l | tr -d ' ')

git -c user.name="github-actions[bot]" \
    -c user.email="41898282+github-actions[bot]@users.noreply.github.com" \
    commit --quiet -m "ingest: +$added networks, $processed files processed" || exit 2

branch=$(git branch --show-current)
if [ -z "$branch" ]; then
  echo "::error::detached HEAD: refusing to push"
  exit 2
fi

if ! git push --quiet origin "HEAD:$branch"; then
  # The owner may have pushed new logs meanwhile; those touch other paths, so a
  # rebase is clean. One retry only — a second failure needs a human look.
  echo "push rejected; rebasing onto origin/$branch and retrying once"
  git -c user.name="github-actions[bot]" \
      -c user.email="41898282+github-actions[bot]@users.noreply.github.com" \
      pull --quiet --rebase origin "$branch" || {
    git rebase --abort 2>/dev/null
    echo "::error::main changed data/networks.json or a processed log during this run (rebase conflict); nothing was pushed — re-run the workflow"
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
exit "$code"
