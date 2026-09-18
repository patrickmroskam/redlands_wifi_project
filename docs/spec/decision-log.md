# Redlands Wifi Project — PO decision log (append-only)

## 2026-09-18T01:44:00Z — session product-owner cycle 1 (bootstrap)

- decision: `bootstrapped continuity artifacts` — created `state-digest.md` (full rebuild, digest absent), `decision-log.md`, `po-tasks.md`, `objections.md`. Labels already complete; `readiness-artifact` re-ensured.
- confidence: high
- alternatives: seeding the digest from the template — rejected, a placeholder `last_reconciled_at` would make cycle 2 attempt a bogus delta instead of the forced full rebuild.
- watch-next: cycle 2 is a delta from `2026-09-18T01:43:42Z`; full rebuild is due at cycle 10.

## 2026-09-18T01:44:00Z — session product-owner cycle 1

- decision: `resume-check #30: NOT resumed` — OH HAI ask `msg_92a6bc9c` is answered `yes` with comment "Rewrite history", but that is not the resume key `DONE private-inbox`. Verified against GitHub instead of reading intent into the reply: `redlands_wifi_inbox` does not exist, there is no `ingest` environment (only `github-pages`), and `actions/secrets` returns `total_count: 0`. `waiting` kept; dev-team routine **left disabled**; findings commented on #30.
- confidence: high
- alternatives: (a) treating `yes` as DONE and re-enabling dev-team — rejected, the three artefacts the work depends on demonstrably do not exist, so the next run would fail at checkout; (b) re-sending the ask — rejected, the ask is answered, not open, and the protocol forbids re-sending.
- watch-next: re-run the same three existence checks every cycle; they are the objective resume gate, not the reply text.

## 2026-09-18T01:44:00Z — session product-owner cycle 1

- decision: `recorded owner decision (not acted on): history rewrite authorised` — #30's own gate says the purge proceeds "only if the reply contains `rewrite history`"; the reply does. Recorded on #30 with the caveats (forks/clones retain objects; `data/networks.json` unaffected; pre-rewrite bundle already backed up) and an explicit bar on any agent running it unattended.
- confidence: medium
- alternatives: acting on it this run — rejected, destructive and irreversible on a public repo, and outside a PO pass's remit; dropping it — rejected, it would silently lose a decision the owner made.
- watch-next: when `DONE private-inbox` arrives, the executing session must re-confirm the purge with the owner *in that session* before running it.

## 2026-09-18T01:44:00Z — session product-owner cycle 1

- decision: `reprioritized #17 p2→p1` + comment — re-verified the domain-takeover exposure live (Namecheap NS, apex A → Pages, `www` → `patrickmroskam.github.io`, no `_github-pages-challenge` TXT, apex 404 from Pages = unclaimed). Also named the silent deadlock: `waiting` on `DONE custom-domain`, an ask that was never sent.
- confidence: high
- alternatives: leaving p2 — rejected, an unclaimed Pages-pointed domain bearing the project name is a live exploit window; splitting the mitigation into its own issue — deferred, §4e budget is 0 closes this run so net-issue-delta must stay ≤ 0 (queued as a PO task).
- watch-next: if the TXT record appears, drop #17 back to p3 and reopen the split question; if the owner says the domain is unwanted, the mitigation is deleting the records, not verifying.

## 2026-09-18T01:44:00Z — session product-owner cycle 1

- decision: `proposed-close #22 (addressed-in-#30)` + removed `needs-triage`, added `po-closure-proposed` — the issue asked one question, the owner answered "Go with option C" on 2026-09-17 05:22Z, and the implementation is #30. The 09:09Z comment explicitly left `needs-triage` for the PO to clear.
- confidence: high
- alternatives: direct-closing this run — rejected, the handshake forbids same-run close even for an auto-close-eligible verdict; keeping it open as the option-C home — rejected, #30 is that home.
- watch-next: aging sweep after 2026-09-20T01:42Z (48 h window) — self-close if dev-team has not objected and #30 is still the live carrier.

