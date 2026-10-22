# Employee preview navigation — released 1.13.3, 2026-10-22

Owner approved fixing ADMIN Employees → inspection after payroll was found missing, and asked that future tabs do not silently disappear. The implementation started as APPROVED CHANGE from a749e1f (production release documentation for 1.13.1). The owner subsequently explicitly approved deployment with «Выпускай». Release 1.13.3 is now deployed and independently verified; see the release record below.

## Navigation contract

The ordinary WORKDAY app and ADMIN inspection now use EmployeeNavigation and the employeeSections catalogue. Feature availability comes from the shared employee-home loader. Every section must have an inspection renderer in the typed employeeSectionViews mapping; unknown and disabled preview tabs are rejected. Future sections still require a real safe renderer and explicit read-resource support, plus navigation/security verification. This is not a promise that arbitrary future pages will work without integration.

Payroll reuses PersonalPayrollScreen/PersonalPayrollClient and employeePayrollResponse. The original employee API authenticates its own viewer; inspection authenticates the administrator, verifies the actor-bound unexpired visit and active employee, then passes that selected employee to the same private projection. Procurement remains excluded. No auth impersonation, generic endpoint forwarding, new permission, schema change, formula change or production data write. Current calculation and historical settlement semantics remain unchanged. GETs preserve private/no-store; employee identity overrides are rejected server-side. Client transport permits only the payroll month parameter, preserving duplicate months for validation.

## Verification

- TypeScript and production build passed; git diff --check passed.
- 13 navigation/preview/private-salary unit tests, 78 payroll regressions, and 2 guarded integration/feature-gate tests passed (93 total).
- Real HTTP/PostgreSQL integration compares employee and inspection JSON for a synthetic current estimate, checks three pages, anonymous/employee/other-admin rejection, invalid/duplicate month and identity override refusal, all mutation methods, PROCUREMENT exclusion, inactive/expired visits, and unchanged business tables. Feature-disabled shared reader returns 404.
- Local database: 127.0.0.1:55456/employee_preview_salary; isolated container mobo-employee-preview-salary-20261022. Runtime strips external credentials. No production reads/writes are needed for QA. Server: http://employee-preview.localhost:3322. Local runner/seed remain ignored in .wip/employee-preview.
- Actual production-mode browser: ADMIN list → inspection → salary → previous month unavailable state → schedule → blocked working-day selection → salary; same administrator session retained. Narrow (~355 CSS px) and wide (~1309 CSS px) layouts checked without horizontal overflow. All three tab icons visible. Fixture amount is 10,800, not a real employee salary; advances correctly remain unknown with 1C disconnected. Physical phones and exhaustive exceptional form states were not tested locally. Historical production salary was subsequently checked read-only, as recorded below. Existing private-payroll tests cover unavailable/current/confirmed/error projections.
- Normal employee UI also checked with a separate isolated browser session: home → salary → schedule, without an inspection banner; same estimate, working normal navigation.
- Unrelated main-checkout work is untouched. Documentation records the shared navigation convention and release evidence; committed separately from runtime.

## Exact runtime and test files

- `app/(dashboard)/admin/employees/preview/[visitId]/page.tsx`
- `app/(dashboard)/employee/EmployeeTodayClient.tsx`
- `app/(dashboard)/employee/page.tsx`
- `app/(dashboard)/employee/payroll/PersonalPayrollClient.tsx`
- `app/(dashboard)/employee/payroll/PersonalPayrollScreen.tsx`
- `app/(dashboard)/employee/payroll/page.tsx`
- `app/api/admin/employees/preview/[visitId]/route.ts`
- `app/api/employee/payroll/route.ts`
- `components/EmployeeNavigation.tsx`
- `components/EmployeePreviewProvider.tsx`
- `lib/employee-home.ts`
- `lib/employee-navigation.ts`
- `lib/employee-payroll-response.ts`
- `lib/employee-preview-request.ts`
- `tests/employee-navigation.test.ts`
- `tests/employee-preview-payroll-fixture.ts`
- `tests/employee-preview-payroll.integration.test.ts`
- `package.json`
- `package-lock.json`

## Approved release preparation

Owner explicitly said «Выпускай» after the release question. Classification: OPERATIONS APPROVAL. Initial candidate 1.13.2 was not pushed: Git rejected it because the separately approved notification inbox release reached origin first. No force push or server overwrite occurred. Merged 9c238dc (notification release 1.13.2), retained its changes and prepared 1.13.3. Repeated production build, TypeScript, 21 scoped/private-payroll/inbox tests and 5 version checks passed. Inspected the real merged app: salary, notification New/History navigation and schedule still work in the actor-bound preview. Previous 78 payroll regressions and two guarded integration tests cover unchanged calculation/security paths. Runtime commit 1056b58; version/merged candidate db1b94a. The preceding release completed and registered its verified image before this deployment began.


## Production release record

- Target: https://team.mobo-opt.ru, VPS `/docker/employee-testing-app`, source `origin/design-local-updates`.
- Version: **1.13.3**; server runtime commit **db1b94a4f88980be86d5307771056913cbf130c1**; public build **2026-10-22T14:02:57.788Z** (17:02 Moscow). Public metadata currently reports revision null/source unknown; identity was verified independently from server Git HEAD and deployment build record, not inferred from that field.
- Previous production: 1.13.2, commit `9c238dc97fba5e4052196ae8b0d1befccc4f17f1`, image `sha256:dfa3f5229cba84ba1e135afc04f83906757dec94707d81ee985eb00c9dd9b4de`.
- Replacement image: `sha256:e176e66d1aa56791db775c181d52a7d978e629502ef67466706f491c1acd0d52`. Previous image additionally tagged `portal-app:rollback-before-1.13.3`. Current and two registered rollback images existed before deployment; free space exceeded 15 GiB. No schema/migration delta; rollback remains schema-compatible.
- Deployment through native macOS Terminal; only `portal-app` built/restarted using `server.env`. Container healthy; environment file hash, payroll flags and uploads/fiscal/planning/cabinet mounts unchanged. No migrations, production business-data edits, cleanup or 1C publication. Inspection creates its normal actor-bound audit visit.
- Independently checked server HEAD, public release-info.json version/build and authenticated ADMIN footer (1.13.3, 22.10.2026 17:02 MSK).
- Authenticated real UI: Employees → Liana → working day → My salary (current estimate) → previous month (confirmed amount and payment summary) → schedule → My salary. Three navigation items visible, selected employee retained, preview banner and administrator session preserved. No shift, schedule or financial action submitted. Physical phones and exhaustive production employee/exception combinations were not tested.
- Screenshot: `/Users/bela/.codex/visualizations/2026/10/06/01a1129c-9107-75f1-8821-77d5a817d9f2/employee-preview-payroll-production-1.13.3.png` (local owner evidence, not committed).
- After independent UI verification, `portal-storage-maintenance --register-verified` registered the replacement image. Native Terminal log confirms `RELEASE_VERIFIED_AND_REGISTERED`, `ROOT_EXIT=0`, `DEPLOY_EXIT=0`.
- Local deployment log `/tmp/mobo-employee-preview-1.13.3.log`; safe server identity/mount records `/tmp/mobo-employee-preview-1.13.3-before.json` and `/tmp/mobo-employee-preview-1.13.3-after.json`.
