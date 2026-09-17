# Redlands WiFi Project — Constitution (invariants + config)

## Label taxonomy
| Label | Meaning |
|---|---|
| `p0`..`p3` | Priority tiers (p0 highest). The PO owns these. |
| `launch-blocker` | Blocks v1 launch. Never closed without human sign-off. |
| `po-closure-proposed` | PO-internal: this issue has an open closure proposal (see closure-handshake). |
| `tracking` | A tracking/parent issue — never assigned; descend to sub-issues. |
| `blocked` / `waiting` | Not workable yet. |
| `needs-triage` | Flagged for human/PO re-evaluation. |
| `stakeholder` | Issue filed by the `stakeholder` actor from an acceptance run (its dedup scopes by this label). |
| `qa` | Issue filed by the `qa` actor from a regression dogfood of recently-shipped features (its dedup scopes by this label). |
| `demo-gallery` | Marks the single pinned issue the `stakeholder` updates with the keyed demo-clip gallery (when `capture_demo` is on). |
| `readiness-artifact` | Marks the single pinned readiness-queue issue (`readiness-report`, carrying the `<!-- READINESS-QUEUE -->` marker). `digest-reconcile` excludes it from issue counting. |
<!-- `closure-objection: <reason>` is a COMMENT convention, not a label. -->

## Hard invariants (the PO must never violate)
- Never auto-close a `launch-blocker` issue — route to the human digest.
- Never close on an `obsolete` / `low-ROI` verdict without dev-team or human adjudication.
- Never commit secrets: no `.env`, API keys, or credentials in the repo (this repo is PUBLIC; a previously committed `.env` was purged on 2026-09-16).
- <project/compliance-specific invariants — TODO, fill once the product is defined>

## Per-project config
- default_branch: main
- base_branch: main
- spec_path: docs/spec/PRD.md
- e2e_command: <TODO — consumed by acceptance-run / stakeholder / qa>
- ci_local_fallback: false
- ci_command: <TODO — the local command that runs the FULL CI suite>
- reuse_ci_e2e: false
- ci_e2e_workflow: <unset>
- ci_e2e_artifact: <unset>
- capture_demo: false
- demo_upload: none

## Tunable constants (defaults — tune against real cadence)
- closure_aging_window_hours: 48
- digest_consolidation_depth_cap: 3
- digest_full_rebuild_every_cycles: 10
- net_open_tripwire_k: 3        # flag the human if net open count rises K runs straight