## 2026-09-18T01:44:00Z — session product-owner cycle 1

- decision: `gap: PRD R5 has no owner → folded into #30's acceptance` — R5 is the only unmet Release Criterion. The workflow gates scheduled runs on `vars.INGEST_SCHEDULE`, which does not exist; the code comment attributes the flip to #8, which closed without doing it. Added three acceptance items to #30 (set the variable, verify one scheduled run publishes, fix the stale `#8` citation).
- confidence: high
- alternatives: filing a standalone issue — rejected, §4e budget is 0 realized closes this run so net-issue-delta must stay ≤ 0; leaving it in the workflow comment — rejected, that is how it was orphaned.
- watch-next: after `DONE private-inbox`, confirm #30 actually carries the variable flip rather than closing on the token work alone — R5 is not met until a *scheduled* run publishes.

## 2026-09-18T01:44:00Z — session product-owner cycle 1

- decision: `spec bookkeeping (§4g)` — flipped R1, R2, R3, R4, R6, R7, R8 and the initial-backfill line to `[x]` in the PRD Release Criteria, each against verified live/repo state; left R5 `[ ]` and annotated it with the verified reason. Corrected #1's stale "status: draft" line.
- confidence: high
- alternatives: also checking R5 on the grounds the workflow exists — rejected, R5 says the ingest *runs daily*, and it demonstrably does not; leaving R7 unchecked over the raw logs in git history — rejected, R7.1/R7.2 are both met in the tree and the PRD files history retention under "Known consideration (**not a requirement**)". The owner's "Rewrite history" request is therefore new scope, routed as a proposal rather than a silent DoD failure.
- watch-next: flip R5 to `[x]` only after a scheduled (not `workflow_dispatch`) run publishes.

## 2026-09-18T01:44:00Z — session product-owner cycle 1

- decision: `spec-change proposals routed to owner (not applied)` — (1) the ratified PRD still lists "Custom domain, CDN, or any hosting other than GitHub Pages" under Out of Scope while #17 is an active owner request; (2) the owner's "Rewrite history" is outside the ratified spec's accepted "Known consideration".
- confidence: high
- alternatives: editing the Out-of-Scope list directly — rejected, §4g's carve-out is checkbox flips and stale citations only; changing the *set* of scope items is the owner's.
- watch-next: if the owner rules on either, apply it as a spec edit in that cycle and log the sign-off.

## 2026-09-18T07:45:00Z — session product-owner cycle 2

- decision: `resume-check #30: still NOT resumed (objective gate, re-run)` — all three existence checks re-run at 07:39Z, all three still negative: `gh repo view patrickmroskam/redlands_wifi_inbox` → *Could not resolve to a Repository*; `repos/…/environments` → only `github-pages`; `actions/secrets` → `total_count: 0`. The hub holds **no message newer than my own cycle-1 notify** `msg_8f830af8` (01:46:45Z) — no owner reply of any kind arrived in the last six hours. `waiting` kept on #30; dev-team routine **left disabled**.
- confidence: high
- alternatives: commenting the same negative result on #30 again — rejected, cycle 1's comment already states the gate and the result is unchanged; a 6-hourly repetition would be pure churn. The PO task records the gate in this log, which is where it belongs.
- watch-next: unchanged — the three checks are the gate, every cycle.

## 2026-09-18T07:45:00Z — session product-owner cycle 2

- decision: `#17 exposure re-verified STILL LIVE` — independently re-resolved at 07:38Z: apex `A` → 185.199.108/109/110/111.153, `www` CNAME → `patrickmroskam.github.io`, `_github-pages-challenge-patrickmroskam.redlandswifiproject.com` TXT → **none**, `GET https://redlandswifiproject.com/` → **404** with the GitHub "Site not found" body, and `repos/…/pages` → `cname: null`, `protected_domain_state: null`. Nothing has changed since cycle 1. Priority stays **p1**.
- confidence: high
- alternatives: dropping back to p2 on the grounds that nothing has happened in 78 days — rejected; an unclaimed Pages-pointed apex is a standing exploit window, and elapsed quiet time is not mitigation.
- watch-next: a `_github-pages-challenge-patrickmroskam` TXT appearing, or the apex `A` records leaving the Pages range, closes this and drops #17 to p3.

