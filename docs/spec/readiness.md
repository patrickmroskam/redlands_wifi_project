<!-- READINESS-QUEUE -->

# Redlands Wifi Project — release readiness

> Regenerated each product-owner cycle. **Cycle 13 · 2026-09-21T01:44Z.**

## Burndown: 10 of 10 v1 Release Criteria met — v1 is code-complete

**R5 was the last one, and it closed at 01:08Z.** The nightly ingest is live: `INBOX_TOKEN`
authenticates, the **repository** variable `INGEST_SCHEDULE` is `on`, and the `0 10 * * *` cron
(03:00 PT) now executes instead of skipping, as every scheduled run since 09-17 had.

Seven issues closed and six PRs merged in the six hours since cycle 12 — #29, #34, #41, #53, #59,
#61 and, at last, #22. Open count **11 → 9**, then **10** with the one issue this cycle filed.

### Verified independently, not taken from the pipeline's own summary

The run that met R5 reported its own success. The PO re-derived every claim from the published
data and the GitHub API:

| Check | Method | Result |
|---|---|---|
| Fence (R2.2, R4.3) | point-in-polygon against `redlands-boundary.geojson`, holes subtracted | **0 / 22,035** outside 92373/92374 |
| Opt-out (R4.5) | every `ssid`/`name` scanned for `_nomap` / `_optout` | **0** leaks |
| Dedupe (R4.6) | BSSID uniqueness across both databases | **0** duplicates |
| Field withholding (R4.12, R9.3) | key scan for rssi / altitude / accuracy | **none present**; Bluetooth carries no auth or channel |
| Schedule gate | `repos/…/actions/variables` | `INGEST_SCHEDULE=on`, **repository**-scoped |
| Live site | re-fetched from Pages | HTTP 200, 20,386 networks + 1,649 Bluetooth, build `db7da55` |

**The empty-inbox path was executed, not assumed.** The inbox now holds only its README, so
tomorrow's 10:00Z run is the first unattended one *and* the first empty one. Ran locally against
an empty directory: `files processed: 0`, exit **0**, and `publish_ingest.sh` takes its
`nothing changed: no commit` branch. A quiet night is a green no-op, not a red run in the owner's
inbox.

## The one thing the owner holds: close #48

#48 is **resolved** — the token works, the dry run was green, the real run published, the
schedule is on. It stays open only because it carries `launch-blocker`, which the constitution
forbids any actor from auto-closing. Dev-team asked for the close at 01:14Z; this cycle does not
re-ask, and adds no second channel for it.

**Parked `needs-human` this cycle**, and the reason is a gap worth recording: once `waiting` came
off, #48 was an open **p2** with no exclusion label, sitting at the top of the highest workable
tier. The hourly dev-team picks the oldest issue in the highest tier — it would have selected a
finished issue ahead of the five p3s and found nothing it was allowed to do. The old rule
*"never add `needs-human` to #48"* existed to protect the resume sweep watching for the owner's
ask reply; that ask is answered and the work is done, so the rule's reason is spent. Reversal
recorded in the decision log.

## Decisions the owner still holds

1. **Close #48.** One click. Nothing is queued behind it — v1 is already code-complete.
2. **R4.9's re-wording (PRD, `awaiting owner ratification`).** The spec used to promise a log is
   deleted *in the same commit* as the database change it fed. That is impossible across two
   repositories — a consequence of the option C the owner chose, not a new decision. It now reads
   *publish first, then delete*: weaker, but keepable, and a run that dies in between just re-reads
   the logs, which the BSSID dedupe makes a no-op. One-line edit if the owner dislikes the wording.
   **Nothing is blocked on it.** Raised in cycle 12; carried, not escalated.
3. **#63 — the git-history rewrite** (filed this cycle, below). Authority exists in principle; the
   owner decides *when*, and is present when it runs.

## Filed this cycle: #63, the rewrite that had lived only in prose

The carry-note of longest standing is now an issue. Since 2026-09-18 the pre-cutover history
rewrite existed only as prose — in `po-tasks.md`, here, in the PRD's *Known consideration*
section, and in the carve-outs on the #22 and #30 closures. Cycle 12 attached a committed
trigger: file it in the first cycle that realizes a close. #22 closed at 20:05Z, so it is filed:
**#63**, `p2` `needs-human`, post-v1, **does not gate the DoD**.

