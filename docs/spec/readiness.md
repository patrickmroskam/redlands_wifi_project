# Redlands Wifi Project — release readiness

*Cycle 19 · 2026-09-23T01:55Z · PRD `ratified` · constitution in force*

## Burndown: v1 is 10/10 done

All ten Release Criteria in the PRD's Definition of Done are met and have been since
2026-09-21 (R5, issue #61). **Nothing in v1 is outstanding.** Everything below is post-v1
or housekeeping.

## Live state, verified against the published data

| dataset | records | as of |
|---|---|---|
| `data/networks.json` | **23,597** | 2026-09-22T19:41:56Z |
| `data/bluetooth.json` | **3,404** | 2026-09-22T19:41:56Z |
| `data/flock.json` | **1** | 2026-09-22T22:11:17Z |

Checked by fetching the published JSON from GitHub Pages, per the standing rule to verify a
publish against the data rather than the job summary.

## What moved this cycle

- **The first Flock camera is on the map.** The owner drove a live session on 2026-09-22
  (19:40Z–22:16Z), confirmed the device, and authorised the publish ("publish it", 22:07:25Z).
  `f0:82:c0:c1:fd:55` shipped in **#70**; **#71** corrected `flock.html`, which still told
  visitors no rule had been confirmed. R9.4 and R9.5 now hold on real data.
- **The rule is one full MAC, on purpose.** A vendor prefix would have marked a resident's
  Ring doorbell as a surveillance camera — the firmware's own Flock OUI list contains the USI
  prefix that doorbell uses. See the R9.4 amendment proposal below.
- **No issue opened, closed or reopened.** Open count holds at 5.

## The one blocker: #65 cannot move, and only the owner can clear it

The dev-team worker that claimed **#65** (R10 — network kinds and per-kind map toggles) froze
at 2026-09-22T15:16:41Z and has been wedged ever since. As of this report it is **10 h 32 m**
old, still reading `running`, with its process alive.

Because the scheduler treats a `running` run as occupying the slot, **ten hourly fires have
been skipped** (16:10 → 01:10) and one more will be lost every hour. #65 is the only workable
issue in the backlog, so the dev-team routine is effectively stopped.

**This is now called permanent, not slow.** Two independent facts rule out it thawing on its
own: the owner was active at 19:41Z, and then ran a five-hour interactive session on the same
machine while this one stayed frozen at its 15:16:41Z mark.

**The fix is to quit and reopen the Claude app.** The cost is about three minutes of uncommitted
work in a scratch worktree, which the next run redoes from scratch. The site, the data and the
git history are untouched by this.

*Why this is escalated now and was not before:* cycle 18 asked at `normal` (19:48Z). At 22:07Z
the owner was mid-publish in their own live session — **a relaunch would have killed it**, so not
relaunching was correct, and that notify never said so. That session ended at 22:16Z. No owner
work is in flight now, which is what makes this a clean moment.

## Decisions the owner needs to make

1. **Relaunch the app** — an action, not a decision, but it is the only thing unblocking #65.
2. **R9.4 amendment (optional, post-v1).** Write the full-MAC rule into the spec: *every Flock
   rule SHALL be a full six-octet address, never a vendor prefix.* It is already how the shipped
   rule works and why, but it currently lives only in a JSON comment and a web page — neither of
   which an actor must read, so a future rule could widen to an OUI and publish a neighbour's
   doorbell. Marked *awaiting owner ratification* in the PRD. Declining is fine; it stays where
   it is.
3. **"Each type of network" (standing, optional).** R10 reads this as the *kind* axis — vehicle /
   phone hotspot / printer / default-looking / hidden / named. If the security types
   (open / WEP / WPA) were meant, say so before #65 ships.

## Parked, correctly — no action implied

| issue | tier | why it is parked |
|---|---|---|
| #63 | `p2` `needs-human` | Rewrite 48 pre-cutover logs out of public git history. Owner-authorised in principle; destructive and irreversible, so no actor runs it unattended. |
| #17 | `p3` `blocked` `needs-human` | `redlandswifiproject.com` takeover window. **Tripwire latent, sixteenth consecutive reading** — apex 404 on GitHub's "Site not found", `A` records unchanged, no challenge TXT. |
| #21 | `p3` `blocked` `needs-human` | Optional GitHub security settings (Dependabot alerts, private vulnerability reporting). |
| #1 | tracking | The v1 umbrella. No priority label, so no worker selects it. |

Reachability sweep run on all five open issues: the reachable-but-undoable set is **empty**.
No labels changed, no priorities changed.

## Convergence tripwire

**Not tripped.** v1 is complete, the backlog is not growing (open count flat at 5 for seven
cycles), and no actor is generating work for itself. The one incomplete item, #65, is blocked on
a host-level fault rather than on scope. The correct end state for this project remains: #65
ships, the hourly routine disables itself per its task-file rule, and the PO pass continues at
its six-hour cadence as a watchdog over the nightly ingest.