## 2026-09-18T07:45:00Z — session product-owner cycle 2

- decision: `sent the #17 ask that was never sent — and superseded this cycle's notify with it` — the run's single owner message is an **ask**, `msg_e812f339-e53b-46d4-bb67-ce8e5f6edced` (open), not a notify. Reasoning: cycle 1 *diagnosed* that #17 sat `waiting` on a `DONE custom-domain` reply nobody had requested, but naming a deadlock does not clear it. The protocol's remedy is doc + `waiting` + ask, so cycle 2 wrote `docs/setup/domain-takeover.md` (`f7368e0`, the security-only half, two options, ~5 min, resume key `DONE domain-takeover`) and sent the ask carrying the full step list. An ask waits in the inbox rather than alerting, so sending it at 00:50 PT costs the owner nothing, and it is the mechanism that actually unblocks a `waiting` issue.
- confidence: high
- alternatives: (a) a second notify restating cycle 1's message six hours later, overnight — rejected as noise against a message the owner has not had a waking hour to read, and it would have left the ask still unsent for another six hours; (b) escalating a notify to `high` now — rejected, an overnight alert buys no response time and spends the rung on something unactionable at that hour; (c) pointing the ask at the existing `custom-domain.md` — rejected, its step 20 routes the verification TXT through Cloudflare, so the 5-minute fix reads as "first create a Cloudflare account and migrate your DNS", which is the likeliest way to get a security item deferred again. The TXT goes straight into Namecheap's Advanced DNS tab.
- watch-next: **do not re-ask while `msg_e812f339` is open.** The gate stays objective — a `_github-pages-challenge-patrickmroskam` TXT resolving (Option A) or the apex `A` records leaving the GitHub range (Option B). Escalation rung, committed so it is not re-argued: if the exposure is still live and the ask still unanswered at **cycle 4 (~2026-09-18T19:38Z ≈ 12:38 PT)** — i.e. the owner has had a full waking day with the ask in front of them — that cycle sends its notify at priority `high`. Cycle 3 (~06:38 PT) sends nothing new; the ask is already in the inbox.

## 2026-09-18T07:52:00Z — session product-owner cycle 2

- decision: `self-reported error: a CLI syntax probe sent a real ask` — while working out `ask submit`'s flags (the help text names a "REQUIRED idempotency key" that has no corresponding flag), a probe invocation with placeholder options went through to the owner's inbox as `msg_65c5813b-6a14-4b10-bfc1-a3f0fb962d47`, titled "probe". The hub CLI exposes no cancel or withdraw verb (`ask` accepts only `submit | await`), so it cannot be retracted from this side.
- confidence: high
- alternatives: silently leaving it — rejected; an unexplained junk prompt in the inbox erodes trust in the channel that the whole human-in-the-loop protocol depends on. The real ask therefore opens by naming it and asking the owner to dismiss it.
- watch-next: **never probe `oh-hai ask submit` / `notify` / `task submit` flags by invoking them.** A well-formed-but-incomplete invocation *sends*; only an unknown flag or subcommand errors first. Determine syntax from `--help` alone, and if a flag cannot be confirmed, compose the whole command and send once. This is the second probe-sent message on this account (see the ask titled "x", 2026-09-17 01:10Z).

## 2026-09-18T07:45:00Z — session product-owner cycle 2

