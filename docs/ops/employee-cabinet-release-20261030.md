# Employee cabinet / Diana days — release 1.19.7, 2026-10-30

Owner explicitly approved the complete previously reviewed candidate and required
checks before deployment. Released runtime/source commit:
`b9666b91d3873c9f189b65cb6c72e4ec98f3a8d5`.
Parallel production 1.19.6 (`953ad4f`) preserved by merge; no force push.
Public and authenticated ADMIN footer show 1.19.7, build
`2026-10-29T21:52:45.570Z` (30 October 00:52:45 MSK). Docker metadata has no Git
revision because `.git` is excluded; server commit independently read back.

## Scope and preservation

- ADMIN Astemir Phone/Computer selector; actual mobile/desktop app frames and
  all three Procurement/Day/Schedule tabs stay in actor-bound inspection.
- PWA stylesheet first-paint loading, route prefetch/pending feedback, selected
  copper Procurement icon and inactive outline; no financial caching change.
- Correct colleague first name and factual no-shift attendance times.
- Diana alone may edit past October 2026 calendar days while October is current.
  Existing PWA plan remains separate from QR attendance and payroll sourcing.
- Diana payroll day sources: real app start, otherwise a working day in Google
  schedule. Date counts once; prior months unchanged. Source-refresh failures
  preserve last-good snapshots; no separate Diana salary layout introduced.
- Salary formulas/bonuses, manual corrections/advances/lateness, other employees,
  final payroll runs, 1C client/financial APIs, schema/migrations, compose/env,
  and desktop financial layout unchanged. Production source refresh or salary
  save was not manually executed as a release test. Missing Diana Finbox/manual
  inputs were not invented or filled.

## Reserve gate and recovery

Initial attempt stopped before checkout/build/restart: registered 1.19.3 image
`sha256:537f1682cf5c083b6bf59cf4a02413891dd0b143bd7506076b89d649076d1ff9`
was absent. No cause inferred. Used the previously owner-approved exact-source
recovery procedure, rebuilding 1.19.3 from `2c1d4961e1eb7fed8ce3a87dcd73092d2243e06a`.
New verified reserve image:
`sha256:2503548be5569d6cf527d94759a1c13d5bc2fc87359e7d7478ec5d87138e06a4`.
Seven isolated checks passed: health, release metadata, login, employee/admin
unauthenticated redirect behavior and protected employee/admin APIs returning401.
Disposable internal network and tmpfs PostgreSQL used; no production DB or 1C.
Prior verified 1.19.2 image was also checked. Original registry backed up as
`verified-images.before-procurement-recovery-20261030.json`.

Current 1.19.7 image:
`sha256:c79e6e7966103bff46324e78ea4aff60365a53287b5c3f431a0a0d032594ebd0`.
Two retained verified reserves: 1.19.6 image
`sha256:71c972d5d0fdc7d747f98611ff01f559f5641faacaffacc58a35b971a9ac558b`
and the rebuilt 1.19.3 image above. Serialized with the storage flock. Current
image registration followed independent server/public/authenticated UI checks.
Conservative approved maintenance completed: 24.37 GiB free, exit0. Uploads,
financial/planning volumes and unrelated containers preserved. No pending
migrations before restart; no migration delta in this release.

## Verification

- 39 focused source/snapshot/route/permission/navigation/workday checks,
  78 payroll regressions and five release-info tests passed.
- TypeScript and full production build passed after merge/version bump.
- Isolated real HTTP calendar save restored original fixture rows afterwards;
  other employee/September edits refused, QR facts and payroll runs/drafts/source
  snapshots unchanged. Six device/tab reads and actor-auth/mutation guards pass.
- Production health200; employee/procurement/admin workday/payroll shell routes200,
  unauthenticated employee workday API401; no persistent500 observed.
- Authenticated production: ADMIN footer version7; Diana October1 editor opens
  with Working/Off choices and cancels without write; Zukhra October1 has no edit
  action. Astemir Phone/Computer, three tabs, saved financial requests/1C source
  dates and selected icon computed fill verified. No financial submission.
- Physical-phone camera, push delivery and zero-latency device benchmark were not
  repeated; those existing limitations remain explicit. Muhamed's original masked
  one-time access dialog remains open, no password reset or credential copying.
- Unrelated untracked node_modules/uploads links and local mobile harness excluded.

Local evidence: `/tmp/mobo-recover-and-release-1.19.7.log` (final
`RECOVERY_AND_DEPLOY_EXIT=0`), `/tmp/mobo-1.19.7-*` checks. Screenshots in the current
visualization directory: `diana-october-released-1.19.7.png` and
`astemir-phone-released-1.19.7.png`.

## Exact release file delta against production 1.19.6

- `app/(dashboard)/admin/employees/preview/[visitId]/page.tsx`
- `app/(dashboard)/employee/EmployeeTodayClient.tsx`
- `app/api/employee/workday/schedule/bulk/route.ts`
- `app/api/employee/workday/schedule/route.ts`
- `components/EmployeeInterfaceStyle.tsx`
- `components/EmployeeNavigation.tsx`
- `components/EmployeePreviewProvider.tsx`
- `components/EmployeePreviewViewport.tsx`
- `components/ProcurementShell.tsx`
- `components/procurement-mobile-shell.css`
- `docs/codex-memory/diana-days-candidate-20261030.md`
- `docs/codex-memory/employee-preview-devices-candidate-20261029.md`
- `docs/codex-memory/procurement-employee-activation-20261029.md`
- `docs/codex-memory/project-index.md`
- `lib/diana-october-schedule.ts`
- `lib/employee-navigation.ts`
- `lib/payroll-attendance-refresh.ts`
- `lib/payroll-diana-day-source.ts`
- `lib/work-schedule-coverage.ts`
- `lib/workday-presence.ts`
- `package-lock.json`
- `package.json`
- `public/pwa-copper.css`
- `tests/diana-october-schedule.integration.test.ts`
- `tests/diana-october-schedule.test.ts`
- `tests/employee-navigation.test.ts`
- `tests/payroll-attendance-route.test.ts`
- `tests/payroll-diana-day-source.test.ts`
- `tests/work-schedule-coverage.test.ts`
- `tests/workday-presence.test.ts`
