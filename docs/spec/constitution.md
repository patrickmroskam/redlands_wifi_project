# Redlands WiFi Project — Constitution (invariants + config)

## Label taxonomy
| Label | Meaning |
|---|---|
| `p0`..`p3` | Priority tiers (p0 highest). The PO owns these. |
| `launch-blocker` | Blocks v1 launch. Never closed without human sign-off. |
| `po-closure-proposed` | PO-internal: this issue has an open closure proposal (see closure-handshake). |
| `tracking` | A tracking/parent issue — never assigned; descend to sub-issues. |
| `blocked` / `waiting` | Not workable yet. `waiting` = waiting on the human (see Human-in-the-loop protocol). |
| `needs-triage` | Flagged for human/PO re-evaluation. |
| `needs-human` | Parked for the human: no actor can move it (account/registrar/settings work, or a decision already deferred). Excluded from every `dev-team` tier search and claim gate, and skipped by the PO's blocked-queue sweep. Added by the PO; removed when the human acts. Parking is not dropping — the readiness report surfaces the count. |
| `stakeholder` | Issue filed by the `stakeholder` actor from an acceptance run (its dedup scopes by this label). |
| `qa` | Issue filed by the `qa` actor from a regression dogfood of recently-shipped features (its dedup scopes by this label). |
| `demo-gallery` | Marks the single pinned issue the `stakeholder` updates with the keyed demo-clip gallery (when `capture_demo` is on). |
| `readiness-artifact` | Marks the single pinned readiness-queue issue (`readiness-report`, carrying the `<!-- READINESS-QUEUE -->` marker). `digest-reconcile` excludes it from issue counting. |
<!-- `closure-objection: <reason>` is a COMMENT convention, not a label. -->

## Hard invariants (no actor may violate)
- Never auto-close a `launch-blocker` issue — route to the human digest.
- Never close on an `obsolete` / `low-ROI` verdict without dev-team or human adjudication.
- **This repo is PUBLIC.** Never commit secrets, `.env` files, API keys, or tokens. A leaked `.env` was purged on 2026-09-16; do not reintroduce one.
- **GitHub Pages settings are fixed:** build_type `legacy`, source `main` branch, path `/` (site served from the repo root at https://patrickmroskam.github.io/redlands_wifi_project/). Do not change Pages settings or move the site out of the repo root without human sign-off — doing so would require a human step.
- **The raw-log inbox is transient.** Never store fixtures, code, or the database there; the pipeline deletes what it processes. Never delete a file it could not parse. Since #30 the inbox is the PRIVATE repo `patrickmroskam/redlands_wifi_inbox`; this repo's `ingest/` is retired and kept empty.
- **Everything outside ZIP 92373 / 92374 is dropped, never stored** in `data/networks.json`.
- **Dedupe key is the BSSID (MAC).** An existing record is never overwritten by a re-observation.
- **No accounts, cookies, analytics, or third-party trackers** on the site.
- **Never push the raw wardrive logs anywhere public.** They go only to the private inbox repo `patrickmroskam/redlands_wifi_inbox` (owner ruling on #22, option C; ratified in the `private-inbox` ask). Raw logs show the drive route, so a log in this public repo is a privacy incident, not a tidiness problem. The 48 logs pushed before the cutover remain in this repo's git history; rewriting that history is its own issue and its own review.

## Human-in-the-loop protocol (HARD — every actor follows it)
The owner asked to be involved only when something genuinely needs them, and then with
instructions "like I am 5". When a task cannot proceed without the human — account or
billing settings, secrets, DNS, purchases, changing GitHub Pages settings, anything that
is not a file in this repo or a GitHub Actions workflow — do ALL of the following and stop:
1. Write `docs/setup/<slug>.md`: numbered steps, one action per step, exact URLs and
   button names, no jargon, and a final line: `When you're finished, reply on OH HAI with: DONE <slug>`.
2. Add the `waiting` label to the blocked issue and comment with a link to that doc.
3. Send an OH HAI **ask** (`~/.local/nodejs/bin/oh-hai ask submit ...`) whose body is the
   full step list from the doc. Record the returned message id in the issue comment.
   Never retry a send; verify prior sends from the hub (`oh-hai messages list --json`).
4. **Skip the blocked issue and continue with the next unblocked one.** Do not stop the
   routine for it. **Only** when no unblocked p0-p3 issue remains at all, disable the
   dev-team routine: `update_scheduled_task` with
   `taskId: autonomy-dev-team-redlands-wifi-project`, `enabled: false`, and exit.
   *(Amended 2026-09-20 by owner ruling. The previous rule halted the entire routine for any
   live `waiting` issue, which parked three unblocked p3s — #25, #29, #34 — for ~70 h behind
   one owner-only setup task (#30) that nothing in them depended on. A human gate on one
   issue is not a reason to stop work on unrelated ones.)*
Resume path: whichever actor (product-owner run, or a human-driven session) sees the
human's `DONE <slug>` reply removes `waiting` from the issue. If the routine was disabled
because the backlog was genuinely empty of unblocked work, that actor also re-enables it
(`enabled: true`). The product-owner routine checks for this at the start of every run.
Do NOT pause for things that are already true: Pages is enabled, Actions is enabled,
map tiles need no key, and the removal-request channel is GitHub Issues (no email needed).

## Per-project config
- default_branch: main
- base_branch: main
- spec_path: docs/spec/PRD.md
- site_url: https://patrickmroskam.github.io/redlands_wifi_project/
- ingest_dir: the private repo `patrickmroskam/redlands_wifi_inbox` (checked out to `inbox/` by the ingest job; `ingest/` in this repo is retired)
- inbox_repo: patrickmroskam/redlands_wifi_inbox   # private; key is INBOX_TOKEN in the `ingest` environment, which allows only `main`
- database_path: data/networks.json
- boundary_path: data/redlands-boundary.geojson   # ZCTA polygons for 92373 + 92374 (US Census)
- e2e_command: npx playwright test               # browser smoke test (R8.2); set up by the scaffold issue
- ci_command: python3 -m unittest discover -s tests -v && npx playwright test
- verification_harness: browser
- ci_local_fallback: false
- reuse_ci_e2e: false
- ci_e2e_workflow: <unset>
- ci_e2e_artifact: <unset>
- capture_demo: false
- demo_upload: none
- stack: static HTML/CSS/JS (Leaflet via CDN, no build step); Python 3 stdlib-only ingest script; GitHub Actions for the daily job and CI; GitHub Pages hosting
- raw_log_format: WiGLE CSV 1.4 (ESP32 Marauder)
- notify_channel: OH HAI (`~/.local/nodejs/bin/oh-hai notify --body "..."`) — exactly one notify at the end of every scheduled run

## Tunable constants (defaults — tune against real cadence)
- closure_aging_window_hours: 48
- digest_consolidation_depth_cap: 3
- digest_full_rebuild_every_cycles: 10
- net_open_tripwire_k: 3        # flag the human if net open count rises K runs straight