- decision: `#21 deferred behind the p1/p2 owner queue, and said so on the issue` — #21 (p3, Dependabot alerts / private vulnerability reporting / SHA-pinning enforcement) is owner-only and has never reached the owner through the durable channel. It gets a comment recording that, rather than a `docs/setup/` doc + ask of its own: two owner actions (#17 mitigation, #30 setup) are already queued, and a third p3 ask competing with a p1 security item would lower the odds of both.
- confidence: high
- alternatives: sending an ask now — rejected on queue contention; silently leaving it — rejected, that is exactly how #17 fell into a deadlock on a reply nobody asked for.
- watch-next: once #30 and #17 clear, write `docs/setup/github-security-settings.md` and send #21's ask, or fold its three toggles into the next owner message as a postscript.

## 2026-09-18T07:45:00Z — session product-owner cycle 2

- decision: `privacy invariants spot-checked against the LIVE published database` — PRD **R4.12** (never publish raw log contents, RSSI, altitude or accuracy): the live `data/networks.json` holds exactly `bssid, ssid, auth, channel, first_seen, lat, lon` across all 18,152 records — **no forbidden field present**. **R2.5** (count + last-updated): `updated_at` and `count` are top-level in the database and rendered by `assets/map.js:278`. Site returns HTTP 200 with 18,152 records.
- confidence: high
- alternatives: trusting cycle 1's roll-up — rejected; R4.12 is a privacy guarantee made on the public privacy page, and it is cheap to verify against what is actually served rather than against the script that writes it.
- watch-next: re-check R4.12 against the served database on the first cycle after a scheduled ingest publishes, since that is the first write nobody reviewed in a PR.

## 2026-09-18T07:45:00Z — session product-owner cycle 2

- decision: `no constitution amendment this cycle (deliberate)` — the hard invariant "Never push the raw wardrive logs anywhere except `ingest/` in this repo" contradicts option C, and a future dev-team run could read it as a bar on #30's work. Checked before acting: **#30's body already scopes that amendment as part of its own work**, and the ratifying ask (`msg_92a6bc9c`, whose text states the reply "ratifies the rule change") came back `yes`. So the authority exists and the edit has an owner — it belongs in the same change that moves the flow, not six hours ahead of it.
- confidence: high
- alternatives: amending it now to pre-clear the path — rejected, an invariant that describes a flow the repo does not yet have is worse than a stale one, and it would split #30's acceptance across two commits by two actors.
- watch-next: if a dev-team run ever stops on this invariant instead of amending it, that is a real deadlock — raise it then.

## 2026-09-18T13:40:00Z — session product-owner cycle 3

- decision: `resume-check both gates: still NOT resumed (objective, re-run)` — #30's three existence checks re-run at 13:39Z, all three still negative: `gh repo view patrickmroskam/redlands_wifi_inbox` → *Could not resolve to a Repository*; `repos/…/environments` → only `github-pages`; `actions/secrets` → `total_count: 0` (and `actions/variables` → 0, so `INGEST_SCHEDULE` is still unset). #17's gate re-resolved at 13:39Z: `_github-pages-challenge-patrickmroskam` TXT → **none**; apex `A` → 185.199.108/109/110/111.153; `www` CNAME → `patrickmroskam.github.io`; `GET https://redlandswifiproject.com/` → **404**; `repos/…/pages` → `cname: null`, `protected_domain_state: null`. Ask `msg_e812f339` re-checked with `ask await` → *not resolved*, still **open**. `waiting` kept on both; dev-team routine left disabled.
- confidence: high
- alternatives: reading the #30 reply's `yes` as consent-to-resume — rejected for the third cycle running; the gate is object existence, and nothing exists. Re-asking #17 — forbidden while `msg_e812f339` is open.
- watch-next: unchanged. Both gates are objects, not reply text, and both are re-run every cycle.

## 2026-09-18T13:40:00Z — session product-owner cycle 3

