# Google attendance date correction — released 2026-11-02

Version **1.21.6**, runtime/server commit
`c9df3294e9383b72a9189bc66cebad57203bf75c`.
Implementation commit: `f0c409d0771ede2a28f5aa820bcf71ddb3d9a503`.
Public builtAt: `2026-11-02T18:02:58.238Z` (21:02 MSK).
Owner explicitly approved this release after reviewing the cause, tests and
preservation scope. Previous cash-recount release 1.21.5 was preserved.

## Cause and scope

The Google Form reader passed Russian DD.MM.YYYY timestamps to new Date before
checking their format. The runtime accepted ambiguous dates as MM.DD.YYYY. Liana's
original 11.02.2026 9:47:33 and 11.02.2026 19:12:18 became November 2 display marks,
although her application schedule said off and no app workday existed that day.

The source now parses Russian calendar components explicitly, validates real
dates, leap years and clock values, and normalizes display to DD.MM.YYYY / HH:mm.
Invalid/unsupported timestamps reject the source refresh instead of guessing,
rolling dates over, or quietly dropping a row. Existing source-error handling
preserves saved payroll snapshots and does not fabricate attendance. The existing
server-local display convention for unambiguous ISO timestamps is retained;
this change does not introduce a new cross-module timezone policy.

Original timestamp strings, names and source rows remain unchanged. Google
fallback remains available for a genuine mark on the selected date. No UI flow,
schedule-selection rule, payroll formula, OFD process, migration, 1C document or
stored payroll record was changed. There was no payroll recalculation/backfill.

Changed code/test files:

- lib/google-attendance-date.ts — strict source parser.
- lib/google-sheets.ts — use the parser in the existing Google reader.
- tests/google-attendance-date.test.ts — reproduction and regression coverage.
- package.json — include regression in test:workday and aligned version bump.
- package-lock.json — root/version entries aligned.

## Verification

Read-only pre-release source audit: 998 original Google marks, 390 incorrectly
normalized dates, seven source employee names, no invalid source timestamps.
Before/after Google day/lateness summaries for February–October matched because
payroll uses the original timestamp and parses Russian dates independently.
This is evidence about this date-swap defect, not a full monetary payroll audit.

Checks on the merged 1.21.5 baseline:

- test:workday: 261 + 10 passed, including prior cash-read regression and the new
  date tests. test:payroll: 79 passed. Targeted source/control/payroll checks: 75.
- test:terminal-fiscal: 282 + 2 passed, one environment-gated skip.
- Release metadata tests: 5 passed. TypeScript, production build and diff checks passed.
- Date regressions cover all 144 ambiguous day/month combinations, leap and
  invalid dates, three server timezones, real Liana source strings, retained
  genuine Google fallback, and no phantom November payroll day.

After deployment:

- Container healthy; server HEAD independently matched the runtime commit.
  Public health/metadata and employee/workday/payroll/attendance route smoke
  checks returned 200. Unauthenticated shells alone were not treated as UI proof.
- Authenticated ADMIN independently displayed version 1.21.6 and build date.
  On November 2, Liana's row shows Application, Day off, no arrival/departure;
  her detail shows Day off and No mark. Other existing app rows remain displayed.
- A fresh read of all 998 Google marks found zero Russian date mismatches.
  Liana has no Google arrival/departure on November 2; the real February 11
  arrival 09:47 and departure 19:12 remain available on February 11.
- Read-only before/after checksums matched for all **3 attendance snapshots,
  10 payroll runs, 136 payroll employee-result rows, 23 completed handovers**,
  Liana's November 2 schedule and the absence of her November 2 workday. Only
  KKM read-check metadata was excluded from the historical handover fingerprint.
  There were no changed protected objects.

All DB checks used read-only transactions. No Google rows, schedules, saved
payroll runs/results or business history were rewritten. Untracked local
.cache/output and VPS .rollback were left outside commits.

## Deployment and rollback

Only portal-app was rebuilt/restarted with server.env via the existing compose
file, serialized by the common deployment/maintenance flock. Current plus two
registered rollback images existed before building, and the initial 15 GiB disk
gate passed. After independent UI/public checks, data comparison and a fresh
source read, the new image was registered. The release job ended with exit 0.

Verified images, all inspected successfully:

- Current 1.21.6: sha256:fb0203a9c83e0220f9396efded46134816e33b1ecc913d6e0c7baa869a8318d0
- Previous 1.21.5: sha256:f1b20fd34fef34921f9efa8f2c0735927a9b0ded5826a35f8002448fbe4d9dc7
- Previous 1.21.4: sha256:534a8700cb529b39acd8fa790268750430e57e326370349bd8fcec0118451a03

The preceding image is tagged portal-app:rollback-before-1.21.6. Uploads remain
mounted at /app/uploads in offonika-portal_portal-uploads. Free disk after the
build was about 14.5 GiB; the already approved retention program was applied after
registration, retaining all three protected images and removing only eligible
unused older images/cache. It ended with exit 0, health OK and **21.4 GiB free**.
No broad system prune, volume deletion or second app restart was used.

Local evidence: output/google-date-release-20261102/production-release.log,
storage.log, release-info.json, before-1.21.5.jpg, liana-after-1.21.6.jpg and
liana-row-after-1.21.6.jpg. Source-audit evidence is in
output/liana-attendance-20261102/production-readonly-impact.json.

Documentation is committed separately from runtime code; no additional runtime
version/build is needed for this documentation-only record. A future malformed
source row was tested locally; no bad row was injected into production.
