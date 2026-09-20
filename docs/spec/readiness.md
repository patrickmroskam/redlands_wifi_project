# Redlands Wifi Project — release readiness

**Cycle 9 · 2026-09-20T01:38Z · product-owner**

## Burndown toward v1: **8 / 9** (unchanged for nine cycles)

| # | criterion | state |
|---|---|---|
| R1 | one page, retro banner, responsive, privacy link | ✅ |
| R2 | map, fenced to 92373/92374, popups + legend + stats | ✅ |
| R3 | `ingest/` folder + plain-language README | ✅ |
| R4 | pipeline: fence, WIFI-only, `_nomap`, dedupe, append, delete, loud failure | ✅ |
| **R5** | **daily Actions ingest that commits and redeploys** | ❌ **the only gap** |
| R6 | privacy policy page | ✅ |
| R7 | no secrets; raw logs never persist outside `ingest/` | ✅ |
| R8 | unit tests + Playwright smoke green in CI | ✅ |
| — | initial batch ingested and live | ✅ |

Live site HTTP 200, 18,152 networks, CI green, `main` at `f3e1b86`, 0 open PRs.

## The one thing blocking everything

**#30 — the private log inbox.** It gates R5 *and* the entire dev-team routine.

The owner **approved** it (ask `msg_92a6bc9c` → `yes`, plus "Rewrite history"). The four objects the
cutover needs still do not exist, re-verified 01:39Z — a **sixth** consecutive cycle unchanged:

- `redlands_wifi_inbox` private repo — absent (both spellings)
- `ingest` environment — absent (only `github-pages`)
- `INBOX_TOKEN` secret — absent (0 secrets)
- `INGEST_SCHEDULE` variable — absent (0 variables)

R5 is implemented but gated off. Every scheduled run this workflow has ever had concluded
**`skipped`** — 2026-09-17T14:44:46Z, 2026-09-18T14:10:34Z, 2026-09-19T13:43:57Z — gated on
`vars.INGEST_SCHEDULE == 'on'` (`.github/workflows/ingest.yml:28`). No new run since cycle 8, so the
count still stands at three.

**Setting `INGEST_SCHEDULE=on` is still not a shortcut to closing R5**: with the schedule on, the
only intake is the **public** `ingest/` folder — the exact harm #30 exists to prevent. It is step 4
of `docs/setup/private-inbox.md` and belongs to the owner, *after* the inbox exists.

## What changed this cycle

**The find: #22's closure proposal is not auto-close eligible, and cycle 10 was set to close it.**

The 48 h no-objection window on #22's proposal (posted 2026-09-18T01:42:32Z) shut at
**2026-09-20T01:42:32Z — during this run** — with **0** post-proposal objections. On the aging test
alone, #22 was due to self-close on the next pass, and `po-tasks.md` said exactly that:
*"#22 is either self-closed with verdict `addressed-in-#30`"*.

It is **not eligible.** `closure-handshake.md`, the declared canonical contract, gates the verdict
class *before* the check-and-act snippet runs:

> `addressed-in-#NNN` — the work shipped in **PR** #NNN (a merged PR, not a bare commit SHA).
> Auto-close eligible? **Yes *if PR #NNN is merged*.**

Path 2 repeats it: eligible *"with the named issue/PR **confirmed closed-completed on re-check**"*.
Re-checked live at 01:41Z:

| check | result |
|---|---|
| is #30 a merged PR? | **No** — `GET /repos/…/pulls/30` → `404 Not Found` |
| is the named target closed-completed? | **No** — `state=OPEN`, labels `p2,waiting` |
| has any merged PR shipped option C? | **No** — #37 is the setup doc; #26 is the privacy-page *disclosure* that the raw logs are public |
| post-proposal `closure-objection:` count | **0** |
| `launch-blocker`? | no |

The precondition is false, so the remaining branch applies: **route to the human digest as
"awaiting human closure decision" — do not auto-close.**

**What closing it would have cost.** #22 is the record that the raw logs expose the car's
timestamped **drive path**, and that they remain in **public git history**. The exposure is live and
the fix (#30) is still blocked on the owner. Closing it would have erased the only open record of a
live privacy exposure at the moment the owner is being asked to act on it.

**Where the trap lives: compression, not the contract.** The handshake's own check-and-act snippet
tests only `state` / post-proposal objection / `launch-blocker` — it omits the named-target check
because eligibility is settled in the prose above it. `po-tasks.md` then compressed the rule down to
its *action* and dropped the *precondition* entirely. A run following either text top-down closes
the issue. Both are fixed: the sweep task is rewritten with the gate inline, and a new standing task
requires any task-file entry restating a skill rule to carry that rule's preconditions.

**Confidence: high — and unlike cycle 8's find, not hedged.** Every element is a command result
rather than a judgement: the eligibility rule is quoted text, #30's non-PR-ness and open state are
single API calls, and the objection count uses the skill's own `jq` query. The hazard is not
speculative either — the wrong instruction was already written down in the task file, aimed at the
next cycle.

**Action taken:** a comment on #22. `po-closure-proposed` **kept** — the proposal is genuinely open
(neither concurred nor objected), and the label is what keeps #22 in dev-team's step-0 queue, which
is the handshake's *real* checker. Nothing closed, no label changed, and no objection recorded (an
ineligible verdict is not a veto; logging it as one would wrongly bar a legitimate re-proposal).