- decision: `correcting my own record — the dev-team routine is NOT off for lack of work` — cycles 1 and 2 both wrote that the routine is disabled because "there is no workable p0–p3 issue a dev-team run could pick up" (readiness §Routine status, and the cycle-2 convergence note "there is no agent work left to schedule"). Checked against GitHub this cycle: **#25, #29 and #34 are all open, unassigned, labelled `p3` only** — no `waiting`, no `blocked`, no assignee, and none of the three depends on #30 or #17 (#25 is `scripts/ingest.py` error handling, #29 is `assets/map.js` popup panning, #34 splits `tests/e2e/site.spec.js`). The routine is off because the constitution's Human-in-the-loop protocol step 4 mandates it — *"Disable the dev-team routine… Do not pick another issue. Exit."* — while any `waiting` issue is live. The rule was obeyed correctly; the justification recorded alongside it was false, and a false justification is how a parked backlog becomes invisible.
- confidence: high — verified by direct `gh issue list --json assignees,labels`, not inferred.
- alternatives: leaving the wording alone as harmless shorthand — rejected; it is the sentence that would stop a future cycle (or the owner) from noticing that three shippable issues are parked. Quietly fixing the docs without logging it — rejected; the point of this log is that a reversal is traceable.
- watch-next: any cycle that reports "no workable issue" must cite the `gh issue list` output that shows it, not the routine's disabled state.

## 2026-09-18T13:40:00Z — session product-owner cycle 3

- decision: `PROPOSAL to the owner (not applied): narrow protocol step 4 from "halt the worker" to "skip the blocked issue"` — the protocol's blast radius is the whole routine. Today that means two owner gates with no ETA (#30 answered-but-not-actioned ~22 h, #17 open ~6 h) have held the worker at a standstill since 2026-09-17T15:05Z while #25, #29 and #34 sit shippable. Proposed amendment to `docs/spec/constitution.md` step 4: *"Skip the blocked issue and continue with the next unblocked one. Disable the dev-team routine only when no unblocked p0–p3 issue remains."* That preserves both original intents — never work a human-blocked issue, and never burn hourly runs on an empty backlog — without coupling them. Two lower-cost variants for the owner: (a) leave the constitution alone and simply re-enable the routine now, accepting it will self-disable again the next time an actor hits a human gate; (b) do nothing, and let the p3s wait for `DONE private-inbox`, which is the status quo.
- confidence: medium-high on the diagnosis, deliberately no action — a hard invariant in the constitution is not the PO's to rewrite, and re-enabling a scheduled routine is a change to the owner's machine and compute, not a backlog edit. Cycle 2 set exactly this precedent when it declined to pre-amend the raw-log invariant.
- alternatives: flipping `autonomy-dev-team-redlands-wifi-project` to `enabled: true` myself — rejected, it contradicts a hard rule in force and my own task file scopes that re-enable to a `DONE <slug>` reply; sending this as its own OH HAI **ask** — rejected on queue contention, the same reasoning cycle 2 used to defer #21: a third owner prompt competing with a live p1 security ask lowers the odds of both. It rides in this cycle's mandatory notify as a one-line recommendation instead.
- watch-next: if the owner says yes to the amendment, apply it as a constitution edit in that cycle, log the sign-off, and re-enable the routine. If the owner instead answers `DONE private-inbox`, this proposal becomes moot — the routine resumes on its own and the p3s get worked in turn.

## 2026-09-18T13:40:00Z — session product-owner cycle 3

- decision: `escalation rung HELD at cycle 3, exactly as committed` — cycle 2 committed the rung ("cycle 3 sends nothing new; cycle 4 goes `high` if still exposed"), and cycle 3 executes it rather than re-arguing it. This run's single owner message is one `low` notify: the #17 exposure is unchanged and the ask is already in the inbox, so a second alert six hours later buys no response time. The notify is not empty, though — it carries the parked-backlog finding above, which is new this cycle and costs nothing to read.
- confidence: high
- alternatives: escalating early because the exposure is a p1 — rejected; the rung's whole purpose is that it was decided once, at cycle 2, with the reasoning written down. Sending no notify at all — rejected; the routine requires exactly one per run, and "nothing new" meant no new *alert*, not silence.
- watch-next: **cycle 4 (~2026-09-18T19:38Z ≈ 12:38 PT) sends at priority `high`** if the challenge TXT is still absent and the apex `A` records still point into the GitHub range. Keep that message about the takeover window alone — do not dilute it with the routine/backlog question.

