# Muhamed actual days from November — released 1.21.0, 2026-11-01

## Owner decision and state

Bela explicitly approved 2,000 RUB per actual worked day from 2026-11-01,
flexible self-entered 5/2 schedule (not a fixed Mon–Fri calendar and not 20 paid
days each month). Owner confirmed November1 worked without QR during onboarding;
November2 is off. Next working shift and subsequent starts use the existing QR
workflow. October and Astemir compensation must remain unchanged. Do not link or
copy the two employees' schedules automatically.

Owner explicitly approved production release after the candidate review. Runtime
1.21.0 /01754da94faa719e1041cf28f36bfcc660cf307f deployed and independently
verified, exit0. Original candidate3480e41; release built on latest deploy branch
843e914 with synchronized package metadata. No DB migration, 1C change,
notification or employee access-rule change. No new scheduler or source polling.

## Production calendar only

Authenticated ADMIN /admin/workday correction UI already saved user11,
Кумыков Мухамед, November1 working and November2 off. Used the existing audited
set_schedule flow; no fabricated WorkDayEntry, QR timestamp, attendance approval
request or checkout. Astemir user10 untouched. Verified saved source/status in
actual ADMIN. These calendar records were saved before this release under1.20.10.

## Implementation

- Existing daily salary rule becomes 2,000 and requires attendance from November;
  October retains16×1,500. Existing saved FINAL runs are never rewritten.
- Existing source snapshot refresh additionally reads the unique active
  procurement WORKDAY account with the exact approved payroll binding.
- Actual valid QR starts (active/completed/missing_checkout) add one date each.
  Invalid QR/identity/duplicates fail the refresh and preserve last-good source;
  future dates, other periods and cancelled starts do not add days.
- Explicit payroll-only owner exception2026-11-01 is separate from QR provenance.
  Union of dates prevents duplicate pay if a QR later exists for the same date.
  No carry-over of that exception into December; no Google/calendar paid-day
  fallback for this employee. Plans may change through the existing calendar UI.
- Source provenance adds optional ownerConfirmedDates to existing JSON snapshot;
  old snapshots remain readable. No schema migration.
- Shared preparation used by ADMIN/current read ignores old manual20-day drafts;
  missing or wrong-period attendance stays unconfirmed, not a resurrected norm.
  Existing saved manual advance/comment preserved. No new lateness/bonus penalty.
- Existing ADMIN source note/card explains QR and November1 confirmation; removes
  stale November20-days wording. No layout change or new employee navigation.
- Salary-related access gating remains unchanged (no automatic rollout to Astemir).

## Exact changed runtime/tests

- lib/payroll-calculation-engine.ts
- lib/payroll-daily-calculation.ts
- lib/payroll-draft.ts
- lib/payroll-attendance-snapshot.ts
- lib/payroll-attendance-refresh.ts
- lib/payroll-muhamed-day-source.ts
- app/(dashboard)/admin/payroll/PayrollClient.tsx
- app/(dashboard)/admin/payroll/PayrollAttendanceSourceNote.tsx
- tests/payroll-calculation.test.ts
- tests/payroll-attendance-route.test.ts
- tests/payroll-muhamed-november.test.ts

## Verification

79 payroll regression tests;52 targeted daily/current read/snapshot/draft/1C-link
and source tests;8 actual attendance route tests pass.139 candidate tests plus5 release-metadata tests (144 total). TypeScript,
production build and git diff --check pass. Route mocks updated to supply the
existing multi-person attendance cutovers (old single-person stub was stale).
Examples: owner-confirmed November1=2,000; plus next valid QR day=4,000;
Nov2 off contributes no date by itself. Duplicate owner/QR date counts once;
October24,000 and all other payroll directory entries including Astemir unchanged.
Source read failure never writes partial attendance. Production read-only check
with actual account11, plan dates and QR rows confirms one owner-confirmed day,
rate2,000, gross2,000, no QR rows yet, October and Astemir unchanged. Physical QR
start remains future employee activity; it was not fabricated in production.
The November ADMIN screen still waits for the first closed1C source data, as
before; this release does not remove that source-readiness requirement.

Calendar screenshot: .wip/muhamed-schedule-off-20261102.png in this worktree.
Unrelated main checkout, previous identity candidate and unreleased schedule-repeat
candidate were not modified.


## Release evidence

- Server commit independently verified:01754da94faa719e1041cf28f36bfcc660cf307f.
- Public metadata and authenticated ADMIN footer:1.21.0,
  builtAt2026-11-01T17:26:15.505Z (20:26 Moscow). Existing Docker metadata still
  has revision:null/source:unknown; exact commit verified separately over SSH.
- Actual authenticated October FINAL№1 retained: Muhamed16×1,500=24,000,
  paid24,000 including advance7,500, closing0. Both original cash documents
  00OF-001901 and00OF-002011 retained. Astemir144,013.53 unchanged in ADMIN.
- Before/after hashes identical for all saved payroll runs/details, rules,
  Finbox, day reviews and employee payroll settings; env/connections/mounts
  unchanged. Public health ok and unauthenticated salary/admin source APIs401.
- Fresh1C source hash before/after:
  7cda65792d07613e245c391c10c5989b8a67ea55905b873e718cebc4945c1f5f.
- Actual November account/plan/QR and unchanged other-rule comparison hash:
  c918feabecfe11719656eeaa162fde4acd8b1015adb6b48980176e48cf98b7d7.
- Previous image:sha256:6c8832838707905eb12a0d2be808e684a487621f976ce3e38493f96d4124ebe5.
  New image:sha256:81e2cc62e0291b7cb24053bcee4fa15520096b7d2c3dfc767bdc0585f36a08cf.
  Registered only after independent verification; current plus two existing
  verified rollback images, healthy, DEPLOY_EXIT=0. Existing owner-approved
  conservative retention used for preflight; no DB/uploads/backups deleted.
- Full live local authenticated walkthrough was not performed; functional cases
  and snapshot/route failures tested; actual production ADMIN verified above.
