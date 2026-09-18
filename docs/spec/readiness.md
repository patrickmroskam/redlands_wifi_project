# Redlands Wifi Project — release readiness

**Cycle 4 · 2026-09-18T19:45Z · product-owner**

## Burndown toward v1: **8 / 9**

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

Live site HTTP 200, 18,152 networks, CI green, `main` at `5dbfbf9`, 0 open PRs.

## The one thing blocking everything

**#30 — the private log inbox.** It gates R5 *and* the entire dev-team routine.

The owner **approved** it (ask `msg_92a6bc9c` → `yes`, plus "Rewrite history"). But the four
objects the cutover needs still do not exist, re-verified 19:40Z:

- `redlands_wifi_inbox` private repo — absent (both spellings checked)
- `ingest` environment — absent
- `INBOX_TOKEN` secret — absent (0 secrets)
- `INGEST_SCHEDULE` variable — absent (0 variables)

That last one is why **every scheduled ingest run is a no-op**: the job is gated on
`vars.INGEST_SCHEDULE == 'on'`, so the 2026-09-17 and 2026-09-18 cron runs both came back
`skipped`. The cron fires nightly and does nothing.

**Why it has not moved:** the ask was posed as a question and the owner answered the question.
`docs/setup/private-inbox.md` needs ~10 minutes of setup and resumes on `DONE private-inbox`,
and nothing has ever told the owner that work is still outstanding. That is this cycle's
notify, sent at `high`.

## Decisions the owner has made (cycle 4)

- **#17 domain takeover → `not-yet`.** An informed deferral: the doc stated that the domain is
  already theirs, that the fix is one TXT record, ~5 minutes, invisible to visitors. Risk
  accepted and recorded. **No further asks, no timed nagging** — replaced by an objective
  tripwire (apex returns anything but 404 ⇒ immediate `high`) plus one dated re-raise at
  cycle 9. Relabelled: `waiting` off, `blocked` on, p1 → p2.
- **Git history rewrite → opted in** ("Rewrite history", the doc's exact opt-in phrase).
  Recorded on #30 and #22; to be filed as its own issue once the §4e budget allows. It must
  not ride inside #30's cutover — it is destructive and irreversible on a public repo.

## Still waiting on the owner

| item | what is needed | state |
|---|---|---|
| **#30** | do the 3 parts in `docs/setup/private-inbox.md`, then reply `DONE private-inbox` | **the blocker** |
| step-4 amendment | rule on letting dev-team skip a `waiting` issue instead of halting entirely | proposed cycle 3, unruled |
| #21 | Dependabot / private vuln reporting / SHA-pinning toggles | p3, deliberately queued behind #30 |
| `msg_65c5813b` | dismiss the junk "probe" ask (cycle 2's self-reported error; no withdraw verb) | open |

## Convergence tripwire

**Not tripped, but worth naming.** Four consecutive cycles have produced zero issue movement
(`net_open_history: [8, 8, 8, 8]`) and the dev-team routine has been disabled since
2026-09-17T15:05Z. Three unblocked p3 issues (#25, #29, #34) have been parked that whole time,
not for lack of work but because the constitution's step 4 halts the entire routine while any
issue is `waiting`. Both levers are the owner's: finish #30, or rule on the step-4 amendment.

## Not due yet

#22's closure proposal ages out **2026-09-20T01:42Z**; first eligible sweep is **cycle 10**
(~09-20T07:38Z). A cycle-numbering error in the cycle-1 task said "cycle 5" and would have
swept ~24 h early — corrected this cycle.
