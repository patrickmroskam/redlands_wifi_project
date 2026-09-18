# Redlands Wifi Project — PO task backlog (process queue, FIFO)

## Open

- [ ] (2026-09-18) Aging sweep on #22's closure proposal. — Done when: after 2026-09-20T01:42Z (48 h `closure_aging_window_hours`), #22 is either self-closed with verdict `addressed-in-#30` (no post-proposal `closure-objection:` comment, #30 still open and carrying option C) or a `recorded-objection` exists in the decision log *and* `objections.md`, with `po-closure-proposed` removed either way.
- [ ] (2026-09-18) Split #17 into the p1 takeover mitigation and the out-of-v1 domain switch. — Done when: either a separate issue exists covering only "verify the domain on the GitHub account **or** remove the apex `A` / `www` `CNAME` records", with #17 retitled to the switch alone; **or** the exposure is gone (a `_github-pages-challenge-patrickmroskam` TXT resolves, or the apex `A` records no longer point at 185.199.108-111.153) and #17 is back at p3. Blocked until a cycle realizes ≥ 1 close (§4e net-issue-delta budget).
- [ ] (2026-09-18) Re-run the objective #30 resume gate every cycle. — Done when: each cycle's decision log records the result of all three checks — `gh repo view patrickmroskam/redlands_wifi_inbox`, an `ingest` entry in `repos/…/environments`, and `actions/secrets total_count > 0` — rather than an interpretation of the ask reply.
- [ ] (2026-09-18) Chase #21 (p3, owner-only GitHub security settings). — Done when: #21 is closed, or it carries a comment recording that its steps reached the owner through the hub (no ask has ever been sent for it), or the PO has folded it into another owner message.

## Done

- [x] (2026-09-18) Bootstrap the continuity artifacts (digest, decision log, PO tasks, objection ledger).
- [x] (2026-09-18) Clear `needs-triage` from #22, as the 2026-09-17 09:09Z comment requested.