## 2026-09-18T19:45:00Z — session product-owner cycle 4

- decision: `the committed cycle-4 escalation rung RETIRES unfired` — cycle 2 committed: "if the exposure is still live **and the ask still unanswered** at cycle 4 (~19:38Z), that cycle sends its notify at priority `high`." The exposure is still live, but `msg_e812f339` came back **answered: `not-yet`**. The rung's condition is conjunctive and is not met, so it does not fire. This is *executing* the committed rule, not re-arguing it: the rung was written to break a silence, and the silence broke on its own.
- confidence: high
- alternatives: firing `high` anyway on the grounds that the exposure is what matters — rejected, and this is the substantive call of the cycle. The owner answered against `docs/setup/domain-takeover.md`, which states in its own words that they already own the domain, that the fix is a single TXT record, that it takes ~5 minutes, and that visitors see nothing change. There is no misframing left to correct. A `high` alert restating a question the owner has just declined *with the facts in hand* is nagging, and it spends the one rung that still has credibility on the item where it would do the least good. The rung is instead re-aimed at #30 (below), which is a genuinely unsaid thing.
- watch-next: **do not re-ask #17 and do not escalate it on a timer.** Its escalation is now event-driven only — see the tripwire.

## 2026-09-18T19:45:00Z — session product-owner cycle 4

- decision: `#17 relabelled to an owner-accepted risk: waiting removed, blocked added, p1 → p2` — `waiting` means "waiting on the human" and the human has now spoken, so it is simply false and comes off. `blocked` replaces it because the work is registrar/account-side and no dev-team run can ever do it at any priority. p1 → p2 because priority in this backlog encodes **dev-team build order**; leaving the sole p1 on an item nobody in the loop is permitted to build misrepresents the buildable queue. The exposure is not downgraded — it is recorded here, on the issue, and in the digest.
- confidence: medium — the label mechanics are clear; the p1 → p2 move is a judgement call that trades an accurate queue signal against the optics of lowering a live security item's number.
- alternatives: holding p1 to keep the risk visible — rejected, visibility is the decision log's and the issue's job, not a sort key's; closing #17 outright as "owner declined" — rejected, `not-yet` is a deferral, not a cancellation, and the doc's own follow-up text ("after **A**, #17 becomes the ordinary switch-over task") assumes it survives.
- watch-next: the tripwire below, and re-raise #17 **once** at cycle 9 (~2026-09-20T01:38Z) if still unmitigated — a single dated reminder against a deferral, not a recurring one.

## 2026-09-18T19:45:00Z — session product-owner cycle 4

- decision: `armed an objective takeover tripwire on #17` — every cycle now resolves the apex and reads its HTTP status. **404 = the name is still unclaimed** (the exposure is latent, no action). **200, or any body that is not GitHub's "Site not found" page, = someone has claimed the name on their own Pages repo** — that is the exposure *materialising*, not a risk forecast, and it fires an immediate `high` regardless of any deferral or rung state. A `_github-pages-challenge-patrickmroskam` TXT appearing, or the apex `A` records leaving 185.199.108-111.153, closes #17 instead.
- confidence: high
- alternatives: a time-based re-raise every cycle — rejected, that is the nagging the `not-yet` reply should have bought the owner out of. An accepted risk deserves a detector, not a reminder.
- watch-next: `curl -s -o /dev/null -w '%{http_code}' https://redlandswifiproject.com/` each cycle; 19:39Z reading was **404**.

## 2026-09-18T19:45:00Z — session product-owner cycle 4

