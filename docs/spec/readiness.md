# Redlands Wifi Project — release readiness

**Cycle 6 · 2026-09-19T07:38Z · product-owner**

## Burndown toward v1: **8 / 9** (unchanged for six cycles)

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

Live site HTTP 200, 18,152 networks, CI green, `main` at `0164f61`, 0 open PRs.

## The one thing blocking everything

**#30 — the private log inbox.** It gates R5 *and* the entire dev-team routine.

The owner **approved** it (ask `msg_92a6bc9c` → `yes`, plus "Rewrite history"). The four objects
the cutover needs still do not exist, re-verified 07:38Z — a third consecutive cycle unchanged:

- `redlands_wifi_inbox` private repo — absent (both spellings)
- `ingest` environment — absent (only `github-pages`)
- `INBOX_TOKEN` secret — absent (0 secrets)
- `INGEST_SCHEDULE` variable — absent (0 variables)

**R5 is implemented but gated off, and that is evidenced.** The scheduled ingest fired
2026-09-18T14:10:34Z and concluded **`skipped`** (same on 2026-09-17), because the job is gated
on `vars.INGEST_SCHEDULE == 'on'`. The cron fires nightly and does nothing. Next firing ~14:10Z
today, and it will skip again.

**Setting `INGEST_SCHEDULE=on` is still not a shortcut to closing R5** (recorded so it is not
re-proposed): with the schedule on, the only intake is the **public** `ingest/` folder — the
exact harm #30 exists to prevent. It is step 4 of `docs/setup/private-inbox.md` and belongs to
the owner, *after* the inbox exists.

## What changed this cycle

**A second resume-path landmine found and defused — #22.** Cycle 5 defused #21 and left a
standing sweep scoped to issues carrying *no* exclusion label. That scope rested on an
unexamined premise: that `po-closure-proposed` is durable parking. It is not.

The dev-team's step-0 checker duty runs before selection, pulls the oldest open closure proposal
(#22), and on a **disagree** verdict strips `po-closure-proposed`. Disagree is the likely branch
here — the verdict on file is `addressed-in-#30`, #30 is still open and unstarted, and the skill
says an unverifiable rationale gets an objection rather than a concurrence. #22 would then be an
unlabelled **p2 older than #30**, so the next run's first pick — and its body says in bold that
it is a decision for the owner, not agent work. That is protocol step 4 again: routine disables
itself, owner interrupted a second time, about a decision they already made.

Fixed label-only with **`blocked`**. Deliberately *not* `needs-human`: that label also suppresses
the PO's closure churn and would switch off the cycle-10 sweep scheduled to resolve #22 — the
same mistake as parking #30, whose `waiting` label is what the resume check enumerates. The
handshake is untouched. **Post-resume order is unchanged: #30 → #25 → #29 → #34.**

The standing sweep itself was rewritten from *"has no exclusion label"* to **reachability**: for
every open issue, is there a path to the top of a tier — including one that runs through another
actor stripping its label — and if it got there, could an actor actually do it? Today's
reachable-and-undoable set is empty.

**No hard invariant and no protocol step was changed this cycle. No issue filed, none closed.**

## Parked for the human (`needs-human`: 2)

| # | item | why parked |
|---|---|---|
| #17 | domain takeover mitigation | owner replied `not-yet` with full facts; registrar/account-side |
| #21 | Dependabot / private vuln reporting / SHA-pinning | repository settings; no actor may flip them |

Parking is not dropping. #17 keeps its objective tripwire (apex ≠ 404 ⇒ immediate `high`; 07:38Z
reading: **404**, GitHub's "Site not found" page, latent) and one dated re-raise at cycle 9.
#21's carrier is cycle 2's standing task.

## Still waiting on the owner

| item | what is needed | state |
|---|---|---|
| **#30** | do the 3 parts in `docs/setup/private-inbox.md`, then reply `DONE private-inbox` | **the blocker — ~10 min** |
| step-4 amendment | rule on letting dev-team skip a `waiting` issue instead of halting entirely | proposed cycle 3, unruled |
| `msg_65c5813b` | dismiss the junk "probe" ask (cycle 2's self-reported error; no withdraw verb) | open |

## Routine status

`autonomy-dev-team-redlands-wifi-project` **stays disabled**, re-verified `enabled: false` with
`lastRunAt` 2026-09-17T15:05:07Z. The evidence that this is a *blocked* queue and not an empty
one is `gh issue list --json number,labels,assignees`: **#25, #29 and #34 are open, unassigned
and unlabelled**, their bodies re-read this cycle and all three are pure repo work (an ingest
guard, two map-popup edge cases, an e2e test split) with no dependency on #30 or #17. They have
been parked **~40.5 h**. The routine is off because constitution protocol step 4 mandates it
while any `waiting` issue is live. The cycle-3 step-4 amendment would decouple those two
intents; it is the owner's call and remains unruled.

## Convergence

Open count flat at **8** for six cycles; net issue delta this cycle **0**. Flatness reflects a
**blocked queue, not a diverging one** — no agent work has been possible since 2026-09-17T15:05Z
— so the runaway-backlog tripwire (`net_open_tripwire_k: 3`, which watches for a *rising* count)
is not tripped. Next scheduled state changes: #22's objection window shuts **2026-09-20T01:42Z**;
the sweep, the digest full rebuild, and the owner-approved git-history-rewrite filing are all
first eligible at **cycle 10 (~2026-09-20T07:38Z)**.

## Next owner message

One `low` notify this cycle, as committed at cycle 5 — this run lands at **00:38 PT**, and a
`high` that wakes someone at half past midnight for a ten-minute task they can only do at a
computer spends the priority flag and buys no response time. **Cycle 7 (~06:38 PT) is also
`low`. Cycle 8 (~2026-09-19T19:38Z ≈ 12:38 PT) goes `high`** if all four #30 objects are still
absent — 24 h after the first `high`, in the owner's working afternoon, about #30 alone. After
cycle 8, no further timed escalation: one `low` mention per day.
