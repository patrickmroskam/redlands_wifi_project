<!-- READINESS-QUEUE -->

# Redlands Wifi Project — release readiness

**Updated in place each product-owner run.** Standing decisions live here; each run emits only the delta.

- **Cycle:** 3 · **as of** 2026-09-18T13:40Z · *(cycle 1 = first pass, 01:44Z)*
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

Re-verified at cycle 2 (07:38–07:41Z) and spot-re-checked at cycle 3 (13:39Z — site HTTP 200, CI green on the last three pushes, `actions/variables` still empty so the schedule is still gated off), so the ✅ rows are not inherited on trust: site HTTP 200 with 18,152 records; **R4.12** holds against the *live* published database (every record carries exactly `bssid, ssid, auth, channel, first_seen, lat, lon` — no RSSI, altitude or accuracy); **R2.5** `updated_at`/`count` present and rendered; CI green on the last push; the `Ingest wardrive logs` schedule still logs as *skipped*.

## Standing decision queue (owner)

### 1. Do the private-inbox setup — #30 · unblocks everything

Ten minutes, GitHub login. Steps: [`docs/setup/private-inbox.md`](https://github.com/patrickmroskam/redlands_wifi_project/blob/main/docs/setup/private-inbox.md). Reply on OH HAI with **`DONE private-inbox`**.

The ask (`msg_92a6bc9c`) came back `yes` + "Rewrite history" — read as approval of the plan, not as the setup being done. The gate is object existence, not reply text, and it was re-run again at **cycle 3, 13:39Z**: the repo `redlands_wifi_inbox` still does not exist, there is still no `ingest` environment, the repo still holds 0 secrets, and `actions/variables` is still empty. Until those exist, #30 cannot be worked and R5 cannot be met. The ask has now been answered-but-not-actioned for ~22 h.

### 2. Close the domain-takeover window — #17 (p1) · live exposure

`redlandswifiproject.com` points its apex `A` records at GitHub Pages and `www` at `patrickmroskam.github.io`, but the domain is **not verified** on the GitHub account (no `_github-pages-challenge-patrickmroskam` TXT) and no repo claims it — `GET https://redlandswifiproject.com/` returns a Pages 404. Any GitHub user can claim it and serve their own content on a domain carrying this project's name.

Two ways to close it, both owner-only, both minutes: **verify the domain** (Part 2 of [`docs/setup/custom-domain.md`](https://github.com/patrickmroskam/redlands_wifi_project/blob/main/docs/setup/custom-domain.md) — invisible to visitors, does not switch the site over), or **delete the apex `A` and `www` `CNAME` records** at Namecheap if the domain is no longer wanted.

Note: #17 has been parked on a `DONE custom-domain` reply since 2026-09-17 — but **no OH HAI ask was ever sent for it**, so that reply was never actually requested.

**Re-resolved again at cycle 3 (13:39Z): unchanged and still live** — apex `A` still 185.199.108-111.153, `www` still CNAMEd to `patrickmroskam.github.io`, challenge TXT still absent, apex still 404, and the repo's Pages config still reports `cname: null` / `protected_domain_state: null`.

**Cycle 2 cleared the deadlock rather than re-describing it.** New doc [`docs/setup/domain-takeover.md`](https://github.com/patrickmroskam/redlands_wifi_project/blob/main/docs/setup/domain-takeover.md) — the security-only half, two options, ~5 minutes — and the ask that had never been sent is now open: **`msg_e812f339-e53b-46d4-bb67-ce8e5f6edced`**, resume key **`DONE domain-takeover`**. It was split out of `custom-domain.md` on purpose: that doc routes the verification TXT through Cloudflare, making a 5-minute fix read as "first migrate your DNS". The TXT goes straight into Namecheap's Advanced DNS tab.

The gate is the DNS, not the reply — every cycle re-resolves it. Escalation rung, committed at cycle 2 and executed since: cycle 3 re-resolved the DNS (still exposed), re-checked the ask with `ask await` (still **open**), sent nothing new, and did not re-ask. **Cycle 4 (~2026-09-18T19:38Z ≈ 12:38 PT) sends at priority `high`** if the exposure is still live and the ask still unanswered.

### 3. Spec proposals — PO may not apply these

- **Custom domain scope.** The ratified PRD still lists "Custom domain, CDN, or any hosting other than GitHub Pages" under *Out of Scope (v1)*, while #17 is an active owner request. Move it into scope, or confirm it stays post-v1? (The PO is treating it as post-v1 and therefore **not** a v1 blocker.)
- **History rewrite.** The reply on `msg_92a6bc9c` contained "Rewrite history", which satisfies #30's own gate. It is recorded, not executed: it rewrites every commit on the public `main`, and existing clones, forks and archives keep the old objects. The PRD files the history exposure under *Known consideration (**not a requirement**)*, so this is new scope. Confirm at execution time, in the session that runs it.

### 4. Should the worker keep running while you're deciding? — process, ~1 minute

**New at cycle 3, and it is a correction of my own earlier reporting.** Cycles 1–2 told you the
dev-team routine is off because there was nothing left for it to do. That was wrong. Three issues
are open, unassigned, unblocked, and depend on neither #30 nor #17:

| Issue | | What it is |
|---|---|---|
| **#25** | p3 | Ingest: don't silently delete a log whose rows are all malformed |
| **#29** | p3 | Map: smooth the popup-pan edge cases left by #7 |
| **#34** | p3 | Tests: split the >1,000-line `tests/e2e/site.spec.js` |

The routine is off because the constitution's Human-in-the-loop protocol **step 4 says to turn it
off** — *"Disable the dev-team routine… Do not pick another issue. Exit."* — for as long as any
issue is `waiting` on you. That rule bundles two sensible intents (never work an issue that is
blocked on a human; never burn hourly runs on an empty backlog) into one switch, so a single
owner gate stops everything. The worker has been halted since **2026-09-17T15:05Z (~22.5 h)**.

Nothing is at risk — these are all polish items — so this is a *"do you want throughput while you
decide"* question, not an alarm. Your options:

- **Amend the rule** (the PO's recommendation): step 4 becomes *"skip the blocked issue and
  continue with the next unblocked one; disable the routine only when no unblocked p0–p3 issue
  remains."* Keeps both original intents, drops the coupling.
- **Just re-enable it** and leave the constitution alone — simplest, but it will self-disable
  again the next time an actor hits a human gate.
- **Do nothing** — the p3s wait for `DONE private-inbox`, which resumes the routine anyway.

The PO did **not** re-enable it on its own: a hard invariant in the constitution is not the PO's
to overrule, and turning a scheduled routine back on spends your machine's compute, not the
backlog's. Answering **`DONE private-inbox`** (item 1) makes this question disappear entirely.

### 5. Low priority, owner-only, never asked — #21 (p3)

Dependabot alerts, private vulnerability reporting, SHA-pinning enforcement. No ask has ever been sent, and cycle 2 **deliberately still did not send one**: a third owner ask, at p3, competing with a live p1 security item and a blocking p2 setup would lower the odds of both. Recorded on the issue with its unblock condition — once #30 and #17 clear, #21 gets its own setup doc and ask, or rides along as a postscript. Nothing here is at risk in the meantime.

### 6. Open closure proposal — #22

Verdict `addressed-in-#30` (the option-C decision is made and has moved to #30). Self-closes after **2026-09-20T01:42Z** unless objected. Say so if you want #22 kept open.

## Convergence

- **Net open: 8** (1 tracking · 1 p1 · 2 p2 · 4 p3) — **flat** across cycles 1 → 3. History `[8, 8, 8]`; the K=3 tripwire fires only on three straight *rises*, so it is three clean samples from firing and nothing is trending wrong.
- **Closure accounting (project to date):** closed 14, proposed 1, contested 0 — unchanged at cycle 3.
- **Polish backlog depth:** 0 (`docs/polish-backlog.md` absent).
- No launch-blockers. No in-flight PRs. CI green. 100 unit tests pass.
- **Throughput is owner-gated — but not for lack of agent work.** Every item in the *decision queue* above needs the owner. Separately, three agent-workable p3 issues (#25, #29, #34) are parked because protocol step 4 halts the whole routine while anything is `waiting` — see decision item 4. *(This replaces cycles 1–2's claim that there was no agent work left to schedule; that claim was wrong.)*

## Delta this run

**Cycle 3 delta: nothing moved, again.** No owner reply arrived — the newest hub message is still
cycle 2's own ask `msg_e812f339` (07:46:15Z). The only issues touched since the watermark are #21
and #17, both by cycle 2's own comments. `main` is still `9bb27d8`, 0 open PRs, CI green, site 200.

What cycle 3 did:

1. **Re-ran both gates objectively and re-checked the ask.** #30: repo, `ingest` environment and
   secrets all still absent (and `actions/variables` still empty, so `INGEST_SCHEDULE` is unset
   too). #17: challenge TXT still absent, apex `A` still 185.199.108-111.153, apex still 404,
   `pages.cname` still null. `ask await` on `msg_e812f339` → *not resolved*, still open.
2. **Executed the committed escalation rung instead of re-arguing it** — cycle 2 decided cycle 3
   sends nothing new and cycle 4 goes `high`. Cycle 3 did exactly that: no re-ask, one `low` notify.
3. **Corrected its own earlier reporting** — found that #25, #29 and #34 are workable and parked,
   and that cycles 1–2 had wrongly justified the disabled routine as an empty backlog. Logged as a
   reversal, fixed in the digest and above, and turned into a standing rule: no cycle may claim
   "no workable issue" without citing the `gh issue list` output that proves it.
4. **Raised the step-4 amendment as a proposal, and declined to act on it** — a hard invariant is
   not the PO's to rewrite, and re-enabling a routine spends the owner's compute. It rides in the
   mandatory notify as a recommendation rather than as a competing ask, on the same queue-contention
   reasoning cycle 2 used for #21.

## Routine status

- `autonomy-product-owner-redlands-wifi-project` — **enabled**, 6-hourly.
- `autonomy-dev-team-redlands-wifi-project` — **disabled** since 2026-09-17T15:05Z (dev-team run 15), as the constitution's Human-in-the-loop protocol step 4 requires while any issue is `waiting`. Re-enabled automatically by a PO run that sees `DONE private-inbox`. Confirmed still disabled and still *rule-compliant* at cycle 3 — but **not** because the backlog is empty: #25, #29 and #34 are workable and parked. See decision item 4.
