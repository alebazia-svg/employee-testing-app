# Payroll PWA attendance with Google reserve — production 1.9.0

Owner explicitly approved commit and deployment after local visual/functional
verification, including the Google reserve extension.

## Release

- Target: `https://team.mobo-opt.ru`, VPS `/docker/employee-testing-app`.
- Deployment source: `origin/design-local-updates`.
- Runtime commit: `5c7492c4ce5862d11d002f8e4f3fde46c7551d63`.
- Version: **1.9.0**. Public build: `2026-10-19T07:09:22.238Z`
  (19 October 10:09 Moscow); authenticated ADMIN footer agrees.
- Fresh branch/public metadata both showed 1.8.2 before the version increment
  and immediately before push. Package and both lockfile version fields agree.
- Deploy exit 0. Container healthy; public health `{ok:true}` and payroll route
  HTTP 200. Exact server commit independently read through SSH. Public metadata
  revision remains null/source unknown under the existing Docker pipeline.
- Local and deployed checkout SHA-256 of `lib/payroll-attendance-source.ts`:
  `b8da52442b272b594cc580957e46b1aa26c7f43f825b77d82fa9564b0d32428d`.
- Mount lists before/after matched, including `/app/uploads`. Only portal-app
  was built/replaced, with server.env and --no-deps; no migrations.
- Storage service's latest run was successful, with approximately 29 GiB free
  before build. Build held the shared storage/deployment flock. Independently
  verified image registered after releasing the flock.

## Behavior and verification

- User 8, Хурзокова Лиана: Google attendance before 2026-10-18; from that date,
  prefer the PWA workday for each date and use Google when PWA has no record.
  An overlap or later arrival of the PWA record never adds another salary day.
- Exact identity and approved aliases only. Other employees, salary formulas,
  manual correction behavior and saved/final payroll runs are unchanged.
- Day semantics remain arrival-based, including an active shift. PWA timing
  does not drive payroll penalties; existing Google lateness rules remain.
- Refresh keeps the last-good attendance snapshot on failed/incomplete source
  reads. Source provenance is saved and shown in Liana's payroll card.
- 19 focused source/snapshot/API tests, 78 payroll regression tests and five
  release-info tests passed. TypeScript, local production build and VPS build
  passed. Desktop/mobile (390px), re-entry and simulated reserve day checked
  against an isolated local database before release.
- Production authenticated UI confirmed **14 unique October days**, two PWA
  dates (October 18/19), and October 18 counted once on overlap. Day component
  is 14 × 500 = 7,000 RUB. These checks validate attendance integration, not
  a complete reconciliation/approval of the entire October payroll.
- Production attendance snapshot refreshed through the normal screen flow.
  No manual DB update, salary-run save/finalization, password change, 1C write,
  real phone outage or production fallback simulation was performed.
- Production screenshot: `/tmp/liana-payroll-production-1.9.0.jpg` (local).

## Rollback

- Previous runtime: `ab1f659a20e53a8ff67d0f9c1421d7b06d5e3586`, version 1.8.2.
- Previous image:
  `sha256:eb87eeb71acefc4acd073c2f5026eeb5f3220f446f9dacaf44b4c2f149ea3c93`,
  retained as `portal-app:rollback-before-1.9.0`.
- Replacement image:
  `sha256:66457f77455681fc12de3b01545addbfac7261bd9395fca138dbc4edd25fd20e`.
- Schema unchanged. Old code rejects the mixed-source attendance cache and
  rebuilds through its former Google-only refresh; rollback therefore restores
  the former attendance behavior. Do not restore the database or rewrite saved
  payroll runs. Register the independently verified restored image if rolling back.

## Changed files

Runtime/tests:

- `app/(dashboard)/admin/payroll/PayrollClient.tsx`
- `app/(dashboard)/admin/payroll/PayrollAttendanceSourceNote.tsx`
- `app/api/admin/payroll/attendance-preview/route.ts`
- `lib/payroll-attendance-source.ts`
- `lib/payroll-attendance-summary.ts` (existing aggregation extracted unchanged)
- `lib/payroll-attendance-snapshot.ts`
- `tests/payroll-attendance-source.test.ts`
- `tests/payroll-attendance-route.test.ts`
- `tests/payroll-attendance-snapshot.test.ts`
- `package.json`
- `package-lock.json`

Memory is committed separately: this release record, `payroll-playbook.md` and
`decision-log.md`. Main checkout's unrelated dirty files and VPS `.rollback/`
were left alone. Password rotation remains a separate unimplemented request.
