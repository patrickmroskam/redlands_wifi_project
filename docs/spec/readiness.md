# Redlands Wifi Project — release readiness

**Cycle 10 · 2026-09-20T07:42Z · product-owner · FULL REBUILD**

## Burndown toward v1: **8 / 9** (unchanged for ten cycles)

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

Re-verified live this cycle: site **HTTP 200**, **18,152** networks, R4.12 field set clean
(`bssid, ssid, auth, channel, first_seen, lat, lon` — no RSSI/altitude/accuracy), CI last 3
runs green, `main` at `4c29b04`, **0 open PRs**, `ingest/` holding only `.gitkeep` + `README.md`.

## The one thing blocking everything

**#30 — the private log inbox.** It gates R5 *and* the entire dev-team routine.

The owner **approved** it (ask `msg_92a6bc9c` → `yes`, plus "Rewrite history"). The four objects
the cutover needs still do not exist, re-verified 07:41Z — a **seventh** consecutive cycle unchanged:

- `redlands_wifi_inbox` private repo — absent (both spellings)
- `ingest` environment — absent (only `github-pages`)
- `INBOX_TOKEN` secret — absent (0 secrets)
- `INGEST_SCHEDULE` variable — absent (0 variables)

R5 is implemented but gated off. Every scheduled run this workflow has ever had concluded
**`skipped`** — 2026-09-17T14:44, 2026-09-18T14:10, 2026-09-19T13:43 — gated on
`vars.INGEST_SCHEDULE == 'on'` (`.github/workflows/ingest.yml:28`).

**Setting `INGEST_SCHEDULE=on` is still not a shortcut to closing R5**: with the schedule on, the
only intake is the **public** `ingest/` folder — the exact harm #30 exists to prevent. It is step 4
of `docs/setup/private-inbox.md` and belongs to the owner, *after* the inbox exists.

## What changed this cycle

**The sweep that did not fire.** Cycle 10 was the cycle the old task text would have
self-closed **#22**, the record of a live privacy exposure. Cycle 9's rewrite held. Re-verified
live rather than inherited: `addressed-in-#NNN` requires a **merged PR**, `/pulls/30` returns
**404**, #30 is an open issue, and none of the 15 merged PRs ships option C. The verdict is
**ineligible**, so the clean 48 h aging window never gets to apply. #22 is **routed to you as a
closure decision**, with `po-closure-proposed` kept so it stays in dev-team's adjudication queue.

**#17 split, at zero net issue delta.** Queued since cycle 1 and deferred six times — five of
them on a rationale cycle 9 proved had been false since cycle 4. #17 is now retitled to the
**takeover mitigation alone**; the custom-domain *switch* is deliberately tracked by no issue,
because the ratified PRD puts it Out of Scope (v1) and you answered `not-yet`. Priority
deliberately left at `p2`, not raised — see *Decisions* below.

**Digest full rebuild** (the constant fires every 10 cycles). Rollups re-derived from live state;
three inherited-stale lines corrected and named, including a Closure-activity section frozen
since cycle 3 that still predicted an eligibility date that was never reachable.

## Parked for the human (`needs-human`: 2)

- **#17** (p2) — the domain takeover window. Tripwire **latent for a seventh cycle**: apex 404 on GitHub's own "Site not found" page, `A` records still 185.199.108–111.153, challenge TXT still absent, `pages.cname` still `null`. Unverified and unclaimed — **nobody has taken it.** Two ~5-minute exits in `docs/setup/domain-takeover.md`. Escalation **retired**: one `high` at cycle 4, one dated reminder at cycle 9, and no further timer.
- **#21** (p3) — GitHub account security settings (Dependabot alerts, private vulnerability reporting, SHA-pinning). Deliberately behind the p2 queue; no ask sent, so it does not compete with #30.

## Still waiting on the owner

- **#30** (p2, `waiting`) — resume phrase **`DONE private-inbox`**. Never arrived.
- **#22** (p2, `blocked`, `po-closure-proposed`) — **needs your closure decision** (see Decisions).

## Routine status

- `autonomy-dev-team-redlands-wifi-project` — **disabled** since 2026-09-17T15:05:07Z (**~64.6 h**), by the constitution's Human-in-the-loop protocol step 4, because #30 is `waiting`.
- `autonomy-product-owner-redlands-wifi-project` — enabled, 6-hourly. This is cycle 10.
- **#25, #29, #34** (all p3) are workable *today* — unblocked, unassigned, pure repo work — and are parked only because step 4 halts the whole routine for one blocked issue. The step-4 amendment proposal (skip the blocked issue rather than disable the routine) remains unruled; it is a hard invariant and not the PO's to apply.

## Sweeps

- **§4h blocked queue** → exactly **{#22, #30}**, neither carrying `needs-human`. **No regression** (third consecutive clean check). Both branch (b) with named paths.
- **Reachability / doability / staleness** → all 8 issues, both sets **empty**. **Sixth consecutive clean**, and this time provable: `search/issues?…updated:>=2026-09-20T01:45:00Z` → `total_count: 0`.

## Convergence

- Open count **flat at 8 for ten cycles**; net delta 0; `net_open_tripwire_k: 3` **not tripped** (it fires on a *rise*).
- **Realized closures: 0 — across all ten cycles.** Last close was #27 on 2026-09-17T14:29:43Z, by dev-team, before the PO existed.
- This is the backlog's one structural dependency, and it is worth naming plainly: §4e budgets *filing* against realized closes, so with zero closes the PO may file no new gap issues. The owner-approved **git history rewrite** is queued behind exactly that — not behind judgement or authority, only behind a close that cannot happen while every closable issue waits on the owner.
- **The project is one ~10-minute owner action away from moving, and has been for ~64.6 h.**

## Decisions the owner must make

1. **#30 — do the private-inbox setup** (`docs/setup/private-inbox.md`, ~10 min), then reply **`DONE private-inbox`**. This alone re-enables the dev-team routine, unparks #25/#29/#34, and puts R5 — the last v1 criterion — in reach.
2. **#22 — closure decision.** The PO cannot close it: the verdict names #30, and #30 has not shipped. Options: leave it open as the live record (default, and what routing it to you preserves), or close it as "decision made, work tracked in #30" if you consider the *decision* spent even though the *exposure* is not.

## Not owed this cycle

- **The git history rewrite filing** — blocked on any realized close, no date attached. Authority exists ("Rewrite history"); it is recorded in three places and is not at risk of being lost. It must get its own issue and its own review, never a ride inside #30's cutover — it is destructive and irreversible on a public repo, and anyone who already cloned keeps their copy.
