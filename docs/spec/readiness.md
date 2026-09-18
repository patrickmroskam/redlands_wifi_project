<!-- READINESS-QUEUE -->

# Redlands Wifi Project — release readiness

**Updated in place each product-owner run.** Standing decisions live here; each run emits only the delta.

- **Cycle:** 1 (first product-owner pass) · **as of** 2026-09-18T01:44Z
- **Spec:** `docs/spec/PRD.md`, status **ratified** 2026-09-17 (`080acfe`)

## Burndown — v1 Definition of Done: 8 of 9

| # | Criterion | State |
|---|---|---|
| R1 | One page, HTML/CSS banner, retro theme, responsive, privacy link | ✅ |
| R2 | Map of every network, fenced to 92373/92374, popups + legend + stats | ✅ |
| R3 | `ingest/` folder with plain-language README | ✅ |
| R4 | Pipeline: fence, WIFI-only, `_nomap`, BSSID dedupe, append, delete, loud failure | ✅ |
| **R5** | **Daily Actions ingest that commits to `main` and redeploys Pages** | ❌ **the only gap** |
| R6 | Privacy policy page modeled on wigle.net | ✅ |
| R7 | No secrets; raw logs never persist outside `ingest/` | ✅ |
| R8 | Unit tests + Playwright smoke green in CI | ✅ |
| — | Initial 2026-09-16 batch ingested and visible live | ✅ (18,152 networks) |

**R5 in one line:** the workflow is built and correct, but its `schedule` trigger is gated on repo variable `INGEST_SCHEDULE`, which has never been set — so every scheduled run is skipped. Setting it is deliberately sequenced *after* the private-inbox cutover (#30) so new logs never pass through the public repo. **v1 is one owner action away from done.**

## Standing decision queue (owner)

### 1. Do the private-inbox setup — #30 · unblocks everything

Ten minutes, GitHub login. Steps: [`docs/setup/private-inbox.md`](https://github.com/patrickmroskam/redlands_wifi_project/blob/main/docs/setup/private-inbox.md). Reply on OH HAI with **`DONE private-inbox`**.

The ask (`msg_92a6bc9c`) came back `yes` + "Rewrite history" — read as approval of the plan, not as the setup being done. Verified 2026-09-18 01:38Z: the repo `redlands_wifi_inbox` does not exist, there is no `ingest` environment, and the repo holds 0 secrets. Until those exist, #30 cannot be worked, R5 cannot be met, and the dev-team routine stays disabled (it has no other workable issue).

### 2. Close the domain-takeover window — #17 (p1) · live exposure

`redlandswifiproject.com` points its apex `A` records at GitHub Pages and `www` at `patrickmroskam.github.io`, but the domain is **not verified** on the GitHub account (no `_github-pages-challenge-patrickmroskam` TXT) and no repo claims it — `GET https://redlandswifiproject.com/` returns a Pages 404. Any GitHub user can claim it and serve their own content on a domain carrying this project's name.

Two ways to close it, both owner-only, both minutes: **verify the domain** (Part 2 of [`docs/setup/custom-domain.md`](https://github.com/patrickmroskam/redlands_wifi_project/blob/main/docs/setup/custom-domain.md) — invisible to visitors, does not switch the site over), or **delete the apex `A` and `www` `CNAME` records** at Namecheap if the domain is no longer wanted.

Note: #17 has been parked on a `DONE custom-domain` reply since 2026-09-17 — but **no OH HAI ask was ever sent for it**, so that reply was never actually requested.

### 3. Spec proposals — PO may not apply these

- **Custom domain scope.** The ratified PRD still lists "Custom domain, CDN, or any hosting other than GitHub Pages" under *Out of Scope (v1)*, while #17 is an active owner request. Move it into scope, or confirm it stays post-v1? (The PO is treating it as post-v1 and therefore **not** a v1 blocker.)
- **History rewrite.** The reply on `msg_92a6bc9c` contained "Rewrite history", which satisfies #30's own gate. It is recorded, not executed: it rewrites every commit on the public `main`, and existing clones, forks and archives keep the old objects. The PRD files the history exposure under *Known consideration (**not a requirement**)*, so this is new scope. Confirm at execution time, in the session that runs it.

### 4. Low priority, owner-only, never asked — #21 (p3)

Dependabot alerts, private vulnerability reporting, SHA-pinning enforcement. No ask has ever been sent.

### 5. Open closure proposal — #22

Verdict `addressed-in-#30` (the option-C decision is made and has moved to #30). Self-closes after **2026-09-20T01:42Z** unless objected. Say so if you want #22 kept open.

## Convergence

- **Net open: 8** (1 tracking · 1 p1 · 2 p2 · 4 p3). First sample — the K=3 net-open tripwire needs 4 cycles before it can fire.
- **Closure accounting (project to date):** closed 14, proposed 1, contested 0.
- **Polish backlog depth:** 0 (`docs/polish-backlog.md` absent).
- No launch-blockers. No in-flight PRs. CI green on the last 5 runs. 100 unit tests pass.

## Delta this run

Cycle 1 is the baseline — every item above entered the queue this run. Nothing has left it.

## Routine status

- `autonomy-product-owner-redlands-wifi-project` — **enabled**, 6-hourly.
- `autonomy-dev-team-redlands-wifi-project` — **disabled**, deliberately, since dev-team run 15 (#30 is human-in-the-loop and is the only workable issue left). Re-enabled automatically by a PO run that sees `DONE private-inbox`.