Measured against the object store rather than asserted: **48** log files, **47 blobs / 4.0 MB**,
touched by exactly **2** commits (`2aa60b0` added 09-16, `cbb849b` deleted 09-17), **0 forks**.
Each row carries the RSSI, altitude, accuracy and timestamp the pipeline drops, plus rows outside
the fence — in time order, the owner's drive route, which is the thing option C was chosen to stop
leaking.

Two caveats are on the issue rather than glossed. A rewrite cannot reach copies already taken, and
GitHub reports **560 clones by 168 uniques in 14 days** — a number *consistent with* this
project's own Actions checkouts (hourly dev-team, nightly ingest, Pages builds all clone from
fresh runners) and **not** evidence of third-party copies; GitHub does not attribute clones, so it
cannot be narrowed further. And after a force-push, unreferenced objects stay reachable by SHA on
github.com until GitHub Support garbage-collects them.

## Not decisions, for information

- **The backlog has no live defect left.** Five workable issues remain, all `p3`, and four are
  latent or near-unreachable **on measured evidence**: `not wifi: 0` across 8,393 rows in the real
  run, and zero `BT` rows in all 48 historical logs, so **#50** (opt-out on a `Type=BT` row) and
  **#55** (all-rows-malformed net) cannot fire on any corpus collected so far; **#42** is
  additionally inert while `flock-rules.json` ships empty; **#45** needs a byte-identical
  `networks.json` — *including* its `updated_at` stamp — pushed by a third party mid-run. Only
  **#57** (nothing enforces `installHooks()`) describes a hazard that can bite today, and it bites
  tests, not users. All stay `p3`; none was closed, because latent is not obsolete and the
  constitution bars closing on a low-ROI verdict without adjudication.
- **The dev-team routine's own prompt had gone stale and was corrected.** It still named #40/#44
  and the p3s #29/#34/#41 as "next workable" — all closed — still described `INGEST_SCHEDULE` as
  unset and the token as rejected, still told the worker to adjudicate a closure proposal on #22,
  which is closed, and still said the PRD has requirements R1–R8, when R9 shipped. A worker reading
  it would have spent a run on a concluded handshake. Rewritten against live state, with the
  ingest paths marked production now that they run unattended nightly.
- **#17 tripwire, tenth consecutive run: latent.** Apex **404** with GitHub's own *Site not found*
  page, apex `A` still 185.199.108/109/110/111.153, `www` CNAME still `patrickmroskam.github.io.`,
  challenge TXT still absent. Fire condition not met; both escalation rungs spent; nothing re-sent.
- **#21** (Dependabot, private vulnerability reporting, SHA-pin enforcement) remains owner-only and
  deliberately deferred behind everything above.

## Convergence tripwire

**Not tripped.** `net_open_tripwire_k` is 3 consecutive rises; the count went **11 → 10** this
cycle (nine closed-out, one filed by the PO). The single rise recorded at cycle 12 is now broken.

The honest risk is the opposite one, and it is the next thing the PO watches: with v1
code-complete, the remaining backlog is five `p3`s, four of them latent. At the hourly cadence
that is roughly five more runs of real work. **When the workable set empties, the question of
whether to keep an hourly worker running on a finished project goes to the owner** — as an ask,
once, not a drip. It is deliberately **not** raised now: the routine shipped six PRs in the last
six hours, so it is not idling, and the question is not yet ripe.

## Process health this cycle

- **Resume check: clean.** No open issue carries `waiting`; all three OH HAI asks
  (`msg_92a6bc9c`, `msg_e812f339`, `msg_f1c95c95`) are `answered`. Nothing to resume, nothing
  re-sent. Verified from the hub, never from the repo.
- **Closure proposals: none open**, and none proposed. The #22 handshake — the project's first —
  concluded with dev-team concurring as checker.
- **PO net issue delta: +1** (#63), against **7** closes realized in the same window. Within §4e.
- **Reachability sweep:** #48 was the one issue that was reachable-and-undoable; parked. The set is
  empty again.
- **Objections ledger:** unchanged, one entry, closed out.
