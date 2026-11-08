# Source recovery — local candidate, 2026-11-08

Owner requested fixes for remaining AUSN, financial forecast and T-Bank health
failures while preserving processes. Explicit additional approval: include the
current АЛЬФА-БАНК settlement account in owner forecast funds. No new production
release/host installation approval yet. Portal candidate c9495f693c57496e8687c33040f0a31e684fc89a; AUSN
host files 5213654e7972a48029496e8d5647004ac79c5774, based on exact live reporting
source7b88015. Installed AIAgentAPI443 and report calculator remain unchanged.

## Findings and defined changes

1. Forecast refused to persist because the old six-account set omitted Alfa,
   required a zero VTB row which the 1C register report deliberately omits, and
   flagged the already-excluded expense safe as newly discovered owner money.
   Owner approved Alfa addition. Keep existing accounts; prove VTB zero only by
   a complete dated empty statement scoped to its independently verified canonical
   UUID. Missing/general/truncated/stale/wrong-reference responses never prove0.
   Expense safe stays excluded; newly named owner-like accounts still block.
   ADMIN aggregate includes Alfa once; payment routes, commissions, salary
   formulas, reserves and approval workflows unchanged.
2. Active aQsi reads for both terminals were complete, while dependency watchdog
   probed the unused legacy API and an old disabled-cabinet incident stayed active.
   Probe actual configured acquiring source through the fiscal reader. Fail if
   any mapping is invalid or any terminal incomplete. Existing recovery lifecycle
   confirms old incidents only after successful actual-source reads. Keep history,
   legacy diagnostics, current notification policy and both bells.
3. Old twice-daily AUSN service invoked strict uncached owner CLI with10-minute
   service budget. Existing portal background helper already uses validated raw
   source windows, late-change rotation and fail-closed publication. Scheduled
   wrapper uses that existing helper, retains same schedule/user/protections, adds
   only existing private source-cache write path and uses the existing portal
   background budget30min. Strict owner/manual CLI unchanged. No new daemon.
4. Root cause of observed AUSN source refusal: Platforma returned retryable504
   OFD_PROVIDER_TIMEOUT for13August on one KKT, so monthly endpoint503 was correct.
   Saby August was complete12/12. Adaptive reader splits only provider-confirmed
   retryable timeouts into contiguous half-windows, at most down to3h, sequential
   within each existing two-worker job. Every part and receipt schema must be
   complete; no skipped checks, guessed amounts or fallback to incomplete data.

## Evidence

- 80 focused forecast/dependency tests,18 OFD/window/policy tests,80 payroll
  regression tests and34 Python background/strict-runner tests pass. Counts
  overlap. TypeScript, production build and diff checks pass. Initial added
  fixture typing issue was corrected before final build.
- Candidate money reader on live read-only1C: complete seven positions, no source
  warnings, addressed VTB zero. Six nonzero positions independently match
  /money-balances. No raw monetary amounts/credentials stored in this note.
- Actual aQsi reads returned complete data for both configured terminals. Old
  cabinet flag isfalse; legacy API transport failure remains diagnostic evidence,
  not a dependency of the active fiscal path.
- Live Platforma test: complete full-day baseline19 receipts. Synthetic initial
  timeout forced branch; actual12:00–24:00 response then independently returned504.
  Smaller real windows00–12,12–18,18–24 returned4+11+4 receipts. Exact normalized
  records including monetary fields equal the full-day baseline. No app code was
  installed for this one-off read-only candidate-function check.
- Existing background helper tested in an isolated transient service under
  ausn-report with restricted filesystem access. First run failed closed on
  upstream503, retaining prior complete reports. After source recovered, full
  and current pair completed with explicit AUSN_FULL_CURRENT_SUCCESS marker.
  Readback: available full report17:10:27UTC, current17:13:29UTC, both source
  code7b88015, source-window evidence16/19, refresh policy fresh. This was normal
  report/cache refresh, not installation of candidate code or a financial action.
- Collected transient unit default Result=success is not proof of completion;
  rely on explicit success marker and independent report readback.

## Ready operating scope, pending approval

Prepare the next portal patch from current live/branch version immediately before
release; do not reserve a number. Preserve current plus two verified images and
boot the previous artifact independently. Install only the two reviewed AUSN host
files, back up exact originals, retain manual CLI/timer hashes and all existing
sandbox protections, run the ordinary full/current service and financial snapshot
refresh, independently read back results and normal source-health recovery.
No migration, manual production DB edit, 1C/FNS write, payment, Telegram send or
VPN/security setting change. Normal already-configured background delivery may
continue under existing application policy.