**Knock-on: two deferred tasks had their blockers corrected.** Cycle 10 was built around a close
that will not happen.

- **#17 retitle — unblocked; it was never budget-blocked.** Cycles 2–8 deferred it on "§4e needs
  ≥ 1 realized close". That applied to the *original* route (file a second issue). Cycle 4 had
  already narrowed it to **retitling #17 to the mitigation alone**, which files nothing — §4e
  budgets *filing*, so it never applied. Now scheduled for cycle 10 with an accurate blocker: none.
- **History-rewrite issue — still blocked, on a different condition.** It genuinely is a new issue
  (+1 net delta), so it genuinely needs §4e budget. Its unblock is now **any realized close**, with
  no cycle attached.

**#17 re-raised once, as committed — and the rung is spent.** The single dated reminder scheduled at
cycle 4 for cycle 9 was posted on #17: the tripwire table, both ~5-minute exits from
`docs/setup/domain-takeover.md`, and an explicit statement that **neither reverses the owner's
`not-yet`** — neither serves the site on the custom domain, and the switch is out of v1 scope per
the ratified PRD. No re-ask (the ask is answered). **There is no further timer on #17.**

**No hard invariant and no protocol step was changed. No issue filed, none closed, no label added or
removed.**

## Parked for the human (`needs-human`: 2)

| # | item | why parked |
|---|---|---|
| #17 | domain takeover mitigation (p2) | owner replied `not-yet` with full facts; registrar/account-side |
| #21 | Dependabot / private vuln reporting / SHA-pinning (p3) | repository settings; no actor may flip them |

Parking is not dropping. #17 keeps its objective tripwire — apex ≠ 404 ⇒ immediate `high`; 01:39Z
reading: **404**, GitHub's "Site not found" page, apex `A` still in the Pages range, challenge TXT
still absent, `pages.cname` still `null` — **latent**, sixth consecutive run unchanged. Its one
dated re-raise **has now been spent** (this cycle). #21's carrier is cycle 2's standing task.

## Still waiting on the owner

| item | what is needed | state |
|---|---|---|
| **#30** | do the 3 parts in `docs/setup/private-inbox.md`, then reply `DONE private-inbox` | **the blocker — ~10 min** |
| step-4 amendment | rule on letting dev-team skip a `waiting` issue instead of halting entirely | proposed cycle 3, unruled |
| `msg_65c5813b` | dismiss the junk "probe" ask (cycle 2's self-reported error; no withdraw verb) | open |

## Routine status

`autonomy-dev-team-redlands-wifi-project` **stays disabled**, re-verified `enabled: false` with
`lastRunAt` 2026-09-17T15:05:07.762Z. Per the standing evidence rule, the claim that this is a
*blocked* queue and not an empty one is `gh issue list --json number,labels,assignees`: **#25, #29
and #34 are open, unassigned and unlabelled**, and all three are pure repo work (an ingest guard,
two map-popup edge cases, an e2e test split) with no dependency on #30 or #17. They have now been
parked **~58.5 h**. The routine is off because constitution protocol step 4 mandates it while any
`waiting` issue is live — verified against the literal text at cycle 7. The cycle-3 step-4 amendment
would decouple those two intents; it is the owner's call and remains unruled.

## Sweeps

**§4h blocked queue** — `label:blocked -label:needs-human` and `label:waiting -label:needs-human`
return exactly **{#22, #30}**, unchanged from cycle 8, and neither carries `needs-human`: **no
regression.** Both are branch **(b) — still legitimately blocked, leave it** — with named verifiable
paths, **one of which changed this cycle**: #22 → **dev-team step-0 adjudication on resume** (no
longer the cycle-10 sweep, which cannot close it); #30 → the owner's `DONE private-inbox`.

**Reachability / doability / staleness** — all 8 swept; both sets **empty** (fifth consecutive
clean). Zero issue activity since the last watermark (`total_count: 0`), so inputs were re-read
rather than assumed. #25/#29/#34 re-read in full. #30's cycle-7 banner verified present with the
original body verbatim below it. #1 re-read and cleared — its R5 line orders `INGEST_SCHEDULE=on`
**after** the cutover, and it carries no priority label so it never enters a tier search.
**Post-resume order unchanged: #30 → #25 → #29 → #34.**

## Convergence

Open count flat at **8** for nine cycles; net issue delta this cycle **0**; closed 0 / proposed 0 /
contested 0. Flatness reflects a **blocked queue, not a diverging one** — no agent work has been
possible since 2026-09-17T15:05Z — so the runaway-backlog tripwire (`net_open_tripwire_k: 3`, which
watches for a *rising* count) is not tripped.

**Cycle 10 (~2026-09-20T07:38Z) owes:** the digest **full rebuild** (`digest_full_rebuild_every_cycles: 10`),
the **#17 retitle** (now unblocked), and the **#22 sweep in its rewritten form** — route to the human
digest, *not* self-close. The git-history-rewrite filing is **not** due at cycle 10; it waits on a
realized close.

## Next owner message

One `low` notify this cycle. The #30 rung retired at cycle 8 after firing, and cycle 8's message
promised the owner in as many words that it was the last timed escalation — so #30 gets one quiet
mention and nothing more. The one substantive item is #17's single dated reminder, which is a
reminder against a decision the owner already made, not a new escalation; cycle 4 explicitly barred
escalating #17 on any other timer, and the tripwire is latent. The #22 find needs **no owner action**
and is reported for transparency only.
