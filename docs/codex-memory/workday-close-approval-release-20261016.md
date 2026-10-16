# Workday approval closes the shift — production 1.4.18

Owner approved the demonstrated fix and explicitly approved commit/deployment.
Target: team.mobo-opt.ru / portal.alebazia.xyz, /docker/employee-testing-app,
source origin/design-local-updates.

## Released behavior

- Runtime commit: `7ced16a0f898a9145e2e6e74088c56e9c87c2d3e`, version 1.4.18.
- New admin approvals close the request's workday in the same server transaction,
  at the decision time. Employee app reopening is no longer required, including
  for older installed PWA versions. Rejection leaves the workday active.
- Preserve saved handover facts/photos, open issues and cash exceptions. Pending
  tasks become missed, not falsely completed. No cash documents are created by
  approval. Store request/admin/time evidence and a truthful completion notice.
- Serialize decisions on the workday; repeated decisions do not overwrite end
  times. Late employee completion and handover drafts preserve admin closure.
- Keep the legacy client fallback only for unconsumed permissions issued before
  this release. No bulk repair of historical approvals or shifts was performed.
- Admin decision UI explains immediate completion and displays the end time.
  The employee completion card retains the without-encashment indication.
- No schema/migrations, environment, uploads, 1C, payroll or OFD code changes.

## Evidence

- Fresh deployment branch and public metadata both showed 1.4.17 immediately
  before choosing and pushing 1.4.18. Package and both lockfile fields agree.
- TypeScript and local production build passed; 155 workday regression tests
  passed. Final focused suite: 20 passed, including 10 tests on a dedicated
  local PostgreSQL database (no-phone approval, cash exception, rejection,
  repeat/parallel decisions, previous completion, rollback, missing checklist,
  late draft, two requests, missing checkout/resolved request).
- Five release-info tests passed after the version increment. VPS Docker build,
  including TypeScript, passed; terminal deployment exit code was 0.
- Authenticated isolated local ADMIN approval closed the shift before opening
  the employee app; real employee UI then displayed the completed shift and
  without-encashment label. Mobile viewport checked at 390x844.
- Independent SSH confirmed runtime HEAD above. SHA-256 of the deployed
  /app/lib/workday-close-decision.ts and local committed file matched:
  `90b02f96934ce425a264b505d25fe6a030f776ab52ed78b9e6d48d57122cd5fa`.
- Public metadata: 1.4.18, built `2026-10-16T19:43:40.578Z` (22:43 MSK).
  Public /api/health returned 200 and {"ok":true}; /employee and /admin/workday
  returned HTTP 200 after startup. Authenticated production ADMIN footer
  independently displayed 1.4.18 and 22:43 MSK.
- Docker metadata still reports revision null/source unknown; commit identity
  was verified separately through SSH and installed source hash.
- Runtime mounts before/after compared as sorted full objects: unchanged.
- Physical phone behavior and a real production employee approval were not
  exercised; no real shifts were modified for testing. Primary checkout's
  unrelated dirty work and VPS untracked .rollback/ were left alone.

## Rollback

- Previous runtime: `727cec564d7aaf6be42bcb246bfcf66ce7243d46`, version 1.4.17.
- Previous image: `sha256:3cd6918106c21bb6e4b7ec6e06571de2cc9aff73b85973601341f64fd4cbc32e`,
  retained as `portal-app:rollback-before-1.4.18`.
- Replacement image: `sha256:f98d02d8ce536a07c9c1e63f72b328d7070895cd3f114246f83cdd08189770a4`.
- Schema unchanged; previous image remains schema-compatible. Rollback does not
  reopen already completed workdays and must not restore the database.
- Only portal-app was built/replaced, using server.env and --no-deps.

## Changed runtime and test files

- app/(dashboard)/admin/workday/close-exceptions/[id]/CloseExceptionDecisionClient.tsx
- app/(dashboard)/admin/workday/close-exceptions/[id]/page.tsx
- app/(dashboard)/employee/EmployeeTodayClient.tsx
- app/api/admin/workday/close-exceptions/[id]/route.ts
- app/api/employee/shift-control/tasks/[id]/route.ts
- app/api/employee/workday/finish/route.ts
- lib/workday-close-decision.ts
- lib/workday-close-view.ts
- package.json
- package-lock.json
- tests/employee-close-blocked-flow.test.mjs
- tests/workday-close-decision.integration.test.ts
