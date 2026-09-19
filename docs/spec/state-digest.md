---
last_reconciled_at: 2026-09-19T13:38:00Z
cycle: 7
net_open_history: [8, 8, 8, 8, 8, 8, 8]
polish_backlog_depth: 0
---

# Redlands Wifi Project — state digest (PO working memory)

> Regenerable projection. Source of truth: GitHub (state) + decision-log (rationale).
> Cycle 1 was a **full rebuild** (digest absent on first product-owner run): all 23
> issues scanned, no delta watermark applied. Next full rebuild due at cycle 10.

## Cycle 7 delta (watermark 2026-09-19T07:38Z → 13:38Z): **zero owner movement; a staleness trap on the resume path's first pick**

**Nothing moved.** The newest message in the OH HAI inbox is cycle 6's own notify
(`msg_acdced06`, 2026-09-19T07:43:22Z) — the owner has sent nothing since. `main` at `c6fdb88`
(cycle 6's own commit), **0 open PRs**, CI green (last 8 runs all `success`), site HTTP 200 with
18,152 networks. The only issue comment since the watermark is this cycle's own. Open count flat
at **8** for a seventh cycle; net issue delta **0**.

### Both standing gates re-run objectively — both still negative

**#30, all four checks at 13:38Z** (unchanged since cycle 4 — a fourth consecutive negative):

- `gh repo view patrickmroskam/redlands_wifi_inbox` → *Could not resolve to a Repository*
  (the `redlands-wifi-inbox` spelling too)
- `repos/…/environments` → `total_count: 1`, only `github-pages`
- `actions/secrets` → `total_count: 0` — no `INBOX_TOKEN`
- `actions/variables` → `total_count: 0` — no `INGEST_SCHEDULE`

`ask await` on `msg_92a6bc9c` re-read unchanged: `yes` + "Rewrite history". Not the resume key.
`waiting` kept on #30; dev-team routine re-verified **`enabled: false`**, `lastRunAt` still
2026-09-17T15:05:07Z — the three workable p3s have now been parked **~46.5 h**.

**#17 tripwire at 13:38Z:** apex → **404**, body is GitHub's own *"Site not found"* page, apex `A`
→ 185.199.108/109/110/111.153, `_github-pages-challenge-patrickmroskam` TXT → none.
**404 = still unclaimed, latent, no action.** Fire condition not met.

**R5 evidence re-confirmed:** the nightly ingest's last scheduled run (2026-09-18T14:10:34Z)
concluded **`skipped`**, gated on `vars.INGEST_SCHEDULE == 'on'` at `.github/workflows/ingest.yml:28`.
Next firing ~14:10Z today; it will skip again. Setting the variable is still **not** a shortcut to
closing R5 — with the schedule on, the only intake is the **public** `ingest/` folder, the exact
harm #30 exists to prevent.

### Step 4 verified against exact text, not inherited

The reading that has kept the routine off since 2026-09-17T15:05Z was re-grounded in the
constitution's literal wording this cycle rather than carried forward: protocol step 4 reads
*"Disable the dev-team routine … **Do not pick another issue. Exit.**"*, and the resume path ties
re-enabling to the human's `DONE <slug>` reply — not to whether other workable issues exist.
**Cycle 3's correction stands, now verified.** The step-4 amendment remains genuinely the owner's
call; the PO may not apply it (hard invariant, and re-enabling spends the owner's compute).

### The find: #30's own body would send a resuming run back into step 4

#30 is the **first pick** on resume. Two instructions in its body predate the owner's answer:
*"the run that works this issue must write `docs/setup/<slug>.md` and send the ask first"* (done —
PR #37, ask answered) and *"**Not decided — ask the owner, don't assume:** whether to rewrite this
repo's history"* (decided — the reply carried the opt-in phrase "Rewrite history"). Read top-down
and literally, either line produces a doc, an ask, a `waiting` label and a disabled routine — a
third owner interruption about decisions already made.

Fixed **additively**: a status banner marking both items resolved with their evidence, prepended
to the body, with the original text preserved **verbatim** below it (verified byte-for-byte after
the edit). No label changed; the handshake is untouched.

**Confidence is lower than cycles 5–6 and is recorded as such.** #21 and #22 were near-certain —
owner-only issues sitting at the top of a workable tier. Here the later comments already carry the
correct plan, so a careful run would probably have got it right. The banner costs nothing and
removes the ambiguity; it is not a claim that a run *would* have failed. Two consecutive cycles
finding a landmine creates pressure to produce a third, and this one is deliberately not inflated
to match them.

### The sweep rule gains a third question

Cycles 5–6 built the sweep on two questions — can it reach the top of a tier, could an actor do
it? #30 passes **both** and was still a trap. The test adds: **(3) does the issue's own text
instruct an actor to halt or re-ask about something already resolved?** A staleness check,
distinct from doability, biting hardest on whichever issue is next in line — the one whose text
was written earliest relative to the decisions taken since.

### Reachability sweep — full pass over all 8 open issues

| # | labels | reaches top of a tier? | an actor could do it? | text stale? | verdict |
|---|---|---|---|---|---|
| #1 | `tracking` | no — never assigned, dev-team descends to sub-issues | n/a | no | fine |
| #17 | p2 `blocked` `needs-human` | no — `needs-human` excluded from every tier search and claim gate | no (registrar/DNS) | no | parked ✅ |
| #21 | p3 `blocked` `needs-human` | no — same | no (repo settings) | no | parked ✅ |
| #22 | p2 `blocked` `po-closure-proposed` | step-0 disagree strips `po-closure-proposed`; **`blocked` remains** | no (owner decision) | no | cycle-6 fix holds ✅ |
| #25 | p3 | yes | yes — ingest guard, pure repo work | no | workable |
| #29 | p3 | yes | yes — map popup edge cases | no | workable |
| #30 | p2 `waiting` | yes, by design — it *is* the resume work | yes, once setup exists | **YES** | **banner added** ⚠️ |
| #34 | p3 | yes | yes — e2e test split | no | workable |

Reachable-and-undoable set: **empty** (third cycle running). Reachable-and-stale set: **#30, now
banner-corrected**. One ordering check worth recording: #22's `blocked` could in principle be
stripped by the merge-time unblock step if #30 ever merges — but the cycle-10 sweep
(2026-09-20T07:38Z) resolves #22 first, and #30 cannot merge before the owner acts, so the
ordering holds.

**No hard invariant and no protocol step was changed this cycle. No issue filed, none closed, no
label added or removed.**

## Cycle 6 delta (watermark 2026-09-19T01:38Z → 07:38Z): **zero owner movement; a second resume-path landmine found and defused**

**Nothing moved.** The newest message in the OH HAI inbox is cycle 5's own notify
(`msg_25b8e68a`, 2026-09-19T01:46:46Z) — the owner has sent nothing since. `main` at `0164f61`
(cycle 5's own commit), **0 open PRs**, CI green, site HTTP 200. No issue touched since the
watermark except by this cycle. No new workflow run: the nightly ingest next fires ~14:10Z.
Open count flat at **8** for a sixth cycle; net issue delta **0**.

### Both standing gates re-run objectively — both still negative

**#30, all four checks at 07:38Z** (unchanged since cycle 4):

- `gh repo view patrickmroskam/redlands_wifi_inbox` → *Could not resolve to a Repository*
  (the `redlands-wifi-inbox` spelling too)
- `repos/…/environments` → `total_count: 1`, only `github-pages`
- `actions/secrets` → `total_count: 0` — no `INBOX_TOKEN`
- `actions/variables` → `total_count: 0` — no `INGEST_SCHEDULE`

`ask await` on `msg_92a6bc9c` re-read unchanged: `yes` + "Rewrite history". Not the resume key.
`waiting` kept on #30; dev-team routine re-verified **`enabled: false`**, `lastRunAt` still
2026-09-17T15:05:07Z.

**#17 tripwire at 07:38Z:** apex → **404**, body is GitHub's own *"Site not found · GitHub Pages"*
page, apex `A` → 185.199.108/109/110/111.153, `_github-pages-challenge-patrickmroskam` TXT →
none. **404 = still unclaimed, latent, no action.** Fire condition not met.

### The find: #22 was the second landmine, and cycle 5's sweep could not have seen it

Cycle 5 defused #21 and left a standing sweep scoped to *"each open issue with no
`blocked`/`waiting`/`needs-human`/`po-closure-proposed` label"*. That scope assumed
**`po-closure-proposed` is durable parking**. It is not.

The dev-team's step-0 checker duty runs *before* selection, pulls the oldest open closure
proposal — #22 — and on a **disagree** verdict posts `closure-objection:` and **removes
`po-closure-proposed`**. Disagree is the *likely* branch here, not the edge case: the verdict on
file is `addressed-in-#30`, #30 will still be open and unstarted at resume time, and the skill
says in terms that an unverifiable rationale gets an objection rather than a concurrence.

#22 would then be an unlabelled **p2** created 2026-09-17T05:08:48Z — **older than #30**
(09:09:57Z) — so the first pick of the very next run. Its body says in bold that it is a
decision for the owner, not something an agent should act on. Protocol step 4 again: routine
disables itself, owner interrupted a second time, over a decision they made on 2026-09-17
("Go with option C").

Fixed label-only with **`blocked`**, which the tier search excludes independently of
`po-closure-proposed`. Deliberately **not** `needs-human`: that label also suppresses the PO's
closure churn, which would switch off the cycle-10 aging sweep scheduled to resolve #22 — the
same mistake as parking #30, whose `waiting` label is what the resume check enumerates. The
handshake is untouched: window still shuts 2026-09-20T01:42Z, sweep still first eligible at
cycle 10. Post-resume order unchanged: **#30 → #25 → #29 → #34**.

### Open-count accounting

Still **8 open**. Workable-by-an-agent: **#25, #29, #34** (p3, unassigned, unlabelled — bodies
re-read this cycle, all three are pure repo work), parked behind protocol step 4 for ~40.5 h.
Durably parked: **#17, #21** (`needs-human`), **#22** (`blocked` + `po-closure-proposed`).
Owner-gated: **#30** (`waiting`). Tracking parent: **#1**, carries no priority label so it never
enters a tier search.

## Cycle 5 delta (watermark 2026-09-18T19:45Z → 2026-09-19T01:38Z): **no owner movement; one scheduling trap found and defused**

**Nothing the owner controls moved.** No hub reply of any kind since cycle 4's `high` notify
(`msg_a663c534`, 2026-09-18T19:46:21Z). No new comment on any issue since 19:46Z. `main` at
`05463ad` (cycle 4's own commit), **0 open PRs**, CI green, site HTTP 200 / 18,152 networks.
Both asks re-read with `ask await` and both are unchanged: `msg_e812f339` → `not-yet`,
`msg_92a6bc9c` → `yes` + "Rewrite history".

Timing worth recording: the `high` went out at **12:46 PT** and this cycle runs at **18:38 PT**
— a full working afternoon passed with the message in the inbox and nothing moved.

### Both standing gates re-run objectively — both still negative

**#30, all four checks at 01:38Z** (unchanged from cycle 4):

- `gh repo view patrickmroskam/redlands_wifi_inbox` → *Could not resolve to a Repository*
- `repos/…/environments` → `total_count: 1`, only `github-pages`
- `actions/secrets` → `total_count: 0` — no `INBOX_TOKEN`
- `actions/variables` → `total_count: 0` — no `INGEST_SCHEDULE`

**#17 tripwire at 01:39Z:** apex → **404**, `www` → 404, apex `A` → 185.199.108/109/110/111.153,
`_github-pages-challenge-patrickmroskam` TXT → none. **404 = still unclaimed, latent, no action** —
the tripwire's fire condition was not met.

### R5 evidence, now empirical rather than inferred

The scheduled ingest **fired on 2026-09-18T14:10:34Z and came back `skipped`** (as did the
2026-09-17T14:44:46Z run). That is the workflow's `if: github.event_name != 'schedule' ||
vars.INGEST_SCHEDULE == 'on'` gate doing its job with the variable unset. R5 is
**implemented but gated off**, not unbuilt — the cron fires nightly and does nothing.

R4.12 re-spot-checked against the **served** database: record keys are exactly
`auth, bssid, channel, first_seen, lat, lon, ssid` across 18,152 records — no RSSI, altitude or
accuracy. `count` and `updated_at` present (R2.5).

### The find: #21 was a landmine under the resume path

#21 was the **oldest open `p3`** (2026-09-17T05:08:46Z, older than #25, #29 and #34), unassigned,
and carried **no** `blocked` / `waiting` / `needs-human` label — so it was the first issue a
dev-team run would select. But its own body says an agent may not do it (repository settings),
which means the worker's only legal move is the Human-in-the-loop protocol: write the doc, label
`waiting`, send an ask, and **disable the routine**.

So the moment the owner replied `DONE private-inbox`, the routine would have re-enabled, selected
#21, re-disabled itself, and sent a *second* interruption — leaving #25, #29 and #34 parked
exactly as they have been since 2026-09-17T15:05Z. Fixed this cycle, label-only (see the
decision log). Post-resume selection order is now **#30 → #25 → #29 → #34**.

### Open-count accounting

Still **8 open**, unchanged for five cycles. Net issue delta this cycle: **0** — no issue filed,
none closed. Workable-by-an-agent set is now explicit: **#25, #29, #34** (all p3, unassigned,
unlabelled), parked behind protocol step 4 for ~34.5 h. Parked-for-human set: **#17, #21**
(`needs-human`). Owner-gated: **#30** (`waiting`). Pending closure handshake: **#22**.

## Cycle 4 delta (watermark 2026-09-18T13:40Z → 19:45Z): **the owner replied — to both asks**

First owner input since this routine started. Both outstanding asks came back answered,
and the reply values change the state materially:

| ask | issue | value | comment |
|---|---|---|---|
| `msg_e812f339-e53b-46d4-bb67-ce8e5f6edced` | #17 | **`not-yet`** | — |
| `msg_92a6bc9c-dcf7-49bd-81a3-70fd6472d528` | #30 | **`yes`** | **"Rewrite history"** |

Repo state itself is unchanged: `main` at `5dbfbf9` (cycle 3's own commit), **0 open PRs**,
CI green, site HTTP 200, no issue touched since the watermark except by this cycle. The junk
ask `msg_65c5813b` ("probe", cycle 2's self-reported error) is still **open** in the inbox —
the CLI has no withdraw verb, so it can only be dismissed from the owner's side.

### #30 is in the same deadlock #17 was in at cycle 1 — and nobody has told the owner

The gate was re-run objectively at 19:40Z and **all four objects are still absent**:

- `gh repo view patrickmroskam/redlands_wifi_inbox` → *Could not resolve to a Repository*
  (also checked the `redlands-wifi-inbox` spelling, and listed every repo on the account
  matching `inbox|wifi|redlands` — only `redlands_wifi_project` exists)
- `repos/…/environments` → only `github-pages`; no `ingest`
- `gh secret list` → empty, so no `INBOX_TOKEN`
- `gh variable list` → empty, so no `INGEST_SCHEDULE`

So `yes` did **not** mean "I did it" — cycle 2 read that correctly. But the reason it has not
moved in ~22 h is now visible, and it is structural rather than owner inattention:
`docs/setup/private-inbox.md` asks for ~10 minutes of setup across three parts and resumes on
`DONE private-inbox`, while the **ask was posed as a question**. The owner answered the
question — `yes`, plus the doc's opt-in phrase "rewrite history" — which from their side is a
complete, responsive reply. Nothing has ever told them that four objects are still owed.
That is the identical failure cycle 1 diagnosed on #17 ("`waiting` on a reply nobody
requested"), and it is this cycle's single call to action.

### #17: the owner declined, with the facts in front of them

`not-yet` was answered against `docs/setup/domain-takeover.md`, which states plainly that the
domain is already theirs, that the fix is one TXT record, that it takes ~5 minutes, and that
visitors see no change. This is an **informed deferral, not a misunderstanding** — so there is
no framing to correct and nothing to re-ask. The exposure is unchanged and re-verified at
19:39Z (apex `A` → 185.199.108-111.153, `www` CNAME → `patrickmroskam.github.io`, challenge
TXT **absent**, `pages.cname` **null**, `GET https://redlandswifiproject.com/` → **404**), and
`whois` confirms the owner has held the domain at Namecheap since 2025-01-22 (expires
2027-01-22). Risk accepted by the owner; recorded, not overridden. See the tripwire below.

### R5 root cause re-confirmed (no burndown change)

Two scheduled `Ingest wardrive logs` runs now exist — 2026-09-17T14:44Z and 2026-09-18T14:10Z
— and **both were `skipped`**, at the job level, by
`if: github.event_name != 'schedule' || vars.INGEST_SCHEDULE == 'on'`. With zero repo
variables, every scheduled run is a no-op. A firing cron is *not* evidence of a working daily
ingest, and this was nearly miscounted as one. Burndown stays **8/9**; PRD line 100 already
states this gate correctly and needs no edit. R5 unblocks inside #30, which sets the variable.

## Cycle 3 delta (watermark 2026-09-18T07:39Z → 13:40Z): **empty (cycle 2's own writes only)**

The only issues touched since the watermark are #21 (07:43:39Z) and #17 (07:46:36Z) — both
cycle 2's own comments. `main` is at `9bb27d8`, cycle 2's own commit; **0 open PRs**; three
CI runs since the watermark, all green; site HTTP 200. The newest hub message is cycle 2's
own ask `msg_e812f339` (07:46:15Z), so **no owner reply of any kind has arrived** — the #30
ask has now been answered-but-not-actioned for ~22 h, and the #17 ask has been open ~6 h.
Both gates were re-run objectively (see the decision log) and both are still negative.

### Correction carried into this cycle

Cycles 1–2 recorded that the dev-team routine is off because *"there is no workable p0–p3
issue a dev-team run could pick up."* **That is wrong.** Three issues are open, unassigned,
and carry no `waiting` / `blocked` label: **#25** (p3, ingest — don't silently delete an
all-malformed log), **#29** (p3, map popup-pan edge cases), **#34** (p3, split the >1,000-line
e2e spec). None of them depends on #30 or #17. The routine is off because the constitution's
Human-in-the-loop protocol **step 4 requires it** ("Disable the dev-team routine… Do not pick
another issue. Exit.") for as long as any `waiting` issue is live — not because the backlog is
empty. The rule is being obeyed; only the stated reason was wrong. The consequence is real and
is now surfaced as an owner decision: the worker has been halted since 2026-09-17T15:05Z
(~22.5 h) with three shippable issues parked behind two gates that have no ETA.

## Site & map (PRD R1, R2)

- open: 1 (p0:0 p1:0 p2:0 p3:1), launch-blockers: 0, in-flight: 0
- notable: complete and live. **#29 (p3) is workable today and is parked by the protocol, not by a dependency.** Re-verified 2026-09-18 07:40Z: HTTP 200, 18,152 records served, `updated_at` + `count` top-level in the database and rendered at `assets/map.js:278` (**R2.5** ✅). Shipped #2 (scaffold + fenced map), #7 (retro polish + responsive), #11 (canvas renderer for ~18k markers), #12 (security pie), #13 (category list), #20 (footer credit). Only residual is #29 (p3, popup-pan edge cases). Verified live 2026-09-18 01:39Z: HTTP 200, 18,152 networks rendered, legend present, no third-party requests, CSP `default-src 'none'` with `script-src 'self'`.

## Ingest pipeline (PRD R3, R4)

- open: 2 (p0:0 p1:0 p2:1 p3:1), launch-blockers: 0, in-flight: 0
- notable: **#25 (p3) is workable today and is parked by the protocol, not by a dependency.** pipeline complete — #3 (parse/fence/dedupe/append/delete), #15 (canonical BSSID dedupe), #27 (`data/removed.json` denylist), #8 (backfill: +18,152 from 48 logs). 100 unit tests pass locally. `ingest/` holds only `README.md` + `.gitkeep`. **#30 (p2, `waiting`) is the project's single blocking issue** — the private raw-log inbox, owner-only setup; its three-part existence gate was re-run at cycle 2 (07:39Z) and is still **all negative** (no inbox repo, no `ingest` environment, 0 secrets). #25 (p3) is a residual.

## Automation / daily publish (PRD R5)

- open: 0 tracked directly, launch-blockers: 0, in-flight: 0
- notable: **the one unmet v1 Release Criterion.** `.github/workflows/ingest.yml` exists and is correct, but its `schedule` trigger is gated on `vars.INGEST_SCHEDULE == 'on'` and that variable does not exist (`actions/variables` → `total_count: 0`), so every scheduled run is skipped — confirmed in the Actions history ("Ingest wardrive logs" → *skipped*). The workflow comment attributes the flip to #8, which closed without setting it. Cycle 1 gave this last mile an owner by folding it into #30's acceptance (it must follow the inbox cutover so new logs never land in the public repo). Harmless today: `ingest/` is empty, so nothing is queued.

## Privacy & security (PRD R6, R7)

- open: 2 (p0:0 p1:0 p2:1 p3:1), launch-blockers: 0, in-flight: 0
- notable: **R4.12 spot-checked against the live published database at cycle 2** — all 18,152 records carry exactly `bssid, ssid, auth, channel, first_seen, lat, lon`; no RSSI, altitude, accuracy or raw-log field is published. #6 (privacy page) and #14 (security audit — vendored Leaflet, `'self'`-only CSP, injection tests) shipped. #22 carries an **open PO closure proposal** (`addressed-in-#30`): the owner answered option C and the work moved to #30, so the decision issue is spent. #21 (p3) is owner-only GitHub account settings, no ask ever sent.

## Hosting / custom domain (explicitly OUT of v1 scope)

- open: 1 (p0:0 p1:1 p2:0 p3:0), launch-blockers: 0, in-flight: 0
- notable: exposure **independently re-resolved at cycle 2 (07:38Z) and still live** — apex `A` still in the Pages range, `www` still CNAMEd, challenge TXT still absent, apex still 404, `repos/…/pages` → `cname: null`, `protected_domain_state: null`. Priority holds at p1. #17 was raised p2 → **p1** at cycle 1 for a live, independently re-verified security exposure: apex `A` records point at GitHub Pages (185.199.108-111.153) and `www` CNAMEs to `patrickmroskam.github.io`, but there is no `_github-pages-challenge-patrickmroskam` TXT, so the domain is unverified and unclaimed (`GET https://redlandswifiproject.com/` → 404 from Pages) — any GitHub user could claim it. Compounding it, the issue sits `waiting` on a `DONE custom-domain` reply **for which no OH HAI ask was ever sent** (its own 04:14Z comment says so): a silent deadlock. The p1 applies to the mitigation only; the domain switch itself remains out of v1 scope per the ratified PRD.

## Tests / CI (PRD R8)

- open: 1 (p0:0 p1:0 p2:0 p3:1), launch-blockers: 0, in-flight: 0
- notable: **#34 (p3) is workable today and is parked by the protocol, not by a dependency.** #4 shipped CI (Python 3.12 unit tests + Playwright chromium), ~40 s/run, SHA-pinned actions, green on the last 5 runs. #34 (p3) splits the >1,000-line e2e spec.

## Tracking

- #1 — v1 tracking issue, never assigned. Body was corrected at cycle 1 (spec status `draft` → ratified; R5 last mile added as an explicit unticked line); untouched at cycles 2 and 3.

## Closure activity (this period — project to date)

- proposed: 1 (#22, `addressed-in-#30`), closed: 14, contested: 0 — unchanged at cycle 3
- All 14 closes were dev-team ship-and-close, predating the PO. #22 is the first PO maker-checker proposal; its 48 h aging window runs to **2026-09-20T01:42Z**, so it does not close at cycle 3 either (cycle 4, ~2026-09-18T19:38Z, is still inside the window — first eligible pass is cycle 5, ~2026-09-20T07:38Z).
