# Redlands Wifi Project — release readiness

**Cycle 8 · 2026-09-19T19:38Z · product-owner**

## Burndown toward v1: **8 / 9** (unchanged for eight cycles)

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

Live site HTTP 200, 18,152 networks, CI green, `main` at `965beaa`, 0 open PRs.

## The one thing blocking everything

**#30 — the private log inbox.** It gates R5 *and* the entire dev-team routine.

The owner **approved** it (ask `msg_92a6bc9c` → `yes`, plus "Rewrite history"). The four objects the
cutover needs still do not exist, re-verified 19:38Z — a **fifth** consecutive cycle unchanged:

- `redlands_wifi_inbox` private repo — absent (both spellings)
- `ingest` environment — absent (only `github-pages`)
- `INBOX_TOKEN` secret — absent (0 secrets)
- `INGEST_SCHEDULE` variable — absent (0 variables)

**R5 is implemented but gated off, and there are now three data points.** Every scheduled run this
workflow has ever had concluded **`skipped`** — 2026-09-17T14:44:46Z, 2026-09-18T14:10:34Z, and
today's **2026-09-19T13:43:57Z** — gated on `vars.INGEST_SCHEDULE == 'on'`
(`.github/workflows/ingest.yml:28`). The cron fires nightly and does nothing.

**Setting `INGEST_SCHEDULE=on` is still not a shortcut to closing R5** (re-recorded so it is not
re-proposed): with the schedule on, the only intake is the **public** `ingest/` folder — the exact
harm #30 exists to prevent. It is step 4 of `docs/setup/private-inbox.md` and belongs to the owner,
*after* the inbox exists.

## What changed this cycle

**The escalation rung fired, and it is now retired.** Cycle 5 committed, in advance, that if all
four #30 objects were still absent at cycle 8 (≈ 12:38 PT) that cycle's notify would go at `high`,
about #30 alone, 24 h after the first. They are, so it did. **From cycle 9 on there is no timed
escalation on #30** — one `low` mention per day. An informed owner who has not acted is choosing,
and repetition is not new information; that is the same reasoning that retired the #17 rung.

**The find: the PO's own §4h sweep is aimed at the two issues that must never be parked.**

Cycles 5–7 kept finding traps on the *dev-team's* resume path. This one is on the **PO's own** path.
The product-owner skill's §4h blocked-queue sweep enumerates, verbatim:

```
gh issue list --state open --search "label:blocked sort:created-asc -label:needs-human"   → #22
gh issue list --state open --search "label:waiting sort:created-asc -label:needs-human"   → #30
```

