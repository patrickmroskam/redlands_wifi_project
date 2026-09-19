# Redlands Wifi Project — release readiness

**Cycle 7 · 2026-09-19T13:38Z · product-owner**

## Burndown toward v1: **8 / 9** (unchanged for seven cycles)

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

Live site HTTP 200, 18,152 networks, CI green (last 8 runs `success`), `main` at `c6fdb88`, 0 open PRs.

## The one thing blocking everything

**#30 — the private log inbox.** It gates R5 *and* the entire dev-team routine.

The owner **approved** it (ask `msg_92a6bc9c` → `yes`, plus "Rewrite history"). The four objects
the cutover needs still do not exist, re-verified 13:38Z — a **fourth** consecutive cycle unchanged:

- `redlands_wifi_inbox` private repo — absent (both spellings)
- `ingest` environment — absent (only `github-pages`)
- `INBOX_TOKEN` secret — absent (0 secrets)
- `INGEST_SCHEDULE` variable — absent (0 variables)

**R5 is implemented but gated off, and that is evidenced.** The scheduled ingest fired
2026-09-18T14:10:34Z and concluded **`skipped`**, because the job is gated on
`vars.INGEST_SCHEDULE == 'on'` (`.github/workflows/ingest.yml:28`). The cron fires nightly and does
nothing. Next firing ~14:10Z today, and it will skip again.

**Setting `INGEST_SCHEDULE=on` is still not a shortcut to closing R5** (re-recorded so it is not
re-proposed): with the schedule on, the only intake is the **public** `ingest/` folder — the exact
harm #30 exists to prevent. It is step 4 of `docs/setup/private-inbox.md` and belongs to the owner,
*after* the inbox exists.

## What changed this cycle

**A staleness trap on the resume path's first pick — #30 itself.**

Cycles 5 and 6 tested every open issue with two questions: can it reach the top of a tier, and
could an actor actually do it? #30 passes **both** — and was still a trap. Two instructions in its
body were written before the owner answered:

- *"the run that works this issue must write `docs/setup/<slug>.md` and send the ask first"* — the
  doc exists (PR #37) and the ask is answered.
- *"**Not decided — ask the owner, don't assume:** whether to rewrite this repo's history"* — now
  decided; the reply carried the opt-in phrase **"Rewrite history"**.

Read top-down and literally, either line sends a resuming run back into constitution protocol
step 4 — write a doc, send an ask, re-label `waiting`, disable the routine — a **third** owner
interruption about decisions already made. And #30 is the *first* issue picked on resume.

Fixed **additively**: a status banner marking both items resolved with their evidence, prepended to
the body, with the original text preserved **verbatim** below it (verified byte-for-byte after the
edit). No label changed; the handshake is untouched.

**Confidence: medium — lower than the last two cycles, and recorded that way on purpose.** #21 and
#22 were near-certain traps: owner-only issues sitting at the top of a workable tier. Here the
correct plan already existed in #30's 2026-09-17T15:06:58Z comment, so a careful run would probably
have got it right. The banner costs nothing and removes the ambiguity; it is **not** a claim that a
run would have failed. Two consecutive landmine cycles create pressure to produce a third, and this
one is deliberately not inflated to match them.

**The sweep rule gains a third question:** *(3) does the issue's own text instruct an actor to halt
or re-ask about something already resolved?* A staleness check, distinct from doability — the first
is a property of the text and fixable by the PO alone, the second a property of the world.

**Protocol step 4 re-verified against exact wording**, not inherited. It reads *"Disable the
dev-team routine … **Do not pick another issue. Exit.**"*, and the resume path ties re-enabling to
the human's `DONE <slug>` reply. Cycle 3's correction stands, now grounded in literal text rather
than carried forward.

**No hard invariant and no protocol step was changed this cycle. No issue filed, none closed, no
label added or removed.**

## Parked for the human (`needs-human`: 2)

| # | item | why parked |
|---|---|---|
| #17 | domain takeover mitigation | owner replied `not-yet` with full facts; registrar/account-side |
| #21 | Dependabot / private vuln reporting / SHA-pinning | repository settings; no actor may flip them |

Parking is not dropping. #17 keeps its objective tripwire (apex ≠ 404 ⇒ immediate `high`; 13:38Z
reading: **404**, GitHub's "Site not found" page, apex `A` still in the Pages range, challenge TXT
still absent — latent) and one dated re-raise at cycle 9. #21's carrier is cycle 2's standing task.

## Still waiting on the owner

| item | what is needed | state |
|---|---|---|
| **#30** | do the 3 parts in `docs/setup/private-inbox.md`, then reply `DONE private-inbox` | **the blocker — ~10 min** |
| step-4 amendment | rule on letting dev-team skip a `waiting` issue instead of halting entirely | proposed cycle 3, unruled |
| `msg_65c5813b` | dismiss the junk "probe" ask (cycle 2's self-reported error; no withdraw verb) | open |

## Routine status

`autonomy-dev-team-redlands-wifi-project` **stays disabled**, re-verified `enabled: false` with
`lastRunAt` 2026-09-17T15:05:07Z. Per the standing evidence rule, the claim that this is a
*blocked* queue and not an empty one is `gh issue list --json number,labels,assignees`: **#25, #29
and #34 are open, unassigned and unlabelled**, and all three are pure repo work (an ingest guard,
two map-popup edge cases, an e2e test split) with no dependency on #30 or #17. They have now been
parked **~46.5 h**. The routine is off because constitution protocol step 4 mandates it while any
`waiting` issue is live — verified against the literal text this cycle. The cycle-3 step-4
amendment would decouple those two intents; it is the owner's call and remains unruled.

## Reachability sweep — all 8 open issues

Reachable-and-undoable set: **empty** (third cycle running). Reachable-and-stale set: **{#30}**, now
banner-corrected. #22's cycle-6 `blocked` parking holds: the dev-team's step-0 checker strips
`po-closure-proposed` on a disagree verdict, but `blocked` remains, so #22 cannot surface as an
unlabelled p2 older than #30. One ordering check recorded: `blocked` could in principle be stripped
by the merge-time unblock step if #30 merges — but the cycle-10 sweep (2026-09-20T07:38Z) resolves
#22 first, and #30 cannot merge before the owner acts, so the ordering holds.

**Post-resume order is unchanged: #30 → #25 → #29 → #34.**

## Convergence

Open count flat at **8** for seven cycles; net issue delta this cycle **0**. Flatness reflects a
**blocked queue, not a diverging one** — no agent work has been possible since 2026-09-17T15:05Z —
so the runaway-backlog tripwire (`net_open_tripwire_k: 3`, which watches for a *rising* count) is
not tripped. Next scheduled state changes: #22's objection window shuts **2026-09-20T01:42Z**;
cycle 9 (~2026-09-20T01:38Z) owes #17 its single dated re-raise; the #22 sweep, the digest full
rebuild, and the owner-approved git-history-rewrite filing are all first eligible at **cycle 10
(~2026-09-20T07:38Z)**.

## Next owner message

One `low` notify this cycle, as committed at cycle 5 — this run lands at **06:38 PT**, and the rung
was decided precisely so later cycles execute rather than re-argue it. **Cycle 8
(~2026-09-19T19:38Z ≈ 12:38 PT) goes `high`** if all four #30 objects are still absent — 24 h after
the first `high`, in the owner's working afternoon, about #30 alone. After cycle 8, no further timed
escalation: one `low` mention per day, on the reasoning that retired the #17 rung — an informed
owner who has not acted is choosing, and repetition is not new information.
