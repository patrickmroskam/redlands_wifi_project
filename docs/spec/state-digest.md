---
last_reconciled_at: 2026-09-21T13:45:00Z
cycle: 15
net_open_history: [8, 11, 10, 5, 5]
polish_backlog_depth: 0
last_full_rebuild_cycle: 10
next_full_rebuild_cycle: 20
---

# Redlands Wifi Project — state digest (PO working memory)

> Regenerable projection. Source of truth: GitHub (state) + decision-log (rationale).
> Cycle 1 was a **full rebuild** (digest absent on first product-owner run): all 23
> issues scanned, no delta watermark applied. **Cycle 10 was the second full rebuild**
> (`digest_full_rebuild_every_cycles: 10`): rollups re-derived from live state, not carried
> forward. Next full rebuild due at cycle 20.

## Cycle 15 delta (watermark 2026-09-21T07:44Z → 13:45Z): **the owner said `build`, so #65 is the workable set**

**No issue opened, closed or reopened.** Open count holds at **5**: #1 (tracking), #17, #21, #63 (`needs-human`) and #65, which is now `p3`.

- **Ask `msg_7929ff83` answered `build`,** with the comment "Add the filters so it can be toggled on and off for each type of network". #65 lost `waiting` and `needs-triage` and gained `p3`. **PRD R10** (post-v1) was added: kinds, a breakdown split, and a per-kind toggle on the main map, with no data or ingest change. The dev-team routine was re-enabled with a rewritten brief.
- **Dev-team slot is still pinned** by the hung 06:04Z session (`running`, silent since 06:10:24Z), so no fire since. Reported to the owner; the PO did not kill it.
- **Scheduled ingest:** no `schedule` run yet today at 13:4xZ. That is inside this repo's measured GitHub delay: every earlier scheduled run was created at 13:43–14:44Z for a 10:00Z cron. `INGEST_SCHEDULE=on` is a repository variable and the workflow is `active`. Cycle 16 verifies.
- **#17 tripwire, twelfth consecutive run:** latent. 404, apex `A` 185.199.108–111.153, `www` CNAME `patrickmroskam.github.io.`, no challenge TXT.

## Cycle 14 delta (watermark 2026-09-21T01:44Z → 07:44Z): **the backlog is empty — the one remaining question is the owner's**

**Six issues closed and none reopened.** #48 was closed at 01:53Z on the owner's chat instruction. The dev-team then shipped every leftover `p3`: #42 (PR #64 `c6a19be`), #45 (PR #66 `dcc736d`), #50 (PR #67 `f6645e0`), #55 (PR #68 `5147435`) and #57 (PR #69 `c4783f3`, merged 06:10Z, CI green). One issue was filed: #65, by the owner's request via dev-team at 02:43Z. Open count went **10 → 5**: #1 (tracking), #17, #21, #63 (all `needs-human`) and #65.

### Workable set: empty

No open issue carries p0–p3 without `needs-human`/`blocked`/`waiting`. That fires the committed trigger carried since cycle 13: take the post-v1 routine question to the owner as **one** ask.

### #65 triaged to the owner, not to dev-team

#65 (stats "kind" split: Vehicle / Phone-hotspot / Wi-Fi Direct / Default-looking / Named) is well specified, but it is **outside the ratified PRD**. It gets no priority label and is labelled `waiting` on OH HAI ask `msg_7929ff83-3b6c-4eef-b80b-18f0faa26190` (select `build`/`stop`, key `redlands-po-D14-post-v1-issue-65`). This one ask also carries the routine question, so a single decision covers both.

### The dev-team routine is standing down on its own rule, and the session that did it hung

The 06:04Z dev-team session merged #57, found no remaining workable issue, and called `update_scheduled_task enabled=false`, which is its task file's owner-ruled rule. That call never returned. The session has shown `running` since 06:10:24Z. The routine still reports `enabled: true`, but the live session blocks new fires, so 07:04Z did not run. It also skipped its notify and its #1 reconcile; the PO ticked #57 on #1 this cycle. **The PO did not complete the disable.** Its task file only authorises re-enabling. The worker's next run applies the rule again, and the stuck session is the memory watchdog's to count.

### #17 tripwire, eleventh consecutive run: latent

The apex returns 404 with GitHub's *Site not found* page. The apex `A` records are still 185.199.108–111.153. The `www` CNAME is still `patrickmroskam.github.io.` and the challenge TXT is still absent.

### Ingest

Unchanged since the R5 run. The first unattended scheduled run is 10:00Z today; the next PO cycle verifies it against the data.

## Cycle 13 delta (watermark 2026-09-20T19:44Z → 2026-09-21T01:44Z): **v1 is code-complete — R5 met, and the last prose-only carry-note became an issue**

