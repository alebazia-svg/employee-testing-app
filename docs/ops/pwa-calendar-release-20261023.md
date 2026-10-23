# PWA calendar release 1.14.0 — 2026-10-23

Owner explicitly approved production release of the compact calendar, working-day
selection, incomplete-plan shift options and calendar notification lifecycle.
Expense scope is short copy only; cashbox/applicant/1C changes are deferred.

## Source and target

- Runtime: `cc22f7a5a9eaadc469f4eb7a9407e98f70336bf6`.
- Previous runtime: `ee56be92b697928f024e44d35e2e190e5faf0a36`, 1.13.15.
- Target: `/docker/employee-testing-app`, `origin/design-local-updates`, portal-app.
- Public host: https://portal.alebazia.xyz.
- Package and both package-lock versions: 1.14.0.
- No Prisma, compose, Dockerfile, environment or upload changes; no migration.

## Checks before deployment

- 169 workday tests, 2 attention-card checks, 5 release metadata checks passed.
- Production-mode build, TypeScript and diff checks passed.
- Real isolated PostgreSQL/API checks: automatic date-specific recipients;
  reading vs answering; explicit off response; vacation/inactive/other-department
  exclusions; stale 409 with no overwrite; retirement and reopening;
  31-day bulk save with atomic stale rejection; legacy digest per-date answers.
- Previous real QR-intent check: all three retail/wholesale shift options for
  an incomplete department plan, without starting a shift.
- Measured CSS viewports 375×812, 390×844, 430×932: calendar cells 52px,
  roster rows 32px, main calendar button 36px, dock about 72px; no horizontal
  overflow. Browser fractional rounding below 0.5px. Edit and cancel checked.
- Shared stylesheet URLs now use the existing app version; no separate
  version label was introduced. This prevents reuse of an old stylesheet URL,
  without claiming it proves the cause of a previous physical-device defect.

## Verification limits

Physical iPhone Safari/PWA, actual camera scanning and device push delivery are
not tested in this release. Local financial examples use an ignored fixture
proxy and are not production records. No test writes are made to production
schedules, workdays or 1C. Existing unrelated primary-checkout changes are untouched.

## Exact runtime/test files

- `app/(dashboard)/employee/CashIssueClient.tsx`
- `app/(dashboard)/employee/EmployeeTodayClient.tsx`
- `app/api/employee/workday/schedule/bulk/route.ts`
- `app/api/employee/workday/schedule/route.ts`
- `components/EmployeeInterfaceStyle.tsx`
- `components/workday/EmployeeAttentionPanel.tsx`
- `lib/employee-action-reminder.ts`
- `lib/employee-attention-snapshot.ts`
- `lib/employee-attention.ts`
- `lib/employee-notice-icons.ts`
- `lib/employee-schedule-attention.ts`
- `lib/employee-schedule-snapshot.ts`
- `lib/work-schedule-bulk.ts`
- `lib/work-schedule-notifications.ts`
- `lib/work-schedule-persistence.ts`
- `lib/workday-colleague-shift.ts`
- `lib/workday-notifications.ts`
- `lib/workday-shift-selection.ts`
- `package-lock.json`
- `package.json`
- `public/pwa-copper.css`
- `tests/employee-attention-card.test.mjs`
- `tests/employee-schedule-attention.test.ts`
- `tests/work-schedule-bulk.test.ts`
- `tests/work-schedule-notifications.test.ts`
- `tests/workday-attendance-shadow.test.ts`
- `tests/workday-colleague-shift.test.ts`
- `tests/workday-notification-lifecycle.test.ts`

## Production verification completed

- Server HEAD independently read through SSH: `cc22f7a5a9eaadc469f4eb7a9407e98f70336bf6`.
- Public metadata: 1.14.0, builtAt `2026-10-23T18:17:31.857Z`.
  The existing container metadata has revision null/source unknown; server Git
  identity was checked separately rather than claiming metadata contains it.
- Public `/api/health`: `{ "ok": true }`; container running/healthy.
- Actual authenticated admin preview of Чеченова Милана opened after deployment.
  About panel visibly shows 1.14.0 and 23.10.2026, 21:17 МСК.
- Mobile calendar measured on production at 375×812, 390×844, 430×932:
  cell 52px, grid 276px for five weeks, card 595px, row 32px, button 36px.
  At 390×844 these exactly match the saved pre-release baseline.
  No horizontal overflow. The real three-tab dock is 72px at 390/430 and 85px
  at 375 where its label wraps; the two-tab demo dock remained 72px. This is
  existing content-dependent navigation, not a calendar height change.
- At maximum scroll on 390×844 the final roster row ends at 716px and the
  dock starts at 760px: lower details are accessible. The admin review banner
  adds height that is absent from the employee's own PWA.
- Opened editor/cancel, vacation modal/close, About/close. Production employee
  schedule was not saved or modified by these checks.
- All three stylesheet links use `?v=1.14.0`.
- Screenshot: `/Users/bela/.codex/visualizations/2026/10/06/01a1102c-dd8a-7d23-b958-f682a7781949/schedule-release-production-1.14.0.png`.

Previous image: `sha256:d8620014b1102bbc645228554d3085eb58c1840d4b559a94b82b6eed73962f55`.
Replacement: `sha256:41e900ae48d84ef64907498f5a389e867a8fb3097fba325d9d2c6a58df7e1329`.
Previous image retained as `portal-app:rollback-before-1.14.0`.
Mounts, selected feature flags and server.env hash matched before/after.
All three prior registry images were checked before build; disk free 25GiB
before and 20GiB after. Storage timer active, previous maintenance exit 0.
Only portal-app was rebuilt/restarted. The script released its deployment flock
before verified registration. After independent public/server/UI verification,
`portal-storage-maintenance --register-verified` succeeded. Registry retains new
image, previous 1.13.15 image and
`sha256:c2e6790bbf40b085c79dd9d2c99dc3f4bc15b9c583ef23ec1a892d7ee510dda7`.
The initial public metadata poll during restart briefly had no JSON; retry
succeeded and independent follow-up checks confirmed health/version.
VPS existing untracked `.rollback/` and unrelated primary-checkout work remain.