Run at 19:38Z, that returns **exactly {#22, #30}** — and those are precisely the two issues in this
backlog that must never receive `needs-human`. #22 because that label suppresses closure churn and
would switch off its own cycle-10 aging sweep (the reason cycle 6 chose `blocked` instead). #30
because this routine's resume check enumerates open issues labelled `waiting`, so parking #30 turns
off the check that restarts the entire project.

§4h's escalate branch fires when an issue *"has aged past `closure_aging_window_hours` with the
blocker unchanged and no path you can verify"*. Both are now past 48 h with their blockers
unchanged, and neither carries a `Blocked by #N` dependency of the kind §4h's other two branches
look for. A run that matched on age and on the missing dependency, without weighing the last clause,
lands on escalate.

Both are branch **(b) — still legitimately blocked, leave it** — and the verifiable paths are now
written into `po-tasks.md` so no cycle has to re-derive them: #22 resolves at the cycle-10 aging
sweep (~2026-09-20T07:38Z, window shuts 2026-09-20T01:42Z); #30 resolves on the owner's
`DONE private-inbox`, checked objectively every cycle.

**Confidence: high on the mechanism, medium on the hazard — and recorded that way deliberately.**
The commands were *run*, not reasoned about, so the enumeration is certain. Whether a careful run
would actually escalate is less certain: the "no path you can verify" clause sits in the same
sentence as the age trigger, and both paths here are verifiable and dated. This is a guard against a
plausible misread, not a claim the misread was imminent. Three consecutive trap-finding cycles create
pressure to produce a fourth; this one is not inflated to match, and the remedy costs one task-file
entry and changes no label.

**One reconciliation correction.** The digest's *Hosting / custom domain* rollup still read
`p1:1` and *"Priority holds at p1"* — wrong since **cycle 4**, which deliberately moved #17
`p1 → p2` when the owner answered `not-yet` (GitHub's label timeline confirms 2026-09-18T19:45:33Z).
The readiness parked table was updated then; this rollup was not, and three cycles carried it
forward unread. Corrected, with the cycle-4 rationale folded in. Operationally harmless — tier
searches read GitHub, never this file — but it was the PO's working memory contradicting the PO's
own decision. The other five rollups were re-checked and are correct.

**Staleness sweep clean.** #25, #29 and #34 re-read in full: pure repo work, no halt-or-re-ask
instruction, no owner-decision language. #30's cycle-7 banner verified present with the original
body preserved verbatim below it. Reachable-and-undoable: empty (fourth cycle). Reachable-and-stale:
empty.

**No hard invariant and no protocol step was changed. No issue filed, none closed, no label added or
removed.**

## Parked for the human (`needs-human`: 2)

| # | item | why parked |
|---|---|---|
| #17 | domain takeover mitigation (p2) | owner replied `not-yet` with full facts; registrar/account-side |
| #21 | Dependabot / private vuln reporting / SHA-pinning (p3) | repository settings; no actor may flip them |

Parking is not dropping. #17 keeps its objective tripwire (apex ≠ 404 ⇒ immediate `high`; 19:38Z
reading: **404**, GitHub's "Site not found" page, apex `A` still in the Pages range, challenge TXT
still absent, `pages.cname` still `null` — latent) and **its one dated re-raise falls at cycle 9,
the very next run.** #21's carrier is cycle 2's standing task.

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
parked **~52.5 h**. The routine is off because constitution protocol step 4 mandates it while any
`waiting` issue is live — verified against the literal text at cycle 7. The cycle-3 step-4 amendment
would decouple those two intents; it is the owner's call and remains unruled.

## Reachability sweep — all 8 open issues

Reachable-and-undoable: **empty** (fourth cycle). Reachable-and-stale: **empty**. #22's cycle-6
`blocked` parking holds, and cycle 8 verified against the skill text that §4d selects by the
`po-closure-proposed` label without excluding `blocked` — so the parking does not disarm the sweep
that resolves it. **Post-resume order is unchanged: #30 → #25 → #29 → #34.**

## Convergence

Open count flat at **8** for eight cycles; net issue delta this cycle **0**. Flatness reflects a
**blocked queue, not a diverging one** — no agent work has been possible since 2026-09-17T15:05Z —
so the runaway-backlog tripwire (`net_open_tripwire_k: 3`, which watches for a *rising* count) is
not tripped. Next scheduled state changes: **cycle 9 (~2026-09-20T01:38Z)** owes #17 its single
dated re-raise; #22's objection window shuts **2026-09-20T01:42Z**; the #22 aging sweep, the digest
full rebuild, the #17 retitle, and the owner-approved git-history-rewrite filing are all first
eligible at **cycle 10 (~2026-09-20T07:38Z)**.

## Next owner message

One `high` notify this cycle, about **#30 alone** — the rung committed at cycle 5, fired on its
stated condition, in the owner's working afternoon, 24 h after the first `high`. **The rung retires
with it.** **Sent: `msg_d45a7eb7-0213-4210-a350-8f315fe4c2bf`, `high`, `delivered`, 2026-09-19T19:4xZ
— one message, not retried.** It carries the doc link, the exact resume phrase `DONE private-inbox`,
the five-cycle objective evidence, the `INGEST_SCHEDULE` anti-shortcut, and the explicit promise that
this is the last timed escalation. Cycle 9 sends `low` and carries #17's one dated re-raise; from there, one `low` mention
per day on #30 and nothing more.
