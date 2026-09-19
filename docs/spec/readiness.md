# Redlands Wifi Project — release readiness

**Cycle 5 · 2026-09-19T01:38Z · product-owner**

## Burndown toward v1: **8 / 9** (unchanged for five cycles)

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

Live site HTTP 200, 18,152 networks, CI green, `main` at `05463ad`, 0 open PRs.
R4.12 re-spot-checked against the **served** database: keys are exactly
`auth, bssid, channel, first_seen, lat, lon, ssid` — no RSSI, altitude or accuracy.

## The one thing blocking everything

**#30 — the private log inbox.** It gates R5 *and* the entire dev-team routine.

The owner **approved** it (ask `msg_92a6bc9c` → `yes`, plus "Rewrite history"). The four objects
the cutover needs still do not exist, re-verified 01:38Z — unchanged from cycle 4:

- `redlands_wifi_inbox` private repo — absent
- `ingest` environment — absent (only `github-pages`)
- `INBOX_TOKEN` secret — absent (0 secrets)
- `INGEST_SCHEDULE` variable — absent (0 variables)

**R5's failure is now evidenced, not inferred.** The scheduled ingest fired on
2026-09-18T14:10:34Z and concluded **`skipped`** (same on 2026-09-17). The job is gated on
`vars.INGEST_SCHEDULE == 'on'`, so the cron fires nightly and does nothing.

**Why setting `INGEST_SCHEDULE=on` is not a shortcut to closing R5** (recorded so it is not
re-proposed): with the schedule on, the only intake is the **public** `ingest/` folder — so it
would invite raw wardrive logs into a public repo, the exact harm #30 exists to stop. The
variable is step 4 of `docs/setup/private-inbox.md` and belongs to the owner, after the private
inbox exists. Sequence matters here.

**Timing.** Cycle 4's `high` went out 12:46 PT; this cycle runs 18:38 PT. A full working
afternoon passed with the message in the inbox and nothing moved.

## What changed this cycle

**One scheduling trap found and defused — #21.** It was the oldest open `p3`, unassigned and
carrying no exclusion label, so it was the **first issue a resumed dev-team run would pick**.
Its own body says an agent may not do it (repository settings), so the worker's only legal move
is protocol step 4: disable the routine and interrupt the owner again.

The sequence that was queued up: owner replies `DONE private-inbox` → routine re-enables →
selects #21 → re-disables itself → owner gets a *second* interruption → #25, #29 and #34 stay
parked. Fixed label-only (`blocked` + `needs-human`). **Post-resume order is now
#30 → #25 → #29 → #34.**

Also: #17 given `needs-human` (recording cycle 4's decision, with the tripwire and the cycle-9
re-raise explicitly exempt), the `needs-human` label created, and one row added to the
constitution's label table documenting it. **No hard invariant and no protocol step was
changed.**

## Parked for the human (`needs-human`: 2)

| # | item | why parked |
|---|---|---|
| #17 | domain takeover mitigation | owner replied `not-yet` with full facts; registrar/account-side |
| #21 | Dependabot / private vuln reporting / SHA-pinning | repository settings; no actor may flip them |

Parking is not dropping. #17 keeps its objective tripwire (apex ≠ 404 ⇒ immediate `high`;
01:39Z reading: **404**, latent) and one dated re-raise at cycle 9. #21's carrier is cycle 2's
standing task — write `docs/setup/security-settings.md` and send its ask once the owner queue
is clear.

## Still waiting on the owner

| item | what is needed | state |
|---|---|---|
| **#30** | do the 3 parts in `docs/setup/private-inbox.md`, then reply `DONE private-inbox` | **the blocker — ~10 min** |
| step-4 amendment | rule on letting dev-team skip a `waiting` issue instead of halting entirely | proposed cycle 3, unruled |
| `msg_65c5813b` | dismiss the junk "probe" ask (cycle 2's self-reported error; no withdraw verb) | open |

## Routine status

`autonomy-dev-team-redlands-wifi-project` **stays disabled**, and the evidence for that is
`gh issue list --json number,labels,assignees`, not the routine's own state: **#25, #29 and #34
are open, unassigned and unlabelled** — genuinely shippable, none dependent on #30 or #17 — and
they have been parked since **2026-09-17T15:05Z (~34.5 h)**. The routine is off because
constitution protocol step 4 mandates it while any `waiting` issue is live, not because the
backlog is empty. The step-4 amendment proposed at cycle 3 would decouple those two intents;
it is the owner's call and remains unruled.

## Convergence

Open count flat at **8** for five cycles; net issue delta this cycle **0** (nothing filed,
nothing closed). No agent work has been possible since 2026-09-17T15:05Z, so flatness here
reflects a **blocked queue, not a diverging one** — the tripwire for runaway backlog growth is
not tripped. #22's closure proposal is the next scheduled state change: its 48 h objection
window shuts 2026-09-20T01:42Z, first eligible sweep **cycle 10 (~2026-09-20T07:38Z)**. The
owner-approved git-history rewrite is filed only once that sweep frees §4e budget — also
cycle 10, corrected this cycle from an earlier "cycle 5".

## Next owner message

One `low` notify this cycle. **Committed rung:** cycles 6 and 7 are overnight/early PT and send
`low` regardless; **cycle 8 (~2026-09-19T19:38Z ≈ 12:38 PT) goes `high`** if all four #30
objects are still absent — 24 h after the first `high`, in the owner's working afternoon, about
#30 alone. After cycle 8, stop escalating on a timer and drop to one `low` mention per day.