- decision: `#30's real blocker identified — the ask was a question, the doc needs a DONE, and nobody bridged the two` — the four-object gate is still negative at 19:40Z (no `redlands_wifi_inbox` under either spelling, no `ingest` environment, 0 secrets, 0 variables), so `waiting` stays and the dev-team routine stays **disabled**. But the *reason* is no longer "the owner has not got to it": `msg_92a6bc9c` was phrased as a question, and the owner gave a complete, responsive answer to that question — `yes`, plus the doc's own opt-in phrase "Rewrite history". From their side the ball is in ours. `docs/setup/private-inbox.md` meanwhile asks for ~10 minutes across three parts and resumes only on `DONE private-inbox`. This is structurally the same deadlock cycle 1 found on #17, and **it has never been said to the owner**. It is therefore this cycle's single notify, sent at `high` on its own merits: #30 gates R5 (the only unmet release criterion) *and* the entire dev-team routine, and the owner has never been told that work is outstanding.
- confidence: high
- alternatives: re-asking #30 — rejected, the ask is answered and re-asking an answered ask is the anti-pattern this log has twice recorded; a `normal` notify — rejected, this is the sole blocker for every other thing in the project and the owner is awake (12:45 PT); staying silent another cycle — rejected, that is what has already cost ~22 h.
- watch-next: the four existence checks, every cycle, unchanged. If `DONE private-inbox` arrives, remove `waiting`, re-enable `autonomy-dev-team-redlands-wifi-project`, and verify the constitution invariant is amended in the same change that moves the flow.

## 2026-09-18T19:45:00Z — session product-owner cycle 4

- decision: `the owner opted into the history rewrite — recorded on the issues, NOT filed as a new issue` — cycle 1 routed "Rewrite history" to the owner as a proposal, on the grounds that the ratified PRD files git-history retention under a "Known consideration (**not a requirement**)". The owner has now taken it: reply comment **"Rewrite history"**, which is exactly the opt-in phrase `private-inbox.md` specifies. The authority therefore exists. It is recorded as a comment on #30 (whose doc carries the opt-in) and on #22 (where history retention was argued) rather than as a new issue, because §4e's net-issue-delta budget needs ≥ 1 realized close and this cycle realized none.
- confidence: high
- alternatives: filing it now — rejected on the §4e budget; treating `yes` as covering it silently — rejected, a destructive, irreversible rewrite of a public repo's history is not something to infer from a checkbox, and it must be visible on the issues before anyone acts on it.
- watch-next: file it as its own issue at the first cycle with budget (earliest cycle 5, after the #22 sweep). It must not be bundled into #30's cutover: the rewrite is destructive and irreversible, anyone who already cloned keeps their copy, and it deserves its own review rather than riding along inside a migration.

## 2026-09-18T19:45:00Z — session product-owner cycle 4

- decision: `R5 stays unchecked — a firing cron is not a working ingest` — two scheduled `Ingest wardrive logs` runs now exist (2026-09-17T14:44Z, 2026-09-18T14:10Z) where cycle 2 had none, and both read `completed/skipped`. Inspected rather than assumed: the `ingest` **job** is skipped by `if: github.event_name != 'schedule' || vars.INGEST_SCHEDULE == 'on'`, and `gh variable list` is empty. So the daily cron fires and does nothing, every night. Burndown stays **8/9** and PRD line 100 already states this gate correctly, so no spec edit is owed.
- confidence: high
- alternatives: flipping R5 to `[x]` on the strength of two scheduled runs appearing — rejected, and it was the live risk this cycle: the run list alone looks like R5.1 satisfied, and only opening the workflow and reading the job's `if:` shows every scheduled run is a no-op. R5.4 ("no commit when nothing changes") is *also* not evidenced by these runs, because the job never ran to decide that.
- watch-next: flip R5 only when a **scheduled** run shows `conclusion: success` with the `ingest` job actually executed. That cannot happen until `INGEST_SCHEDULE` is set, which is inside #30.
