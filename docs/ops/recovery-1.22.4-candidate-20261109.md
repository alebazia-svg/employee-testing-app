# Recovery1.22.4 — reviewed candidate, not production approval

## Current production and remaining source fault

Portal1.22.3, source78d7446393ea4a33637bb4aa6ee1e5513f3e1aa2,
image sha256:b2af4d1f7df016a05c51b7aeac7099da06cecf7206a4b26326aa9366ba53feea
is healthy. T-Bank's two incidents and financial snapshot incident recovered
through normal watchdogs. Independent readback confirms seven owner accounts,
Alfa exactly once, scoped VTB zero and all four core forecast sources complete.
The original dirty portal/AI workspaces were not edited.

AUSN remains degraded. Saby April read returned70 receipts, complete. Platforma
returned provider-timeout504 for April day/3-hour/15-minute windows, August13
(previously successful) and both KKT current-day probes. KKT list remains
available; subscriptions are current. A diagnostic using the actual private
server runtime configuration and35-second client budget reached the Mac
channel's30-second upstream failure (502); it did not recover receipts.
No token/config content was copied off the server or logged. The temporary
40-minute April diagnostic was stopped by exact PID/start/command identity.
No production process, tax total, financial operation or message was altered.

## Exact owner-approved differences

1. After the same verified documentary review used by Taxes confirms AUSN
   termination, forward limit predictions leave active attention but retain
   their original text/date in History. Tax-document reminders, the original
   comparison model and the existing exceeded-limit fact signal remain.
   Missing/invalid/unavailable proof never retires an active warning.
2. Add up to three retries15minutes after a failed scheduled AUSN refresh.
   Initial attempt plus retries are limited to four starts within3hours.
   The primary daily timer, full/current calculation, cache identity,
   completeness gate, sandbox and strict owner CLI remain unchanged.
3. Necessary safety for those retries: propagate caller cancellation and a
   540-second endpoint deadline to active/queued Platforma reads. The client
   allows600seconds, report process720seconds and paired service30minutes.
   Cancellation produces incomplete output, never a complete empty source.
4. Only the AUSN host health check changes: a running/retrying refresh cannot
   count as completed recovery. Other unit-health behavior is unchanged.

Portal code858feefd40609206fec97dfea40000697cbbe8bd; notification change7aa5d86.
Host policy source28de802e31f991f47aca24cfa330807d81254a72 in the separate
AUSN worktree. Installed reporting runtime stays05b333b; policy-only installation
does not relabel source caches or change the report code identity.

## Verification

- TypeScript and final1.22.4 production build passed; metadata5/5.
- Tax/reminder/model tests20/20; OFD windows/cancellation12/12.
- Actual HTTP cancellation through the built Next app and isolated HTTP source:
  both active requests cancelled, zero queued reads started afterwards.
- Actual Linux host-script fixture: pending/active/failed AUSN cannot recover;
  completed success can. Other forecast health check remains unchanged.
  Local macOS Bash3 cannot execute this Linux associative-array script;
  that local case is explicitly skipped and passed on VPS Bash5 instead.
- Real systemd transient fixtures: permanent failure executed four times then
  stopped; recovery after two failures stopped on the third successful call.
  Intervals were scaled to1second for the test; production interval is15minutes.
- Python90 tests passed, one pre-existing fixture-dependent skip.
- Authenticated real local app with isolated synthetic database demonstrated
  three active notices without proof, one document notice after proof, and
  retained original warning text/dates in History. Desktop and390x844 checked;
  viewport restored. Visible IAB preview:http://127.0.0.1:3287/admin/inbox.
- Physical iPhone installed-PWA verification of this new candidate is pending.
  Earlier1.22.3 Control/menu/scroll checks passed, final visible phone version
  was not observed after Mirroring relocked. Do not claim new device success.

## Reviewed release/rollback plan — still needs operations approval

Prepared private local scripts:/tmp/mobo-recovery-1.22.4. They have not run.
Build onlyportal-app from the exact approved commit usingserver.env; no new
migrations, env changes, manual DB changes, upload changes or1C publication.
Preserve configuration/payroll/uploads and original tax-notice text/date hashes;
independently check public metadata, source commit, authenticated UI and sources.
Install only91-bounded-recovery.conf after the guarded app image is healthy.
Main service/timer/strict CLI and90-background-source-windows.conf stay intact.

1.22.3 is still unregistered because its original all-sources recovery gate was
not met. A continuation while Platforma is unavailable requires explicit owner
acceptance of that degraded source state. It does NOT permit marking AUSN
recovered: keep its warning until a real completed full/current pair succeeds.
Prepared continuation accepts only the exact known pending1.22.3 image/commit,
checks all three existing verified reserve images and retains1.22.3 separately
under a protected temporary hold tag. General maintenance guards are unchanged.
Only after independent app/failure-state verification may1.22.4 be registered;
normal retention keeps current plus two already verified reserves, with the
pending prior1.22.3 artifact additionally held for rollback. Verify free disk.

Rollback removes only the matching new91policy before restoring the actual
prior1.22.3 image/source. Reports/source snapshots remain intact. Both the actual
previous image and policy rollback are checked before restart. Restoring the
pending prior artifact must be reported as pending, never silently registered
as fully source-recovered. No broader cleanup or security weakening is allowed.

## Exact portal files since production1.22.3

- app/api/internal/ausn/ofd-receipts/route.ts
- lib/admin-inbox-data.ts
- lib/ausn-ofd.ts
- lib/tax-attention-reminders.ts
- lib/tax-document-reminders.ts
- lib/tax-management-review.ts
- ops/systemd/run-offonika-infrastructure-watchdog.sh
- package.json
- package-lock.json
- tests/ausn-infrastructure-recovery.test.cjs
- tests/ausn-ofd-window-transport.test.ts
- tests/tax-attention-reminders.test.ts
- tests/tax-limit-reminders.test.ts
- tests/tax-management-review.test.tsx
- docs/codex-memory/decision-log.md
- docs/ops/source-recovery-candidate-20261108.md
- docs/ops/recovery-1.22.4-candidate-20261109.md

Separate host source files:
- tools/ausn-monthly-control/deploy/ausn-report-cache-refresh.service.d/91-bounded-recovery.conf
- tools/ausn-monthly-control/ausn_cache_refresh_test.py
