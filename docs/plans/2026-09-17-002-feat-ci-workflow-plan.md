---
title: "feat: CI workflow (unit tests + Playwright smoke test)"
type: feat
status: active
date: 2026-09-17
origin: docs/spec/PRD.md
issue: 4
---

# feat: CI workflow

## Summary

Add `.github/workflows/ci.yml`. It runs the ingest unit tests and the existing Playwright
suite on every pull request and on every push to `main`. The workflow file is the only
code change. The tests themselves already exist: `tests/test_ingest.py` came from #3, and
`tests/e2e/site.spec.js` came from #2.

## Problem Frame

The repo has no CI, so PRs are gated only by local runs. PRD R8.1 and R8.2 require the
unit tests and a browser smoke test to run in CI. The smoke test already swaps in
`tests/fixtures/*.json` through `page.route`, so CI never needs to modify
`data/networks.json`. That satisfies R8.3 and the issue's "without committing changes".

## Requirements

- R8.1: unit tests run in CI on every pull request.
- R8.2: the Playwright smoke test (map loads, ≥1 marker from a fixture, banner text) runs in CI.
- Issue #4: the workflow uses least privilege (`contents: read`), and total CI time stays under ~5 minutes.
- Constitution: `npx playwright test` stays the e2e command. No secrets are used.

## Key Technical Decisions

- **Two parallel jobs (`unit`, `e2e`).** They fail independently, which makes a red check easy to read. Running them in parallel also keeps wall time low.
- **Python 3.12 in `unit`; Node LTS in `e2e`.** `e2e` still needs `python3`, because `playwright.config.js` starts `python3 -m http.server`. The runner image ships Python 3, so no setup step is needed there.
- **`npm ci` then `npx playwright install --with-deps --only-shell chromium`.** Headless runs only need the headless shell, and skipping the full browser saves time. Playwright stays pinned to 1.63.0 through the lockfile.
- **Third-party actions are pinned to full commit SHAs, with the version in a comment.** The repo is public, and pinning to SHAs protects against a moved tag.
- **Concurrency group per ref with `cancel-in-progress`.** A newer push to a PR replaces the in-flight run.
- **The Playwright report and traces are uploaded only on failure.** They are debug aids; retention is 7 days.
- **Job `timeout-minutes`** bounds a hung run (unit 5, e2e 10).
- **No path filters.** Pushes that only add logs to `ingest/` still run CI. It is cheap, and it keeps "green on main" meaningful.

## Implementation Units

### U1. CI workflow

**Goal:** Add a green CI workflow on PRs and on `main`.
**Requirements:** R8.1, R8.2, issue #4 acceptance.
**Dependencies:** none.
**Files:** `.github/workflows/ci.yml` (new); `README.md` (mention CI + how to run tests locally, if not already covered).
**Approach:** Triggers are `pull_request` and `push` on `main`, plus `workflow_dispatch`. Top-level `permissions: contents: read`. `CI=true` is already set by Actions, so `playwright.config.js` picks up its CI settings (forbidOnly, 1 retry, html reporter).
**Test scenarios:**
- A PR that adds the workflow shows both `unit` and `e2e` checks green.
- Local negative check: a deliberately broken assertion makes `npx playwright test` exit non-zero, which fails the `e2e` job. Verified locally and never committed, per the issue.
- The run completes in under ~5 minutes of wall time.
**Verification:** `gh pr checks` is green on the PR. After merge, the `main` push run is green.

## Scope Boundaries

- No daily ingest job (#5), no Pages changes, no branch-protection changes. Branch protection is an owner setting and is not needed here.

### Deferred to Follow-Up Work

- #5's daily job will push with `GITHUB_TOKEN`, and those pushes do not trigger other workflows. That job should run the unit tests itself before committing.

## Risks

- The e2e suite loads Leaflet from cdnjs, so a CDN outage makes CI flaky. The Playwright retry (1 in CI) absorbs transient blips. Vendoring Leaflet is a separate call.