Prepared reviewed host scripts (not executed):
/tmp/mobo-source-recovery-20261108/install-ausn.sh and rollback-ausn.sh.
Installer verifies original wrapper/service/timer and staged SHA256, refuses a
concurrent active refresh or unknown override, preserves strict CLI and timer.
Rollback restores exact wrapper/removes only the matching new override; preserves
reports and validated raw source snapshots. Portal rollback uses prior image;
schema unchanged. Recheck source identities and hashes at installation.

Current permanent service/portal files are still unchanged;1.22.2 remains live.
Forecast snapshot persistence under new code, timer health recovery and desktop/
PWA production checks remain release-stage verification, not yet claimed passed.
Main portal192 and AI workspace296 pre-existing dirty entries were left alone.

## Exact candidate files

- `lib/acquiring-dependency-probe.ts`
- `lib/ausn-ofd.ts`
- `lib/platforma-receipt-window.ts`
- `lib/procurement-admin-forecast.ts`
- `lib/procurement-cash-forecast-one-c.ts`
- `lib/procurement-cash-forecast-source.ts`
- `scripts/dependency-watchdog.ts`
- `tests/acquiring-dependency-probe.test.ts`
- `tests/ausn-ofd-window-transport.test.ts`
- `tests/platforma-receipt-window.test.ts`
- `tests/procurement-cash-forecast-source.test.ts`
- `tests/procurement-funding-integration.test.ts`

AUSN worktree `/Users/bela/Projects/ausn-source-recovery-20261108`:

- `tools/ausn-monthly-control/ausn_cache_refresh_test.py`
- `tools/ausn-monthly-control/deploy/ausn-report-cache-refresh`
- `tools/ausn-monthly-control/deploy/ausn-report-cache-refresh.service.d/90-background-source-windows.conf`


## Production checkpoint —2026-11-08, verification incomplete

This supersedes the candidate-only status above. Owner explicitly approved the
new portal release and AUSN task installation, rollback and post-release checks.

- Portal1.22.3 is live at source78d7446393ea4a33637bb4aa6ee1e5513f3e1aa2,
  build2026-11-08T19:26:58.555Z, healthy image
  sha256:b2af4d1f7df016a05c51b7aeac7099da06cecf7206a4b26326aa9366ba53feea.
- Prior1.22.2 image was boot-tested in isolation. Configuration/payroll/upload
  preservation, identical env and sorted mounts passed after restart. No new
  production migrations. New image is NOT yet registered verified.
- Natural watchdogs recovered both T-Bank sources and forecast service; desktop
  System shows only AUSN technical failure. Forecast readback of seven accounts,
  Alfa once and explicitly confirmed VTB zero still requires final verification.
- The permanent AUSN task failed. Original full/current background helper had a
  shorter180-second monthly OFD HTTP budget inside its720-second report budget.
  Runtime source05b333b631dd343e5adf10bddc05a7a82300a261 now applies600 seconds
  only to background reads; strict owner default stays180.89 Python tests passed,
  one skipped. New immutable runtime's39 Python source hashes verified; previous
  runtime7b8801588014f1e69ec271ee98fed53ae6224d2d retained for rollback.
- No sandbox protections were weakened, and source cache identity/revalidation
  was preserved. New code identity requires cold source revalidation.
- Subsequent strict-sandbox trace failed on April2026 OFD HTTP503. A separate
  read-only April diagnostic started20:00:21UTC and remained running after ten
  minutes.600 seconds alone is NOT established as sufficient. Do not claim AUSN
  recovered until actual scheduled full/current succeeds and published reports
  read back correctly. Last complete reports are retained, never partial totals.
- Reporting current symlink changed to05b333b; telegram-current stays556fcaf.
  No1C extension changes or financial actions. Host wrapper/drop-in rollback and
  runtime symlink rollback are prepared in private server staging.
- Desktop authenticated version1.22.3 observed. Original installed iPhone PWA
  Control/menu/scroll dock checks passed so far; final visible phone version and
  re-entry verification remain incomplete because Mirroring relocked.
- Two limit predictions in the bell conflict with the approved documentary tax
  view (AUSN ended1October). Exact proposed lifecycle correction was presented
  for separate owner approval; NOT implemented. Other document reminders remain.
- Private staging:/home/bela/mobo-source-recovery-1.22.3; rollback backup:
  /root/mobo-source-recovery-1.22.3-20261108. release.sh exited1 at initial AUSN
  verification, so use reviewed scoped finalization after all checks; no blind
  rebuild/restart or premature verified-image registration.
- Main portal and original AI workspace unrelated dirty files remain untouched.
