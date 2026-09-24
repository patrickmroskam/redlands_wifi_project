# Redlands Wifi Project — release readiness

*Cycle 22 · 2026-09-24T05:2xZ · PRD `ratified` (R9.4 amended 2026-09-23) · constitution in force*

## Burndown: v1 is 10/10 done. R10 has shipped. One post-v1 issue is open.

All ten Release Criteria have been met since 2026-09-21. R10 (#65) shipped 2026-09-23 as PR #72.
The owner answered **`mac`** to ask `msg_18000c3c…`. That ratified the R9.4 full-six-octet-MAC
amendment and declined ingest-on-upload. Cycle 21 filed **#73** (`p3`) to enforce the rule in
`load_flock_rules()` and the constitution. Cycle 22 committed the ratified R9.4 text to the PRD.

## The dev team is OFF, and this cycle left it off

#73 is workable: `p3`, unassigned, no exclusion label. Normally that re-enables
`autonomy-dev-team-redlands-wifi-project`. **This cycle did not re-enable it**, for two reasons:

1. Cycle 21's re-enable call **never landed**. The permission prompt aborted (20:42Z), and the owner
   then took over that session interactively.
2. By this run, the **product-owner routine itself reads `enabled:false`**, and so do both No Mylar
   routines. None of the autonomy routines disable themselves, so this looks like an owner pause.
   Turning on a worker against a pause is the wrong call.

For the owner: turn `Dev team — Redlands WiFi Project` back on when you want #73 built. It is the
only workable item.

## Tonight's ingest will publish the new log and then show red

The owner uploaded `wardrive_0.log` and `wardrive_poi_0.gpx` at 21:48Z. A dry run over the inbox
adds **1,941 networks + 1,548 Bluetooth, 0 Flock**. The `.gpx` is an empty GPX stub (header only,
no points). Per R4.10 the job keeps it, names it, and exits non-zero, so the run goes red **after**
it publishes the log. It stays red every night until the file is gone. Per R7.2, keeping the inbox
free of non-logs is the owner's job. **One action clears it: delete `wardrive_poi_0.gpx` from
`redlands_wifi_inbox`.** Teaching the ingest to skip `*.gpx` would be new scope. The owner turned
down that question in-session at 04:16Z, so it is not being re-asked.

## Parked, correctly — no action implied

| issue | tier | why it is parked |
|---|---|---|
| #63 | `p2` `needs-human` | Rewrite 48 pre-cutover logs out of public git history. Destructive, so the owner runs it. |
| #17 | `p3` `blocked` `needs-human` `po-closure-proposed` | **Takeover window CLOSED.** DNS is now at Cloudflare, with no apex `A` and no `www`. Closure proposed as `resolved-by-owner` (maker-checker: the PO does not close it). |
| #21 | `p3` `blocked` `needs-human` | Optional GitHub security settings. |
| #1 | tracking | The v1 umbrella. |

Evidence: `gh issue list --state open --json number,labels,assignees` returns #73 `[p3]` with 0
assignees; #63 `[p2,needs-human]`; #21 and #17 `[p3,blocked,needs-human]`; #1 `[tracking]`.

## Convergence tripwire

**Not tripped.** 37 issues have been filed and 5 are open. #73 is owner-ratified scope, not
self-generated work.