The largest six hours in the project's history. **Seven issues closed** — #29 (PR #52), #34
(PR #56), #41 (PR #58), #53 (PR #54), #59 (PR #60), #61 (PR #62) and **#22** — against **six
merged PRs**, plus the ingest's own data commit `f81a645`. Open count **11 → 9**, then **10**
with #63 filed here. `net_open_tripwire_k` is 3; the single rise recorded at cycle 12 is broken.

### R5 is met, and the PO re-derived it rather than accepting the run's own report

`INBOX_TOKEN` authenticates, and the **repository** variable `INGEST_SCHEDULE` is `on`, so the
`0 10 * * *` cron runs instead of skipping. Run
[35549848194](https://github.com/patrickmroskam/redlands_wifi_project/actions/runs/35549848194)
read 8,393 rows from 2 inbox logs and published 3,883 (+2,234 networks → 20,386; +1,649 Bluetooth
→ 1,649, the Bluetooth map's first data), pushed `f81a645`, deleted the processed logs.

Independently verified this cycle, from the published databases and the API, **not** the job
summary: **0 / 22,035** records outside the 92373/92374 polygons by point-in-polygon with holes
subtracted; **0** `_nomap`/`_optout` leaks; **0** duplicate BSSIDs in either database; no
rssi/altitude/accuracy key on any record and no auth/channel on a Bluetooth record (R4.12, R9.3);
`INGEST_SCHEDULE=on` confirmed **repository**-scoped at `repos/…/actions/variables`; Pages build
`db7da55`; live site HTTP 200 serving 20,386 + 1,649 with `updated_at` 2026-09-21T01:07:41Z.

**The unattended path was executed, not assumed.** The inbox now holds only its README, so the
10:00Z run tomorrow is both the first unattended run and the first empty one. `scripts/ingest.py`
against an empty directory: `files processed: 0`, exit **0**; `publish_ingest.sh` then takes its
`nothing changed: no commit` branch (line 125). A quiet night is a green no-op.

### #48: reachable-and-undoable, and the label rule that had to be reversed to park it

With `waiting` removed, #48 became an open **p2** carrying no exclusion label — the top of the
highest workable tier. The dev-team selects the oldest issue in the highest tier, so it would have
picked a **finished** issue ahead of the five p3s and found nothing it was permitted to do
(`launch-blocker` bars any actor from closing it). Parked `needs-human`.

That required reversing a standing rule the PO itself wrote into the dev-team prompt: *"never add
`needs-human` to #22 or #48."* Its reason was that the label would switch off the resume sweep
watching for the owner's ask reply. **That reason is spent** — `msg_f1c95c95` is answered and the
work is done. No machinery is disabled either way: the resume check enumerates `waiting`, and the
§4h check reads `blocked`/`waiting`; #48 carries neither. Recorded as a reversal, not a silent
edit, on the issue and in the decision log.

### #63 filed — the committed trigger from cycle 12 fired

The history rewrite had existed only as prose since 2026-09-18 (`po-tasks.md`, `readiness.md`,
the PRD's *Known consideration* section, the #22 and #30 closure carve-outs). Cycle 12's trigger
was "file it in the first cycle that realizes a close"; #22 closed at 20:05:34Z. Filed as **#63**,
`p2` `needs-human`, **post-v1, does not gate the DoD**, and added to #1 under an explicit post-v1
heading so it cannot be mistaken for burndown.

Grounded in the object store, not asserted: **48** log files, **47 blobs / 4.0 MB**, exactly **2**
commits touch them (`2aa60b0` added, `cbb849b` deleted), **0 forks**. Caveats recorded rather than
glossed: 560 clones / 168 uniques in 14 days — *consistent with* this project's own Actions
checkouts and **not** evidence of third-party copies, and unattributable by GitHub — and
force-pushed objects staying SHA-reachable until GitHub Support GCs them.

### The dev-team's own prompt had drifted out of true

Found while checking build order. `SKILL.md` still named #40/#44 and p3s #29/#34/#41 as "next
workable" (all closed), still said `INGEST_SCHEDULE` was unset and the token rejected (both
false), still carried a paragraph instructing the worker to adjudicate the `po-closure-proposed`
on #22 (closed), and still described the PRD as R1–R8 (R9 shipped 09-20). A worker reading it
would have spent a run re-opening a concluded handshake. Rewritten against live state; the ingest
paths are now flagged as production, since they run unattended against the owner's real data
nightly. Registered `description` updated to match. **The routine's prompt is PO-maintained
state and ages like any other — check it every cycle the backlog turns over.**

### Rollups

| | |
|---|---|
| Open issues | **10** — #1 (tracking), #17, #21, #42, #45, #48, #50, #55, #57, #63 |
| Workable (oldest-first, all `p3`) | #42, #45, #50, #55, #57 |
| Parked | #48, #63 (`needs-human`), #17, #21 (`blocked` + `needs-human`) |
| Open PRs | **0** |
| v1 Release Criteria | **10 / 10** |
| Closure proposals open | **0** |
| Objections ledger | 1 entry, closed out |

**Four of the five workable issues are latent or near-unreachable on measured evidence** —
`not wifi: 0` across 8,393 real rows and zero `BT` rows in all 48 historical logs make #50 and #55
unfireable on any corpus collected so far; #42 is additionally inert while `flock-rules.json` is
empty; #45 needs a byte-identical `networks.json`, `updated_at` stamp included, pushed by a third
party mid-run. Only **#57** describes a hazard live today, and it bites tests, not users. None was
closed: latent is not obsolete, and the constitution bars a low-ROI close without adjudication.

### #17 tripwire — tenth consecutive run, latent

01:40Z: apex **404** with GitHub's own *Site not found · GitHub Pages* body, apex `A` →
185.199.108/109/110/111.153, `www` CNAME → `patrickmroskam.github.io.`, challenge TXT **absent**.
Fire condition not met; both rungs spent; nothing re-sent.

## Cycle 12 delta (watermark 2026-09-20T13:43Z → 19:44Z): **the drought broke — four issues shipped, five residuals filed, and the objection ledger caught its first entry**

**Eleven flat cycles ended.** Between 13:43Z and 19:44Z the dev-team merged **five PRs** and closed
**four issues** — #25 (`45847bb`), #30 (**PR #43**, `be05d65`, + fix PR #46 `e621c25`), #40 (PR #49,
`6662031`), #44 (PR #51, `b40acbc`) — and filed **five residuals**: #41, #42, #45, #48, #50.
Net open **8 → 11**. This is the **first rise in 11 cycles**; `net_open_tripwire_k` is 3, so one rise
does not trip it. All five residuals are dev-team/review inflow, which the PO does not control; the
PO's own net contribution this cycle is **0 filed**.

### The owner moved, and it was not visible in the ask thread

The standing read of this project for eight cycles was "zero owner movement." **That is no longer
true, and the hub did not say so.** The owner created the private inbox repo at **16:08:22Z** and
the `INBOX_TOKEN` secret at **16:16:57Z** — both verified by API this cycle, neither announced. The
cutover then shipped. Reading only `oh-hai messages list` would have reported another silent cycle.
**Owner action is observable in repo state, not only in the reply channel; check both.**

### #22: the first real maker-checker exchange in the project's history

- **Objection recorded (first ever).** Dev-team posted a structured `closure-objection:` at
  **16:05:13Z** — `addressed-in-#30` names an *open issue*, not a merged PR. It surfaced through the
  §3 delta comment scan, **not** the labeled aging sweep (the label was never removed), which is
  exactly the §4d path that would otherwise drop it. Appended to `docs/spec/objections.md`; the
  ledger is no longer empty.
- **Re-proposed on new evidence, not re-asserted.** The objection named its own unblocking
  condition — a merged PR shipping option C. PR **#43 is merged** (`merged: true`,
  `be05d65`; verified by API, not inferred from git log). Cycle 12 withdrew `addressed-in-#30` and
  posted `addressed-in-#43` (`issuecomment-5752198606`), with both carve-outs the checker asked for
  stated in the proposal: the public git history is **not** remediated, and the pipeline is **not**
  live. A fresh 48 h window opens 2026-09-20T19:40Z.
- **The cross-reference trap was not repeated.** The proposal says the history rewrite is
  *owner-authorized and unfiled*. It does **not** say "tracked as its own issue" — that claim would
  have been false, and a near-identical false cross-reference was caught in review on PR #51 earlier
  today. A closure rationale is a factual claim; an unfiled item must be described as unfiled.

### #50 and #42 are latent — measured, not assumed

Dev-team filed #50 (`_nomap` opt-out lost on classic-`BT` rows) at p3 with the hedge *"may be inert
if the scanner never writes those rows."* That hedge is now **resolved against real data**: all
**48** historical wardrive logs were replayed out of git history (`0c10f06^`) and every one of
**40,228** data rows carries `Type=WIFI`. Zero `BT`, **zero `BLE`**. So #50 cannot fire on any corpus
this project has ingested, and #42 (BLE→Flock record shape) is **doubly** latent — empty
`flock-rules.json` *and* no BLE rows. Both stay **p3**, now on evidence.
*Caveat kept honest:* the rig is an ESP32 Marauder, whose firmware can emit BLE rows if the owner
runs a BLE scan. Latent today ≠ impossible. Re-measure when a new log arrives.

### #48 is the whole project — and the fix is one owner action, fully pre-verified

Every other precondition for R5 was checked this cycle and is **already correct**:

| Precondition | State |
|---|---|
| `redlands_wifi_inbox` exists, private, default `main` | ✅ created 16:08:22Z |
| Inbox holds real work | ✅ `README.md`, `wardrive_0.log` |
| `ingest` environment exists | ✅ |
| Environment branch policy | ✅ `custom_branch_policies`, exactly `main` |
| `INBOX_TOKEN` present | ✅ created 16:16:57Z |
| `INBOX_TOKEN` **works** | ❌ **404** — run `35527858730`, step *Check out the private inbox*, 18:04Z |
| `INGEST_SCHEDULE` | unset **by design**; repo `actions/variables` → `total_count: 0` |

So the failure is isolated to the token's repository scope, precisely as the ask describes, and
**nothing else is waiting behind it**. `INGEST_SCHEDULE` is a *bot* action (the `gh` token carries
`repo`), not a second owner step. **#48 labelled `launch-blocker` this cycle** — it is the sole
remaining path to the only unmet Release Criterion.

### #17 tripwire — ninth consecutive run, latent

19:3xZ: apex → **404** with GitHub's own *"Site not found"* body, apex `A` → 185.199.108/109/110/111.153,
`www` CNAME → `patrickmroskam.github.io.`, challenge TXT → **absent**, `pages.cname` → `null`. Fire
condition not met; both escalation rungs remain spent; no reminder re-sent.

### Corrections to this digest's own rollups

- **#17 was recorded as `p2`. It is `p3` live** — moved by the owner-ruling commit `08522d1`
  (custom domain deferred post-v1). The cycle-10 rebuild text asserting "kept p2" was already stale
  when written forward into cycle 11. Corrected below.
- The **Automation / daily publish** section said `INGEST_SCHEDULE` was folded into #30's acceptance.
  #30 is closed; that gate now lives on **#48**.

## Cycle 11 delta (watermark 2026-09-20T07:42Z → 13:43Z): **zero owner movement; the PO's own measuring instrument was returning false positives**

**Nothing moved.** No owner reply since cycle 10's notify (`msg_0e0b6127`, 07:47:10Z). `main` at
`cf1e42c` (cycle 10's own send record), **0 open PRs**, site HTTP **200** serving 18,152 networks
(`updated_at` 2026-09-17T10:06:08Z). Open count flat at **8** for an eleventh cycle; net issue
delta **0**; burndown **8/9** v1 Release Criteria, R5 still the only unmet one.

**Corpus provably unchanged, not assumed:** every open issue's `updatedAt` predates this cycle's
watermark (#34 09-17T12:18Z, #30 09-19T13:42Z, #29 09-17T09:27Z, #25 09-17T06:12Z, #22
09-20T07:41Z, #21 09-19T01:43Z, #17 09-20T07:41Z, #1 09-18T01:43Z — the two 09-20 stamps are
cycle 10's own comments), and `search/issues?…updated:>=2026-09-20T07:45:00Z` → `total_count: 0`.

### Both standing gates re-run objectively — both still negative (EIGHTH consecutive)

**#30, all four checks at 13:43Z:** `redlands_wifi_inbox` → *Could not resolve to a Repository*
(the `redlands-wifi-inbox` spelling too); `repos/…/environments` → `total_count: 1`, only
`github-pages`; `actions/secrets` → **0** (no `INBOX_TOKEN`); `actions/variables` → **0** (no
`INGEST_SCHEDULE`, so R5 stays blocked). `ask await` on `msg_92a6bc9c` re-read unchanged:
`yes` + comment `"Rewrite history"` — an agreement to the plan, **not** the resume key
`DONE private-inbox`. `waiting` kept on #30; dev-team routine still `enabled: false`.

**#17 tripwire at 13:43Z:** apex → **404**, body is GitHub's own *"Site not found · GitHub Pages"*
page, apex `A` → 185.199.108/109/110/111.153, `www` CNAME → `patrickmroskam.github.io.`,
`_github-pages-challenge-patrickmroskam` TXT → none, `pages.cname` → `null`. **Latent, eighth
consecutive run unchanged.** Fire condition not met; rung spent; no reminder re-sent.

### #22 aging sweep re-verified live — still NOT auto-close eligible

Re-derived this cycle rather than inherited: `GET /repos/…/pulls/30` → **404** (#30 is an issue,
not a merged PR); `gh issue view 30` → `state=OPEN`, `p2,waiting`; all **15** merged PRs scanned,
none ships option C (#37 = owner setup doc, #26 = the privacy-page disclosure that the logs are
public). Verdict **ineligible**; #22 stays open, `po-closure-proposed` kept, nothing written to
`objections.md`. Routed to the human digest as *awaiting human closure decision*. **No new issue
comment was posted** — cycle 10's (`issuecomment-5748458979`) already says exactly this, and a
verbatim repeat every 6 h on a public issue is noise; the per-cycle record lives here and in the
decision log, which is what "records that the sweep ran" requires.

### §4h enumeration and the reachability sweep

`label:blocked -label:needs-human` → **[22]**; `label:waiting -label:needs-human` → **[30]**.
Exactly {#22, #30}, neither carrying `needs-human` — **fourth consecutive clean check**, no
regression. Reachable-and-undoable **empty**, reachable-and-stale **empty** — **seventh
consecutive clean**, and this cycle grounded in the provable-non-change evidence above plus a
fresh halt-or-re-ask pattern re-read of #25/#29/#34 and #1.

### The cycle-11 find: a substring match is not a measurement

Two independent checks this cycle returned **false positives**, both because the phrase being
searched for appears in prose that merely *discusses* it:

1. **#22's post-proposal `closure-objection:` count came back `2`, not `0`.** Both "objections"
   were the PO's **own** comments — cycle 6 explaining that dev-team *"posts a
   `closure-objection:` and strips `po-closure-proposed`"*, and cycle 9's own results table
   containing the literal row `| post-proposal closure-objection: count | 0 |`. A run that
   trusted that number would have concluded an objection existed, and the handshake's disagree
   branch would have had it strip `po-closure-proposed` and record a veto in `objections.md` —
   precisely what cycle 9's rewrite forbids, and it would have barred a legitimate re-proposal
   once option C ships.
2. **The halt-or-re-ask sweep flagged #29** on *"wait for the running pan to finish before
   restoring the fence"* — a Leaflet `moveend` implementation suggestion, not an instruction to
   stop and ask the owner.

This is a different failure class from the last two finds. Cycle 9 caught a **dropped
precondition**; cycle 10 caught an **expired rationale**. This is a **measuring instrument
degrading because the measurer's own output has entered the corpus it measures**: every cycle the
PO writes more prose *about* `closure-objection:`, `waiting`, `needs-human` and `po-closure-proposed`
onto the very issues it then greps, so the false-positive rate of any mention-based check rises
monotonically with the project's age. **Rule: any check whose result gates an action must match on
structure, not mention** — a real objection is a comment whose body *begins* with
`closure-objection:`, and the count must exclude comments authored by the PO's own runs. Recorded
as a standing task.

### Carry-overs, re-tested rather than re-copied

- **Git history rewrite, still unfiled.** Re-derived §4e from the skill source this cycle, as the
  cycle-10 rule requires of anything deferred 3+ cycles: *"The budget is only issues actually
  closed this run… If you realized no closures this run, file no gap issues."* Cycle 11 realized
  **zero** closes (as have all eleven), so the block is **genuinely still true** — and the
  re-derivation surfaced a second, independent reason it should not be forced: §4e budgets
  *release-criteria* gaps, and history retention sits under the PRD's "Known consideration
  (**not a requirement**)", so it is not a release-criteria gap at all. Authority and scope stay
  recorded here, in the decision log, and on #30 and #22. **Unblock: any realized close.**
- **Protocol step 4 amendment** — still unruled by the owner; #25/#29/#34 still parked (~70 h).

## Cycle 10 delta (watermark 2026-09-20T01:38Z → 07:42Z) — **FULL REBUILD**: the sweep that did not fire, and two carry-overs cleared

**Full rebuild cycle** (`digest_full_rebuild_every_cycles: 10`). Every rollup below this
delta was re-derived from live GitHub state and live HTTP checks rather than carried
forward; several lines that had been inherited since cycles 2–3 are corrected in place and
the correction is named in each section. Next full rebuild: **cycle 20**.

**Nothing moved on the owner's side.** `search/issues?q=repo:...+updated:>=2026-09-20T01:45:00Z`
→ **`total_count: 0`**. The newest message in the OH HAI inbox is cycle 9's own notify
(`msg_760e8798`, 2026-09-20T01:49:52Z); the owner has sent nothing since. Open count flat at
**8** for a tenth cycle; net issue delta **0**; zero realized closes (last close: #27,
2026-09-17T14:29:43Z). `main` at `4c29b04`, **0 open PRs**, CI green, site HTTP 200.

### Both standing gates re-run objectively — both still negative

**#30, all four checks at 07:41Z** (a **seventh** consecutive negative):

- `gh repo view patrickmroskam/redlands_wifi_inbox` → *Could not resolve to a Repository* (the `redlands-wifi-inbox` spelling too)
- `repos/.../environments` → `total_count: 1`, only `github-pages`
- `actions/secrets` → `total_count: 0` — no `INBOX_TOKEN`
- `actions/variables` → `total_count: 0` — no `INGEST_SCHEDULE`

`ask await` on `msg_92a6bc9c` re-read unchanged: `yes` + "Rewrite history". **Not the resume
key** — the key is `DONE private-inbox`, which has never arrived. `waiting` kept on #30.

**#17 tripwire at 07:41Z:** apex → **404** serving GitHub's own *"Site not found · GitHub Pages"*
page, apex `A` → 185.199.108/109/110/111.153, `_github-pages-challenge-patrickmroskam` TXT →
none, `www` CNAME → `patrickmroskam.github.io.`, repo `pages.cname` → `null`. **Latent**,
seventh consecutive run unchanged.

### The sweep that did not fire — cycle 9's rewrite held

This was the cycle the old task text would have self-closed #22. It did not, and the
rewritten precondition is what stopped it. Re-verified live at 07:41Z rather than inherited
from cycle 9's finding:

| check | result |
|---|---|
| is #30 a merged PR? | **No** — `GET /repos/.../pulls/30` → `404 Not Found` |
| is the named target closed-completed? | **No** — `state=OPEN`, labels `p2,waiting` |
| has any merged PR shipped option C? | **No** — 15 merged PRs scanned; #37 is the owner setup doc, #26 is the privacy-page *disclosure* that the raw logs are public |
| post-proposal `closure-objection:` count | **0** (window shut 2026-09-20T01:42:32Z) |
| `launch-blocker`? | no |

`addressed-in-#NNN` requires a **merged PR** #NNN. The named target has not shipped, so the
verdict is **ineligible** and the aging test never gets to run. #22 **routed to the human
digest as _awaiting human closure decision_** ([comment](https://github.com/patrickmroskam/redlands_wifi_project/issues/22#issuecomment-5748458979)).
`po-closure-proposed` **kept** — the proposal is genuinely open, and the label is what keeps
#22 in dev-team's step-0 adjudication queue, its verifiable path. Nothing recorded in
`objections.md`: an ineligible verdict is not a veto, and logging it as one would wrongly bar
a legitimate re-proposal once option C ships.

The exposure #22 records — raw GPS drive trails, RSSI and out-of-area rows, public in
`ingest/` history **and in git history** — remains **live**. Closing it today would have
erased its only open record.

### Carry-over cleared: #17 split, at zero net issue delta

Queued since cycle 1 and deferred six times, five of them on a rationale cycle 9 proved was
never true (§4e budgets *filing*; a retitle files nothing, so net delta is 0 and §4e never
applied). Executed this cycle:

- **#17 retitled** → *"Security: close the redlandswifiproject.com takeover window (verify the domain, or drop the DNS records)"*. The issue is now the mitigation **alone**.
- The **custom-domain switch gets no issue in v1** and is not tracked elsewhere. The owner's `not-yet` (2026-09-18) and the ratified PRD's Out-of-Scope line agree; nothing is lost, and if the owner wants it later it returns as new scope.
- An **additive banner** ([comment](https://github.com/patrickmroskam/redlands_wifi_project/issues/17#issuecomment-5748460508)) marks which paragraphs of the original body are now out of scope. Original body **preserved verbatim** — the owner's framing is not rewritten.
- **Priority deliberately left at `p2`, not raised to p1.** `needs-human` excludes #17 from every dev-team tier search, so the tier label is inert on this issue; raising it would be a silent re-escalation of a matter the owner considered and deferred, whose escalation rung was fired once (cycle 4) and retired. The severity lives on the issue, in this log, and in the standing tripwire — not in the sort key. This reasoning is recorded so no later cycle re-derives it as a p1 "correction".

### Carry-over NOT cleared, and why: the git history rewrite

Authority exists (the owner replied "Rewrite history", `private-inbox.md`'s exact opt-in
phrase). It is **still not filed**, and not on a schedule. Filing it is **+1 net issue
delta**, so unlike the retitle it genuinely needs §4e budget — *"if you realized no closures
this run, file no gap issues"*. Cycle 10 realized **zero** closures (the #22 sweep produced
none, as cycle 9 predicted), so the budget the old schedule assumed never arrived. Unblock is
**any realized close**, with no cycle attached. It must not ride inside #30's cutover: it is
destructive and irreversible on a public repo, and anyone who already cloned keeps their copy.

### Sweeps

**§4h blocked queue** — `label:blocked -label:needs-human` and `label:waiting -label:needs-human`
return exactly **{#22, #30}**, unchanged for a third cycle. Neither carries `needs-human`:
**no regression.** Both are branch (b), both with a named verifiable path — #22 → dev-team
step-0 adjudication on resume, #30 → the owner's `DONE private-inbox`.

**Reachability / doability / staleness** — all 8 swept; both sets **empty (sixth consecutive
clean)**. The corpus is provably identical to the one cycle 9 swept: every open issue's
`updatedAt` predates this cycle's watermark, and only cycle 9's own comments on #17 and #22
fall between. #25/#29/#34 and #1 re-read and pattern-checked for halt-or-re-ask language →
**none**. #1 carries no priority label, so it never enters a tier search. Five of the last six
finds were on the PO's own path, not in an issue body; a clean sweep is the honest result and
not a licence to manufacture a seventh landmine.

### Open-count accounting

`gh issue list --state open --json number,labels,assignees` → **8 open, 0 assigned**:
#1 `tracking` · #17 `p2,blocked,needs-human` · #21 `p3,blocked,needs-human` ·
#22 `p2,blocked,po-closure-proposed` · #25 `p3` · #29 `p3` · #30 `p2,waiting` · #34 `p3`.
Workable-by-an-agent today: **0** — not because the backlog is empty (#25/#29/#34 are ready
and unblocked) but because the constitution's protocol step 4 halts the whole dev-team routine
while #30 waits on the owner. Those three have now been parked **~64.6 h**
(since 2026-09-17T15:05:07Z). closed 0 / proposed 0 / contested 0 this period.

## Cycle 9 delta (watermark 2026-09-19T19:38Z → 2026-09-20T01:38Z): **zero owner movement; the cycle-10 closure sweep would have closed a live privacy exposure**

**Nothing moved.** `search/issues?q=repo:...+updated:>=2026-09-19T19:38:00Z` → **`total_count: 0`** — not one issue touched since the last watermark. The newest message in the OH HAI inbox is cycle 8's own notify (`msg_d45a7eb7`, 2026-09-19T19:44:35Z); the owner has sent nothing since. `main` at `f3e1b86` (cycle 8's own commit), **0 open PRs**, CI green, site HTTP 200. Open count flat at **8** for a ninth cycle; net issue delta **0**.

### Both standing gates re-run objectively — both still negative

**#30, all four checks at 01:39Z** (a **sixth** consecutive negative):

- `gh repo view patrickmroskam/redlands_wifi_inbox` → *Could not resolve to a Repository* (the `redlands-wifi-inbox` spelling too)
- `repos/.../environments` → `total_count: 1`, only `github-pages`
- `actions/secrets` → `total_count: 0` — no `INBOX_TOKEN`
- `actions/variables` → `total_count: 0` — no `INGEST_SCHEDULE`

`ask await` on `msg_92a6bc9c` re-read unchanged: `yes` + "Rewrite history". Not the resume key.
`waiting` kept on #30; dev-team routine re-verified **`enabled: false`**, `lastRunAt` still
2026-09-17T15:05:07.762Z — the three workable p3s are now parked **~58.5 h**.

**#17 tripwire at 01:39Z:** apex → **404**, body is GitHub's own *"Site not found · GitHub Pages"*
page, apex `A` → 185.199.108/109/110/111.153, `_github-pages-challenge-patrickmroskam` TXT → none,
`www` CNAME → `patrickmroskam.github.io.`, repo `pages.cname` → `null`. **Latent**, sixth
consecutive run unchanged. `ask await` on `msg_e812f339` re-read unchanged: `not-yet`.

### The find: #22's closure proposal is not auto-close eligible, and cycle 10 was set to close it anyway

The 48 h no-objection window on #22's proposal (posted 2026-09-18T01:42:32Z) shut at
**2026-09-20T01:42:32Z** — during this run — with **0** post-proposal `closure-objection:`
comments. On the aging test alone, #22 was due to self-close on the next pass, and
`po-tasks.md` said so in as many words: *"#22 is either self-closed with verdict
`addressed-in-#30`"*.

It is **not eligible.** `closure-handshake.md`, the declared canonical contract, gates the
verdict class *before* the check-and-act runs:

> `addressed-in-#NNN` — the work shipped in **PR** #NNN (a merged PR, not a bare commit SHA).
> Auto-close eligible? **Yes *if PR #NNN is merged*.**

and Path 2 repeats it: auto-close eligible *"with the named issue/PR **confirmed
closed-completed on re-check**"*. Verified live at 01:41Z:

| check | result |
|---|---|
| is #30 a merged PR? | **No** — `GET /repos/.../pulls/30` → `404 Not Found` |
| is the named target closed-completed? | **No** — `state=OPEN`, labels `p2,waiting` |
| has any merged PR shipped option C? | **No** — #37 is the setup doc; #26 is the privacy-page *disclosure* that the raw logs are public |
| post-proposal `closure-objection:` count | **0** |
| `launch-blocker`? | no |

The precondition is false, so Path 2's remaining branch applies: **route to the human digest as
"awaiting human closure decision" — do not auto-close.**

**What closing it would have cost.** #22 is the record that the raw logs expose the car's
timestamped **drive path** and that they remain in **public git history**. The exposure is live and
the fix (#30) is still blocked on the owner. Closing it would have erased the only open record of a
live privacy exposure at the moment the owner is being asked to act on it.

**Where the trap actually lives — compression, not the contract.** The handshake's own
check-and-act snippet tests only `state` / post-proposal objection / `launch-blocker`; it omits the
named-target check because eligibility is settled in the prose above it. `po-tasks.md` then
compressed the rule down to its action and dropped the precondition entirely. A run following
either text top-down closes the issue. Both have been fixed: the sweep task is rewritten with the
gate inline, and a new standing task requires task-file entries that restate a skill rule to carry
that rule's **preconditions**, not just its action.

**Action taken:** comment on #22, `po-closure-proposed` **kept** (the proposal is genuinely open,
and the label is what keeps #22 in dev-team's step-0 queue — the handshake's real checker). Nothing
closed, no labels changed, no objection recorded (an ineligible verdict is not a veto, and logging
it as one would wrongly bar a legitimate re-proposal later).

### Knock-on: two deferred tasks had their blockers corrected

Cycle 10 was built around a close that will not happen, so both tasks waiting on it were re-based:

- **#17 retitle — unblocked; it was never budget-blocked.** Cycles 2–8 deferred it on "§4e needs
  ≥ 1 realized close". That applied to the *original* route (file a second issue). Cycle 4 had
  already narrowed it to **retitling #17 to the mitigation alone**, which files nothing — §4e
  budgets *filing*, so it never applied. Scheduled for cycle 10 with an accurate blocker (none).
- **History-rewrite issue — still blocked, on a different condition.** It genuinely is a new
  issue (+1), so it genuinely needs §4e budget. Its unblock is now **any realized close**, with no
  cycle attached — not the #22 sweep.

### #17 re-raised once, as committed — and the rung is spent

The single dated reminder scheduled at cycle 4 for cycle 9 was posted on #17: the tripwire table,
both ~5-minute exits from `docs/setup/domain-takeover.md`, and an explicit statement that **neither
reverses the owner's `not-yet`** — neither serves the site on the custom domain, and the switch is
out of v1 scope per the ratified PRD. No re-ask (the ask is answered). **No further timer on #17.**

### Sweeps

**§4h blocked queue** — `label:blocked -label:needs-human` and `label:waiting -label:needs-human`
return exactly **{#22, #30}**, unchanged. Neither carries `needs-human`: **no regression.** Both are
branch (b), both with a named verifiable path — #22 → dev-team step-0 adjudication on resume
(**revised this cycle**, it is no longer the cycle-10 sweep), #30 → the owner's `DONE private-inbox`.

**Reachability / doability / staleness** — all 8 swept; both sets **empty** (fifth consecutive
clean). #25/#29/#34 re-read in full: pure repo work, no halt-or-re-ask instruction. #30's cycle-7
banner verified present with the original body verbatim below it. #1 re-read and cleared — its R5
line orders `INGEST_SCHEDULE=on` **after** the cutover, and it carries no priority label so it never
enters a tier search. The find this cycle was on the PO's own closure path, as the last four were.

### Open-count accounting

`gh issue list --state open --json number,labels,assignees` → **8 open, 0 assigned**:
#1 `tracking` · #17 `p2,blocked,needs-human` · #21 `p3,blocked,needs-human` ·
#22 `p2,blocked,po-closure-proposed` · #25 `p3` · #29 `p3` · #30 `p2,waiting` · #34 `p3`.
Workable-by-an-agent today: **0** — not because the backlog is empty (#25/#29/#34 are ready) but
because the constitution's protocol step 4 halts the whole dev-team routine while #30 waits on the
owner. closed 0 / proposed 0 / contested 0 this period.

## Cycle 8 delta (watermark 2026-09-19T13:38Z → 19:38Z): **zero owner movement; the blocked-queue sweep is aimed at the two issues that must never be parked**

**Nothing moved.** The newest message in the OH HAI inbox is cycle 7's own notify
(`msg_2dd5fe22`, 2026-09-19T13:45:13Z) — the owner has sent nothing since. `main` at `965beaa`
(cycle 7's own commit), **0 open PRs**, CI green, site HTTP 200. The only issue touched since the
watermark is #30 at 13:42:17Z — cycle 7's own banner edit. Open count flat at **8** for an eighth
cycle; net issue delta **0**.

### Both standing gates re-run objectively — both still negative

**#30, all four checks at 19:38Z** (unchanged since cycle 4 — a **fifth** consecutive negative):

- `gh repo view patrickmroskam/redlands_wifi_inbox` → *Could not resolve to a Repository*
  (the `redlands-wifi-inbox` spelling too)
- `repos/…/environments` → `total_count: 1`, only `github-pages`
- `actions/secrets` → `total_count: 0` — no `INBOX_TOKEN`
- `actions/variables` → `total_count: 0` — no `INGEST_SCHEDULE`

`ask await` on `msg_92a6bc9c` re-read unchanged: `yes` + "Rewrite history". Not the resume key.
`waiting` kept on #30; dev-team routine re-verified **`enabled: false`**, `lastRunAt` still
2026-09-17T15:05:07.762Z — the three workable p3s have now been parked **~52.5 h**.

**#17 tripwire at 19:38Z:** apex → **404**, body is GitHub's own *"Site not found · GitHub Pages"*
page, apex `A` → 185.199.108/109/110/111.153, `_github-pages-challenge-patrickmroskam` TXT → none,
`repos/…/pages` → `cname: null`, `protected_domain_state: null`. **404 = still unclaimed, latent,
no action.** Fire condition not met.

**R5 evidence, now three data points.** Today's scheduled ingest fired **2026-09-19T13:43:57Z** and
concluded **`skipped`** — joining 2026-09-18T14:10:34Z and 2026-09-17T14:44:46Z. Every scheduled
run this workflow has ever had is `skipped`, gated on `vars.INGEST_SCHEDULE == 'on'` at
`.github/workflows/ingest.yml:28`. R5 is implemented and gated off, not unbuilt.

### The find: the PO's own step 4h sweep is aimed at #22 and #30

Cycle 5 parked #21 with `needs-human`. Cycle 6 parked #22 with `blocked`, **deliberately not**
`needs-human`, because `needs-human` also suppresses closure churn and would switch off the
cycle-10 aging sweep scheduled to resolve #22. Cycle 7 recorded the general principle: *use the
narrowest durable label that does not disable the machinery scheduled to resolve it.*

What no cycle checked is that the product-owner skill's **§4h blocked-queue sweep** is itself a
consumer of those labels, and its enumeration is literally:

```
gh issue list --state open --search "label:blocked sort:created-asc -label:needs-human"   → #22
gh issue list --state open --search "label:waiting sort:created-asc -label:needs-human"   → #30
```

Run at 19:38Z, that returns **exactly {#22, #30}** — the two issues in this backlog that must
never receive `needs-human`. #22 because it would suppress its own cycle-10 closure sweep; #30
because this routine's resume check enumerates open issues labelled `waiting`, so parking #30
switches off the check that restarts the whole project.

§4h's third branch reads: escalate to `needs-human` when there is *"no clear issue dependency, an
ambiguous/external blocker, a design/scope call, **or it has aged past `closure_aging_window_hours`
with the blocker unchanged and no path you can verify**."* Both issues are now past the 48 h window
with their blockers unchanged — #22 since 2026-09-17T05:08:48Z, #30 `waiting` since
2026-09-17T15:06Z — and neither has a *"Blocked by #N"* dependency of the kind the first two
branches look for. A run that matched on age and on the absence of an issue dependency, without
weighing the "no path you can verify" clause, lands on the escalate branch.

**Both are branch (b), leave it — and the verifiable paths are these, recorded so the next cycle
does not have to re-derive them:**

| # | label | blocker | the path that makes this branch (b), not (c) |
|---|---|---|---|
| #22 | `blocked` | none; the label is PO parking, not a dependency | the §4d aging sweep resolves it at **cycle 10 (~2026-09-20T07:38Z)**, window shuts 2026-09-20T01:42Z |
| #30 | `waiting` | the owner's `DONE private-inbox` | four objective existence checks, re-run every cycle; the reply resumes it |

**Confidence: high on the mechanism, medium on the hazard.** The commands above were run, not
reasoned about, and their output is the whole finding — that part is certain. Whether a careful run
would actually escalate is less certain: the "no path you can verify" clause is in the same
sentence as the age trigger, and both paths here are verifiable and dated. So this is a **guard
against a plausible misread, not a claim that the misread was coming** — recorded that way on
purpose, in the same calibration cycle 7 used on #30.

**No label was added or removed this cycle.** The remedy is a durable carve-out in `po-tasks.md`,
which every cycle reads before acting.

### Reconciliation correction: the Hosting rollup has been four cycles stale

The *Hosting / custom domain* section below still reads `open: 1 (p0:0 p1:1 p2:0 p3:0)` and
*"Priority holds at p1"*. That has been wrong since **cycle 4**, which deliberately moved #17
`p1 → p2` when the owner answered `not-yet` (decision log, 2026-09-18T19:45Z: *"priority in this
backlog encodes dev-team build order"*). GitHub's label timeline confirms `unlabeled p1` /
`labeled p2` at 2026-09-18T19:45:33Z. The readiness report's parked table was updated at the time;
this per-area rollup was not, and cycles 5, 6 and 7 carried it forward unread.

Corrected below to `open: 1 (p0:0 p1:0 p2:1 p3:0)`. **Operationally harmless** — every tier search
reads GitHub labels, never this file — but it is the PO's own working memory contradicting the PO's
own decision, and the digest is what a future cycle grounds on. The other five rollups were
re-checked against the live list and are all correct.

### Open-count accounting

Still **8 open** (`gh issue list --json number,labels,assignees`, 19:38Z). Workable-by-an-agent:
**#25, #29, #34** (p3, unassigned, unlabelled — all three bodies re-read this cycle and all three
pass the staleness test: pure repo work, no halt-or-re-ask instruction, no owner decision language).
Durably parked: **#17, #21** (`needs-human`), **#22** (`blocked` + `po-closure-proposed`).
Owner-gated: **#30** (`waiting`, banner verified intact with the original body byte-for-byte below
it). Tracking parent: **#1**, carries no priority label so it never enters a tier search.

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

## Rollups — refreshed in place from live state at cycle 12 (2026-09-20T19:44Z)

> Re-derived this cycle from `gh issue list`, the GitHub API, live HTTP, and a replay of the
> 48 historical logs out of git history. Counts are computed from current labels, not carried
> forward. Two inherited errors are corrected inline and named as corrections.

## Site & map (PRD R1, R2)

- open: **1** (p0:0 p1:0 p2:0 p3:1 — #29), launch-blockers: 0, in-flight: 0
- **Complete and live.** Re-verified 2026-09-20T19:3xZ: site → **200**, database serves **18,152**
  records, `updated_at` 2026-09-17T10:06:08Z. That stamp is unchanged since the backfill and will
  stay so until #48 lets the daily job run — it is the expected value, not a stale-data symptom.
- Shipped: #2, #7, #11, #12, #13, #20, and **#39** (Bluetooth + Flock maps, R9, `94c87e4`).
- Residual: **#29 (p3)** — popup-pan edge cases. Workable today.

## Ingest pipeline (PRD R3, R4)

- open: **3** (p0:0 p1:0 p2:0 p3:3 — #41, #42, #50), launch-blockers: 0, in-flight: 0
- **Closed this cycle:** #25 (never delete an unparseable log, `45847bb`), #30 (private-inbox
  cutover, PR #43 `be05d65` + PR #46 `e621c25`), #40 (opt-out read before the filters that
  shadowed it, PR #49 `6662031`). Shipped earlier: #3, #15, #27, #8.
- **156 unit tests green**; `ingest/` retired and empty, per the transient-inbox invariant.
- Residuals, all **p3 on measured evidence**:
  - **#41** — summary mis-attributes in-batch duplicates; partial multi-database write reports
    "nothing written". Report accuracy only; published data unaffected.
  - **#42** — a Flock record built from a BLE row carries `auth`/`channel` against R9.3.
    **Doubly latent:** `flock-rules.json` is empty *and* no BLE row has ever been ingested.
  - **#50** — `_nomap` opt-out lost on a classic-`BT` row. **Latent, measured:** all 48 historical
    logs replayed from `0c10f06^` → **40,228 rows, 100% `Type=WIFI`**, zero `BT`, zero `BLE`.
  - *Caveat:* the ESP32 Marauder can emit BLE rows if the owner runs a BLE scan. Re-measure on the
    next real log; latent today is not latent forever.

## Automation / daily publish (PRD R5)

- open: **2** (p0:0 p1:0 p2:1 — #48; p3:1 — #45), **launch-blockers: 1** (#48), in-flight: 0
- **Still the one unmet v1 Release Criterion — but the shape of it changed completely this cycle.**
  It is no longer "the owner has not started"; the owner has done most of it. Every precondition is
  in place except one, and the one that fails is isolated:
  inbox repo ✅ private, `main`, holds `wardrive_0.log` · `ingest` environment ✅ scoped to `main`
  only · `INBOX_TOKEN` ✅ present (16:16:57Z) · **`INBOX_TOKEN` ❌ rejected 404** (run
  `35527858730`, 18:04Z) · `INGEST_SCHEDULE` unset **by design**.
- **#48 (`p2`, `waiting`, `launch-blocker`)** carries the whole criterion. Ask
  `msg_f1c95c95-117b-4f4d-9fe0-a1f7e19674ed` is **open**; steps in `docs/setup/inbox-token-fix.md`.
  Not re-sent this cycle — an open ask is not re-asked.
- **`INGEST_SCHEDULE=on` is bot work, not a second owner step** (the `gh` token carries `repo`), and
  it must stay unset until the token works, so a scheduled run cannot fail nightly in the owner's
  inbox.
- Residual: **#45 (p3)** — `pushed_sha` reported for a commit a dropped rebase never pushed.
  Author rates reachability low; it needs a byte-identical database including the `updated_at` stamp.
- *Rebuild correction:* this section previously folded the `INGEST_SCHEDULE` flip into **#30's**
  acceptance. #30 is closed; the gate lives on **#48**.

## Privacy & security (PRD R6, R7)

- open: **2** (p0:0 p1:0 p2:1 — #22; p3:1 — #21), launch-blockers: 0, in-flight: 0
- **The exposure this theme existed for is now stopped going forward.** PR #43 moved raw logs to the
  private inbox; `privacy.html` says so; the constitution invariant was amended and owner-ratified.
- **#22 (p2)** — first true maker-checker exchange in the project. Objection recorded 16:05:13Z
  (ledger entry 1), `addressed-in-#30` **withdrawn**, `addressed-in-#43` proposed 19:40Z on the
  merged PR the objection itself named. Window shuts 2026-09-22T19:40Z.
- **The public git history is still not remediated** — 48 pre-cutover logs remain in this repo's
  history and in every pre-existing clone. Owner-authorized (`"Rewrite history"`, `msg_92a6bc9c`),
  **not filed as an issue**, deferred on the §4e budget (0 realized closes), carried in
  `docs/spec/readiness.md`. Stated as unfiled everywhere it appears — it is not tracked work.
- **#21 (p3, `needs-human`)** — owner-only account settings. Still deliberately behind #48; a
  competing ask lowers the odds of the one that matters.
- Shipped this cycle in-theme: **#40** — three opt-out losses fixed, including a `_nomap` device
  opting out over Bluetooth that was being published to the **main WiFi map**.

## Hosting / custom domain (OUT of v1 scope — mitigation is NOT)

- open: **1** (p0:0 p1:0 p2:0 **p3:1** — #17), launch-blockers: 0, in-flight: 0
- *Rebuild correction:* cycles 10 and 11 recorded #17 as **`p2`** and asserted it was "kept p2".
  **It is `p3` and has been since commit `08522d1`** (owner ruling: custom domain deferred
  post-v1). The inherited line was stale when it was written forward. `p3` is correct and stays.
- Tripwire, **ninth consecutive latent reading** (19:3xZ): apex → 404 with GitHub's *"Site not
  found"* body, apex `A` → 185.199.108–111.153, `www` CNAME → `patrickmroskam.github.io.`,
  challenge TXT absent, `pages.cname` → `null`. Unclaimed by anyone.
- Escalation: **both rungs spent.** No timer remains; only the automated tripwire.

## Tests / CI (PRD R8)

- open: **1** (p0:0 p1:0 p2:0 p3:1 — #34), launch-blockers: 0, in-flight: 0
- CI green across this cycle's five merges; **0 open PRs** at cycle end.
- Residual: **#34 (p3)** — split the >1,000-line `tests/e2e/site.spec.js`. Workable today.

## Spec (PRD)

- open: 0 — **#44 closed** (PR #51, `b40acbc`): the ratified PRD had described the retired public
  `ingest/` inbox after the cutover. R3, R4.1, R4.9, R7.2, R8.3, the vision paragraph and three
  done-criteria lines now match what runs.
- **R4.9 is amended and awaiting owner ratification** — "delete in the same commit" became
  "publish first, then delete", which is weaker but keepable across two repositories. Flagged
  in-line in the spec. **Nothing is blocked on it**; it is a wording ratification, carried in the
  readiness queue rather than burned as a competing ask.

## Tracking

- **#1** — v1 tracking issue, `tracking`, no priority label, never assigned. Checkboxes ticked by
  dev-team through this cycle.

## Closure activity (project to date, refreshed at cycle 12)

- **proposed: 1** (#22, `addressed-in-#43` — open, window shuts 2026-09-22T19:40Z),
  **closed: 18**, **contested: 1**, **objections recorded: 1**.
- **closed** rose 14 → **18**: #25, #30, #40, #44, all dev-team ship-and-close.
- **The PO has still realized zero closures in 12 cycles** — but the reason changed. For 11 cycles
  it was "nothing could close"; now #22 has an eligible verdict pointed at a merged PR and a live
  48 h window. The first realized PO close is reachable at cycle 13–14 if the checker concurs.

## Convergence

- `net_open_history: [8, 8, 8, 11]` — first rise in 11 cycles, **k=3 not tripped**.
- The rise is **healthy inflow, not divergence**: 4 closed, 5 filed, every filed item a
  review-found defect on code that shipped the same day, and 3 of the 5 measured latent.
- **PO net filing this cycle: 0.** The §4e budget was 0 realized closes and was respected.
