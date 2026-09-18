<!-- READINESS-QUEUE -->

# Redlands Wifi Project — release readiness

**Updated in place each product-owner run.** Standing decisions live here; each run emits only the delta.

- **Cycle:** 2 · **as of** 2026-09-18T07:45Z · *(cycle 1 = first pass, 01:44Z)*
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

Re-verified at cycle 2 (07:38–07:41Z), so the ✅ rows are not inherited on trust: site HTTP 200 with 18,152 records; **R4.12** holds against the *live* published database (every record carries exactly `bssid, ssid, auth, channel, first_seen, lat, lon` — no RSSI, altitude or accuracy); **R2.5** `updated_at`/`count` present and rendered; CI green on the last push; the `Ingest wardrive logs` schedule still logs as *skipped*.

## Standing decision queue (owner)

### 1. Do the private-inbox setup — #30 · unblocks everything

Ten minutes, GitHub login. Steps: [`docs/setup/private-inbox.md`](https://github.com/patrickmroskam/redlands_wifi_project/blob/main/docs/setup/private-inbox.md). Reply on OH HAI with **`DONE private-inbox`**.

The ask (`msg_92a6bc9c`) came back `yes` + "Rewrite history" — read as approval of the plan, not as the setup being done. The gate is object existence, not reply text, and it was re-run at **cycle 2, 07:39Z**: the repo `redlands_wifi_inbox` still does not exist, there is still no `ingest` environment, and the repo still holds 0 secrets. Until those exist, #30 cannot be worked, R5 cannot be met, and the dev-team routine stays disabled (it has no other workable issue).

### 2. Close the domain-takeover window — #17 (p1) · live exposure

`redlandswifiproject.com` points its apex `A` records at GitHub Pages and `www` at `patrickmroskam.github.io`, but the domain is **not verified** on the GitHub account (no `_github-pages-challenge-patrickmroskam` TXT) and no repo claims it — `GET https://redlandswifiproject.com/` returns a Pages 404. Any GitHub user can claim it and serve their own content on a domain carrying this project's name.

Two ways to close it, both owner-only, both minutes: **verify the domain** (Part 2 of [`docs/setup/custom-domain.md`](https://github.com/patrickmroskam/redlands_wifi_project/blob/main/docs/setup/custom-domain.md) — invisible to visitors, does not switch the site over), or **delete the apex `A` and `www` `CNAME` records** at Namecheap if the domain is no longer wanted.

Note: #17 has been parked on a `DONE custom-domain` reply since 2026-09-17 — but **no OH HAI ask was ever sent for it**, so that reply was never actually requested.

**Re-resolved at cycle 2 (07:38Z): unchanged and still live** — apex `A` still 185.199.108-111.153, `www` still CNAMEd to `patrickmroskam.github.io`, challenge TXT still absent, apex still 404, and the repo's Pages config still reports `cname: null` / `protected_domain_state: null`. Cycle 2 holds the message at the same priority because it lands at 00:45 PT; **cycle 3 (~06:38 PT) escalates this to `high` if it is still open**, and that is committed, not re-decided each pass.

### 3. Spec proposals — PO may not apply these

- **Custom domain scope.** The ratified PRD still lists "Custom domain, CDN, or any hosting other than GitHub Pages" under *Out of Scope (v1)*, while #17 is an active owner request. Move it into scope, or confirm it stays post-v1? (The PO is treating it as post-v1 and therefore **not** a v1 blocker.)
- **History rewrite.** The reply on `msg_92a6bc9c` contained "Rewrite history", which satisfies #30's own gate. It is recorded, not executed: it rewrites every commit on the public `main`, and existing clones, forks and archives keep the old objects. The PRD files the history exposure under *Known consideration (**not a requirement**)*, so this is new scope. Confirm at execution time, in the session that runs it.

### 4. Low priority, owner-only, never asked — #21 (p3)

Dependabot alerts, private vulnerability reporting, SHA-pinning enforcement. No ask has ever been sent, and cycle 2 **deliberately still did not send one**: a third owner ask, at p3, competing with a live p1 security item and a blocking p2 setup would lower the odds of both. Recorded on the issue with its unblock condition — once #30 and #17 clear, #21 gets its own setup doc and ask, or rides along as a postscript. Nothing here is at risk in the meantime.

### 5. Open closure proposal — #22

Verdict `addressed-in-#30` (the option-C decision is made and has moved to #30). Self-closes after **2026-09-20T01:42Z** unless objected. Say so if you want #22 kept open.

## Convergence

- **Net open: 8** (1 tracking · 1 p1 · 2 p2 · 4 p3) — **flat** cycle 1 → 2. History `[8, 8]`; the K=3 tripwire fires only on three straight *rises*, so it is two clean samples from firing and nothing is trending wrong.
- **Closure accounting (project to date):** closed 14, proposed 1, contested 0 — unchanged.
- **Polish backlog depth:** 0 (`docs/polish-backlog.md` absent).
- No launch-blockers. No in-flight PRs. CI green. 100 unit tests pass.
- **Throughput is owner-gated, not agent-gated.** Every remaining item in the queue is an action only the owner can take; there is no agent work left to schedule, which is why the dev-team routine is off rather than idling.

## Delta this run

**Cycle 2 delta: nothing moved.** No owner reply arrived (the newest hub message is still cycle 1's own notify `msg_8f830af8`, 01:46:45Z), no issue or PR changed, no commit landed but cycle 1's. The queue above is identical to cycle 1's.

What cycle 2 actually did, rather than restating cycle 1:

1. **Re-ran both gates objectively** instead of inheriting them — #30's three existence checks (all still negative) and #17's five DNS/HTTP checks (exposure still live). Both are recorded in the decision log.
2. **Spot-checked the privacy guarantee against what is actually served** — R4.12 holds on the live 18,152-record database, and R2.5 renders. These are the promises the public privacy page makes; they are now verified against the published artifact, not just the script that writes it.
3. **Closed out the #21 process debt** with a deferral recorded on the issue, so no later cycle re-discovers it as a mystery.
4. **Committed the #17 escalation trigger to cycle 3** (~06:38 PT → priority `high`), so the rung is decided once rather than re-argued every six hours.
5. **Checked, and declined, a constitution amendment** — the invariant barring raw logs outside `ingest/` contradicts option C, but #30's body already scopes that edit and the owner's `yes` on `msg_92a6bc9c` already ratifies it. Editing it six hours ahead of the flow it describes would split #30's acceptance across two actors. Logged as a check for whoever works #30.

## Routine status

- `autonomy-product-owner-redlands-wifi-project` — **enabled**, 6-hourly.
- `autonomy-dev-team-redlands-wifi-project` — **disabled**, deliberately, since dev-team run 15 (#30 is human-in-the-loop and is the only workable issue left). Re-enabled automatically by a PO run that sees `DONE private-inbox`. Confirmed still disabled and still correct at cycle 2: there is no workable p0–p3 issue a dev-team run could pick up.
