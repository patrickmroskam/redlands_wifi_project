<!-- READINESS-QUEUE -->

# Redlands Wifi Project — release readiness

> Regenerated each product-owner cycle. **Cycle 12 · 2026-09-20T19:44Z.**

## Burndown: 9 of 10 v1 Release Criteria met

R9 (Bluetooth + Flock maps) was ticked this cycle with PR #39, and R3/R4/R7 were re-worded by
PR #51 to describe the private inbox that actually runs. The site is up (HTTP **200**) serving
**18,152** networks fenced to 92373/92374, CI green, **0 open PRs**.

**R5 is the only unmet criterion** — "a daily GitHub Actions ingest that commits to `main` and
triggers a Pages redeploy."

## The single blocker: #48 — and it is now one action, not ten minutes of setup

**The owner did the #30 setup today** (inbox repo 16:08:22Z, `INBOX_TOKEN` 16:16:57Z) and the
cutover shipped. Every precondition for R5 is now in place except one:

| Precondition | State |
|---|---|
| `redlands_wifi_inbox` exists, private, default `main` | ✅ |
| Inbox holds real work (`wardrive_0.log`) | ✅ |
| `ingest` environment exists, branch policy exactly `main` | ✅ |
| `INBOX_TOKEN` present | ✅ |
| **`INBOX_TOKEN` authenticates** | ❌ **404** — run `35527858730`, 18:04Z |
| `INGEST_SCHEDULE` set | unset **by design** — and it is **bot** work, not an owner step |

The failure is isolated to the token's **repository scope** — most likely the "Repository access"
dropdown left on *Public repositories* while the inbox is private. Steps are in
[`docs/setup/inbox-token-fix.md`](../setup/inbox-token-fix.md); ask
`msg_f1c95c95-117b-4f4d-9fe0-a1f7e19674ed` is **open** and was **not re-sent** this cycle.

**Nothing else is queued behind it.** Once the token works, a bot run tests the pipeline and sets
`INGEST_SCHEDULE=on` itself. **v1 is one owner action away.**

## Decisions the owner still holds

1. **#48 — make a new fine-grained token scoped to `redlands_wifi_inbox`** (~5 min). This is the
   whole project. It unblocks R5, the last unmet Release Criterion.
2. **R4.9 — ratify a weakened-but-keepable promise** (~1 min, **nothing is blocked on it**). The
   spec used to promise a processed log is deleted *in the same commit* as the database it fed.
   That is impossible now that logs live in a separate repository — a consequence of the option C
   already chosen, not a new decision. PR #51 replaced it with what the code does: **publish the
   map data first, then delete the logs.** If a run dies in between, the logs are simply read
   again next time, with no duplicates. The spec says in-line that this line awaits ratification.
   A one-line edit if the wording is wrong.

## Not decisions, for information

- **#22 has left this queue.** It was routed here for three cycles because its closure verdict
  (`addressed-in-#30`) named an open issue and could never execute. Dev-team objected formally at
  16:05Z, the verdict was **withdrawn**, and cycle 12 re-proposed `addressed-in-#43` against the
  now-**merged** PR. It is an ordinary maker-checker exchange again — the checker decides at the
  next dev-team run, not the owner. Window shuts **2026-09-22T19:40Z**.
- **The raw-log exposure is stopped going forward, not remediated.** Since PR #43 new logs go to
  the private inbox. The **48 pre-cutover logs remain in this repo's public git history** and in
  every clone taken before today.
- **Git history rewrite — owner-authorized and still UNFILED.** The owner replied *"Rewrite
  history"* (`msg_92a6bc9c`). It is **not tracked by any issue**, stated plainly because saying
  otherwise would be false. It is held by §4e's rule that new issues are budgeted against issues
  actually closed in the same run, and the PO has realized zero closes in 12 cycles. **Cycle 12
  attached a committed trigger:** it gets filed in the first cycle that realizes a close —
  plausibly cycle 13–14, via #22. No agent will run the purge unattended; the owner re-confirms
  in-session.
- **#17 (domain takeover window)** — owner answered `not-yet`; both escalation rungs spent. The
  tripwire ran again at 19:3xZ: apex **404** with GitHub's own "Site not found" page, apex `A`
  still in the Pages range, challenge TXT still absent — **latent, ninth consecutive run.** If the
  name is ever claimed, a `high` notify fires immediately regardless of the deferral.
- **#21 (owner-only GitHub security settings)** — parked `needs-human`, deliberately queued behind
  #48. A competing ask lowers the odds of the one that matters.

## Convergence tripwire

`net_open_history: [8, 8, 8, 11]` — **first rise after eleven flat cycles.** `k=3`, so **not
tripped**, and the rise is healthy: **4 issues closed, 5 filed**, every filed item a defect found
by review of code that shipped the same day. **The PO filed 0.**

Three of the five new residuals were verified **latent by measurement, not assumption**: all 48
historical wardrive logs were replayed out of git history — **40,228 rows, 100% `Type=WIFI`,
zero `BT`, zero `BLE`** — so #50 (opt-out lost on a classic-Bluetooth row) and #42 (BLE→Flock
record shape) cannot fire on any corpus this project has ingested. Both stay p3 on evidence. The
caveat is recorded: the rig **can** emit BLE rows if a BLE scan is run, so this is latent-today,
not latent-forever.

## Process health this cycle

**The project's first real maker-checker exchange worked**, and it exposed a gap worth naming: the
objection arrived with `po-closure-proposed` still attached, so it never entered the labeled aging
sweep — it was caught only by the delta comment scan. Had it been missed, the next run would have
re-proposed a verdict that had already been formally rejected. It is now the first entry in
`docs/spec/objections.md`, which had been empty since bootstrap.

The cycle's other find was in the PO's own instruments, for the fourth cycle running: for eight
cycles this report read "zero owner movement" from the OH HAI hub, while **the owner had in fact
cleared the blocking dependency without replying to anything.** The four defects share one shape —
*the check drifted from the thing it was meant to check.* Standing rule added: never conclude
owner inaction from the reply channel alone; check the objective state of the blocking item.
