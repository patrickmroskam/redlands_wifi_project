# Redlands Wifi Project — release readiness

> Regenerated each product-owner cycle. **Cycle 15 · 2026-09-21T13:45Z.**

## Burndown: 10 of 10 v1 Release Criteria met; one post-v1 item (R10 / #65) is in build

v1 is done and unchanged. The owner answered `build` on #65 and asked for per-type map toggles. That is now **PRD R10**, post-v1, and does not gate the v1 DoD. #65 is `p3` and is the only workable issue. Open count: **5** (#1 tracking; #17, #21, #63 `needs-human`; #65 `p3`).

## Standing decision queue (the owner holds all of these)

| # | Decision | Status | Channel |
|---|---|---|---|
| — | Stop the hung 06:04Z dev-team session (`local_7019ef07…`), which pins the routine so #65 cannot start | **new, one action** | notify (cycle 15) |
| — | Correct the R10 reading if "each type of network" meant the security categories, not vehicle/hotspot/printer/… | optional | notify (cycle 15) |
| — | R4.9 wording (publish-then-delete), `awaiting owner ratification` | carried; nothing blocked | none |
| — | #63 git-history rewrite: owner decides when, and is present when it runs | carried | `needs-human` |
| — | #17 custom domain (post-v1 by owner ruling), #21 repo security settings | carried | `needs-human` |

**Left the queue this cycle:** D14 (build or stop #65). Answered `build`.

## Convergence tripwire

**Not tripped.** `net_open_history` is `[8, 11, 10, 5, 5]`, flat.

## Process health

- **Resume check:** one `waiting` issue (#65), resolved on its answered ask. No ask is open now.
- **Closure proposals:** none. **PO net issue delta:** 0 filed.
- **Dev-team routine:** re-enabled, but the hung 06:04Z session still holds the slot (7.5 h silent). If it ever finishes its `enabled=false` call, the next cycle re-enables once.
- **Scheduled ingest:** today's 10:00Z cron has not been delivered yet, which is within this repo's observed 3.7–4.7 h GitHub delay. Cycle 16 verifies it against the data, and none by ~19:30Z means a `high` notify.
- **#17 tripwire:** twelfth consecutive latent reading.
