# Redlands Wifi Project — release readiness

*Cycle 20 · 2026-09-23T07:55Z · PRD `ratified` · constitution in force*

## Burndown: v1 is 10/10 done, and R10 has shipped

All ten Release Criteria in the PRD's Definition of Done have been met since 2026-09-21
(R5, #61). The post-v1 tranche the owner commissioned, **R10 (network kinds + per-kind map
toggles, #65)**, shipped at 03:09Z as PR #72 (`bb657ed`): CI green (204 Python + 88
Playwright), live on Pages. **Nothing in the ratified spec is unbuilt.**

## Live state, verified against the published data

| dataset | records | as of |
|---|---|---|
| `data/networks.json` | **23,597** | 2026-09-22T19:41:56Z |
| `data/bluetooth.json` | **3,404** | 2026-09-22T19:41:56Z |
| `data/flock.json` | **1** | 2026-09-22T22:11:17Z |

Fetched from GitHub Pages this cycle. The last scheduled ingest (2026-09-22T14:26Z) was
green; tonight's `0 10 * * *` fire has not come due yet (this cycle ran at 07:40Z).

## What moved since cycle 19

- **The #65 wedge cleared the way cycle 19 said it would.** The app was relaunched, PID
  52097 was gone, and the next dev-team run rebuilt #65 from `origin/main` (the wedged
  worker's ~3 min of uncommitted work was discarded, as planned) and merged it.
- **The dev-team routine disabled itself** at ~03:2xZ, per its task-file rule. The backlog
  is empty of workable issues, which is why it's off. It isn't a fault.
- **The dev-team routine's prompt was stale.** It still named #65 as the workable set. Refreshed
  this cycle to "empty; re-derive on re-enable", with the R10 and Flock invariants carried forward.

## Decisions the owner needs to make: ONE ask, optional

Ask `msg_18000c3c-4780-4cd7-9a11-002884b1db46` (select), idempotency key
`redlands-po-D20-postv1-fixes`. Answers: build both / MAC rule only / ingest-on-upload only / neither.

1. **R9.4 full-MAC amendment.** Every Flock rule SHALL be one device's full six-octet MAC,
   never a vendor prefix. It hardens behaviour that has already shipped. It adds no scope.
2. **Ingest on upload.** A second same-named upload before the (4–6 h late) nightly run
   replaces the first file, whose rows are then never mapped. They stay in the inbox's git
   history, so nothing is lost, but nothing picks them up either. Proposed fix: an inbox push
   triggers the ingest (needs one owner-provided token). Workaround meanwhile: run the ingest by
   hand after uploading.

Either "yes" becomes a `p3` issue and re-enables the dev team. "Neither" closes both proposals
for good.

## Parked, correctly — no action implied

| issue | tier | why it is parked |
|---|---|---|
| #63 | `p2` `needs-human` | Rewrite 48 pre-cutover logs out of public git history. Owner-authorised in principle; destructive and irreversible, so no actor runs it unattended. |
| #17 | `p3` `blocked` `needs-human` | `redlandswifiproject.com` takeover window. **Tripwire latent, seventeenth consecutive reading.** The apex returns 404 on GitHub's "Site not found" page, the `A` records are still 185.199.108–111.153, and there is no challenge TXT. |
| #21 | `p3` `blocked` `needs-human` | Optional GitHub security settings. |
| #1 | tracking | The v1 umbrella. No priority label, so no worker selects it. |

Evidence for "no agent work": `gh issue list --state open --json number,labels,assignees` →
four open issues (#1 `tracking`; #17, #21 `p3 blocked needs-human`; #63 `p2 needs-human`), none
assigned. The reachability sweep over those four found nothing that is reachable but undoable.

## Convergence tripwire

**Not tripped.** Across 36 issues ever filed, 32 are closed and 4 are open, and all 4 are parked.
The open count fell from 5 to 4. No actor is generating its own work. The project has reached
the end state cycle 19 predicted: the hourly worker is off, and this six-hour pass continues as
a watchdog over the nightly ingest and the #17 tripwire.
