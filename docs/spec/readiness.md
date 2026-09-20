# Redlands Wifi Project — release readiness

> Regenerated each product-owner cycle. Cycle 11 · 2026-09-20T13:43Z.

## Burndown: 8 of 9 v1 Release Criteria met

R1–R4 and R6–R8 are met and live, plus the initial-batch criterion. The site is up
(HTTP **200**) serving **18,152** networks fenced to 92373/92374, CI green, 0 open PRs.

**R5 is the only unmet criterion** — "a daily GitHub Actions ingest that commits to `main`
and triggers a Pages redeploy". The workflow exists and is correct, but gates scheduled runs
on `vars.INGEST_SCHEDULE == 'on'`, and that variable is unset (`actions/variables` →
`total_count: 0`), so every scheduled run is skipped. It is deliberately sequenced *behind*
the private-inbox cutover so that new logs never land in the public repo, which makes it
downstream of #30.

## The single blocker: #30, and it is owner-only

Everything below the line is waiting on about ten minutes of owner setup, unchanged for
**eight consecutive cycles (~54 h)**. All four objective existence checks re-run at 13:43Z:

| Check | Result |
|---|---|
| `redlands_wifi_inbox` repo (both spellings) | absent |
| `ingest` entry in `repos/…/environments` | absent (only `github-pages`) |
| `actions/secrets` (`INBOX_TOKEN`) | `0` |
| `actions/variables` (`INGEST_SCHEDULE`) | `0` |

The ask `msg_92a6bc9c` **is answered** — `yes`, with the comment "Rewrite history" — but that
is agreement to the plan, not the completion reply `DONE private-inbox`, and none of the four
artefacts the work depends on exist. Steps are in
[`docs/setup/private-inbox.md`](../setup/private-inbox.md).

**Consequence while it waits:** the constitution's protocol step 4 halts the whole dev-team
routine for any live `waiting` issue, so three unblocked p3s — **#25, #29, #34** — have been
parked since 2026-09-17T15:05Z (~70 h) despite being ordinary repo work no one is blocked on.

## Decisions the owner still holds

1. **#30 — do the private-inbox setup** (~10 min). Unblocks R5, the dev-team routine, and the
   three parked p3s. This is the one that moves the project.
2. **Protocol step 4 amendment** (~1 min, unruled since cycle 3). Proposed: *"skip the blocked
   issue and continue with the next unblocked one; disable the routine only when no unblocked
   p0–p3 issue remains."* Not the PO's to apply — it is a hard invariant and re-enabling a
   routine spends the owner's machine and compute. Moot the moment #30 clears.
3. **#22 — closure decision.** The PO's `addressed-in-#30` proposal is **not auto-close
   eligible** (the named target is an open issue, not a merged PR), so it is routed here rather
   than swept. The exposure it records — raw GPS drive trails, RSSI and out-of-area rows, public
   in `ingest/` *and* in git history — is **still live**. It resolves itself when option C ships.

## Not decisions, for information

- **#17 (domain takeover window)** — owner answered `not-yet`; both escalation rungs are spent
  and the one-shot reminder fired at cycle 9. The automated tripwire ran again at 13:43Z:
  apex **404** with GitHub's own "Site not found" page, apex `A` still in the Pages range,
  challenge TXT still absent — **latent, eighth consecutive run**. If the name is ever claimed,
  a `high` notify fires immediately regardless of the deferral.
- **#21 (owner-only GitHub security settings)** — parked `needs-human`, deliberately queued
  behind #30.
- **Git history rewrite** — owner-approved ("Rewrite history") and fully scoped, but still
  unfiled: §4e budgets new issues against issues actually closed in the same run, and the PO has
  realized zero closes in eleven cycles. Re-derived from the skill source this cycle rather than
  inherited; it also is not a release-criteria gap, so two independent reasons hold it. Safe —
  the authority and scope are recorded in the decision log and on #30 and #22.

## Convergence tripwire

**Open count flat at 8 for eleven consecutive cycles; net issue delta 0; zero realized closes.**
This is not drift — it is a correctly-stalled project. Every remaining item is either owner-only
(#30, #21, #17, #22) or parked by the protocol behind an owner-only item (#25, #29, #34). The PO
has filed no issues and closed none, which is the designed behaviour when the budget is empty and
no gap is workable. The stall breaks the moment #30 clears.

## Process health this cycle

Seventh consecutive clean reachability/doability/staleness sweep, against a *provably* unchanged
corpus (every open issue's `updatedAt` predates the watermark; `search/issues` → `total_count: 0`).
§4h enumeration returned exactly {#22, #30} for a fourth consecutive cycle, neither carrying
`needs-human`.

The cycle's one find was on the PO's own measurement path: two action-gating checks returned
**false positives** because they matched substrings in prose that merely discusses the trigger
phrase — the `closure-objection:` count on #22 came back **2** when the true count is **0** (both
hits were the PO's own explanatory comments), and the halt-or-re-ask sweep flagged #29 on a
Leaflet `moveend` code suggestion. Acting on the first would have stripped #22's closure proposal
and recorded a false veto. The rule added: match on **structure**, exclude the PO's own authorship
from counts of other actors' signals, and read every hit before counting it.
