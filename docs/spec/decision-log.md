# Redlands Wifi Project — PO decision log (append-only)

## 2026-09-18T01:44:00Z — session product-owner cycle 1 (bootstrap)

- decision: `bootstrapped continuity artifacts` — created `state-digest.md` (full rebuild, digest absent), `decision-log.md`, `po-tasks.md`, `objections.md`. Labels already complete; `readiness-artifact` re-ensured.
- confidence: high
- alternatives: seeding the digest from the template — rejected, a placeholder `last_reconciled_at` would make cycle 2 attempt a bogus delta instead of the forced full rebuild.
- watch-next: cycle 2 is a delta from `2026-09-18T01:43:42Z`; full rebuild is due at cycle 10.

## 2026-09-18T01:44:00Z — session product-owner cycle 1

- decision: `resume-check #30: NOT resumed` — OH HAI ask `msg_92a6bc9c` is answered `yes` with comment "Rewrite history", but that is not the resume key `DONE private-inbox`. Verified against GitHub instead of reading intent into the reply: `redlands_wifi_inbox` does not exist, there is no `ingest` environment (only `github-pages`), and `actions/secrets` returns `total_count: 0`. `waiting` kept; dev-team routine **left disabled**; findings commented on #30.
- confidence: high
- alternatives: (a) treating `yes` as DONE and re-enabling dev-team — rejected, the three artefacts the work depends on demonstrably do not exist, so the next run would fail at checkout; (b) re-sending the ask — rejected, the ask is answered, not open, and the protocol forbids re-sending.
- watch-next: re-run the same three existence checks every cycle; they are the objective resume gate, not the reply text.

## 2026-09-18T01:44:00Z — session product-owner cycle 1

- decision: `recorded owner decision (not acted on): history rewrite authorised` — #30's own gate says the purge proceeds "only if the reply contains `rewrite history`"; the reply does. Recorded on #30 with the caveats (forks/clones retain objects; `data/networks.json` unaffected; pre-rewrite bundle already backed up) and an explicit bar on any agent running it unattended.
- confidence: medium
- alternatives: acting on it this run — rejected, destructive and irreversible on a public repo, and outside a PO pass's remit; dropping it — rejected, it would silently lose a decision the owner made.
- watch-next: when `DONE private-inbox` arrives, the executing session must re-confirm the purge with the owner *in that session* before running it.

## 2026-09-18T01:44:00Z — session product-owner cycle 1

- decision: `reprioritized #17 p2→p1` + comment — re-verified the domain-takeover exposure live (Namecheap NS, apex A → Pages, `www` → `patrickmroskam.github.io`, no `_github-pages-challenge` TXT, apex 404 from Pages = unclaimed). Also named the silent deadlock: `waiting` on `DONE custom-domain`, an ask that was never sent.
- confidence: high
- alternatives: leaving p2 — rejected, an unclaimed Pages-pointed domain bearing the project name is a live exploit window; splitting the mitigation into its own issue — deferred, §4e budget is 0 closes this run so net-issue-delta must stay ≤ 0 (queued as a PO task).
- watch-next: if the TXT record appears, drop #17 back to p3 and reopen the split question; if the owner says the domain is unwanted, the mitigation is deleting the records, not verifying.

## 2026-09-18T01:44:00Z — session product-owner cycle 1

- decision: `proposed-close #22 (addressed-in-#30)` + removed `needs-triage`, added `po-closure-proposed` — the issue asked one question, the owner answered "Go with option C" on 2026-09-17 05:22Z, and the implementation is #30. The 09:09Z comment explicitly left `needs-triage` for the PO to clear.
- confidence: high
- alternatives: direct-closing this run — rejected, the handshake forbids same-run close even for an auto-close-eligible verdict; keeping it open as the option-C home — rejected, #30 is that home.
- watch-next: aging sweep after 2026-09-20T01:42Z (48 h window) — self-close if dev-team has not objected and #30 is still the live carrier.

## 2026-09-18T01:44:00Z — session product-owner cycle 1

- decision: `gap: PRD R5 has no owner → folded into #30's acceptance` — R5 is the only unmet Release Criterion. The workflow gates scheduled runs on `vars.INGEST_SCHEDULE`, which does not exist; the code comment attributes the flip to #8, which closed without doing it. Added three acceptance items to #30 (set the variable, verify one scheduled run publishes, fix the stale `#8` citation).
- confidence: high
- alternatives: filing a standalone issue — rejected, §4e budget is 0 realized closes this run so net-issue-delta must stay ≤ 0; leaving it in the workflow comment — rejected, that is how it was orphaned.
- watch-next: after `DONE private-inbox`, confirm #30 actually carries the variable flip rather than closing on the token work alone — R5 is not met until a *scheduled* run publishes.

## 2026-09-18T01:44:00Z — session product-owner cycle 1

- decision: `spec bookkeeping (§4g)` — flipped R1, R2, R3, R4, R6, R7, R8 and the initial-backfill line to `[x]` in the PRD Release Criteria, each against verified live/repo state; left R5 `[ ]` and annotated it with the verified reason. Corrected #1's stale "status: draft" line.
- confidence: high
- alternatives: also checking R5 on the grounds the workflow exists — rejected, R5 says the ingest *runs daily*, and it demonstrably does not; leaving R7 unchecked over the raw logs in git history — rejected, R7.1/R7.2 are both met in the tree and the PRD files history retention under "Known consideration (**not a requirement**)". The owner's "Rewrite history" request is therefore new scope, routed as a proposal rather than a silent DoD failure.
- watch-next: flip R5 to `[x]` only after a scheduled (not `workflow_dispatch`) run publishes.

## 2026-09-18T01:44:00Z — session product-owner cycle 1

- decision: `spec-change proposals routed to owner (not applied)` — (1) the ratified PRD still lists "Custom domain, CDN, or any hosting other than GitHub Pages" under Out of Scope while #17 is an active owner request; (2) the owner's "Rewrite history" is outside the ratified spec's accepted "Known consideration".
- confidence: high
- alternatives: editing the Out-of-Scope list directly — rejected, §4g's carve-out is checkbox flips and stale citations only; changing the *set* of scope items is the owner's.
- watch-next: if the owner rules on either, apply it as a spec edit in that cycle and log the sign-off.
