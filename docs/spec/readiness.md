# Redlands Wifi Project — release readiness

> Regenerated each product-owner cycle. **Cycle 17 · 2026-09-22T14:50Z.**

## Burndown: 10 of 10 v1 Release Criteria met; one post-v1 item (R10 / #65) is queued for build

v1 is done and unchanged. #65 (PRD R10: per-kind classification plus main-map toggles) is `p3` and is the only workable issue. It has still not started. The owner said `build` ~25 h ago, but the dev-team routine was effectively off the whole time (see Process health). Open count: **5** (#1 tracking; #17, #21, #63 `needs-human`; #65 `p3`).

## Standing decision queue (the owner holds all of these)

| # | Decision | Status | Channel |
|---|---|---|---|
| — | Correct the R10 reading if "each type of network" meant the security categories, not vehicle/hotspot/printer/… | optional, carried | notify (cycle 15) |
| — | R4.9 wording (publish-then-delete), `awaiting owner ratification` | carried; nothing blocked | none |
| — | #63 git-history rewrite: owner decides when, and is present when it runs | carried | `needs-human` |
| — | #17 custom domain (post-v1 by owner ruling), #21 repo security settings | carried | `needs-human` |

## Convergence tripwire

**Not tripped.** `net_open_history` is `[11, 10, 5, 5, 5, 5]`, flat. It is flat because no worker has run, not because of churn.

## Process health

- **Resume check:** no `waiting` issue is open, and no ask is open.
- **Closure proposals:** none. **PO net issue delta:** 0 filed.
- **Cycle 16 hung for ~19 h.** It started 19:40Z and its queued writes all landed at 14:46–14:48Z today: the dev-team re-enable, commit `f20bde6`, and notify `msg_6d546ac8…`. The dev-team routine has been enabled since ~14:46Z, not 19:45Z. Its last fire was 2026-09-21T06:04Z, and the next is due 15:10Z. The PO also missed its 01:30Z, 07:30Z and 13:30Z slots. This is the second scheduled session in ~33 h to stall and then resume near the owner's morning; the latest resumed within ~60 s of a screen-sharing session waking the display (hypothesis, medium confidence).
- **Scheduled ingest:** run `35740280107` succeeded, created 14:26Z (4.4 h late). 0 files, no commit.
- **#17 tripwire:** fourteenth consecutive latent reading.
