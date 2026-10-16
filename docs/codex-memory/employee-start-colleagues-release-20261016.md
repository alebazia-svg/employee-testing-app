# Employee start card and colleagues — production 1.4.16

Owner approved the unchanged visual design, expanded start-card click target,
hiding empty colleague categories, and commit/deployment on 2026-10-16.

## Released behavior

- The existing native “Начать рабочий день” button covers the entire start card,
  including “Начните смену” and its QR icon. Same scanner, disabled state and
  keyboard action; no new workday operation. Existing printed instructions remain
  valid. The active button transform is suppressed so its overlay stays on the card.
- Empty colleague categories are omitted. The complete section and its prestart
  toggle are omitted when there are no colleague users. Nonempty scheduled,
  active, completed, vacation, off-day and missing-schedule categories remain.
  The employee is excluded by the existing grouping. Missing schedule is not zero.
- No workday business logic, other module, schema, migration, environment or
  production data change.

## Source and verification

- Runtime commit: `f2335f2944d4e548ce7c6787de2b3d7f93b529b2`.
- Source: `origin/design-local-updates`; previous runtime
  `ce2d22d76d8c5236ab113d6c7c1b521a639ea7d6` (1.4.15).
- Package and both lockfile version fields synchronized to 1.4.16 after fresh
  live metadata/remote checks. Five release-info tests passed.
- TypeScript and local production build passed. Relevant workday/PWA suite:
  44 of 45 passed. The remaining existing test expects the old compact logo
  path while the unchanged production header uses the 3D light logo. Both
  files match the pre-change HEAD; no new failure was introduced there.
- Real EmployeeTodayClient with isolated synthetic props at mobile viewport
  390×844: header/icon/button each open the scanner; cancellation/re-entry and
  keyboard Enter work. Empty, active, scheduled, completed, vacation, off-day,
  missing-schedule and mixed groups verified. Temporary fixture route removed
  before production build. No production employee session or shift was changed.
- A physical QR scan was not tested: the local browser has no camera. Scanner
  logic was unchanged. Production employee interaction was not tested under an
  employee login; authenticated ADMIN version label was independently verified.
- VPS Docker production build passed; deployment exit 0, portal-app running.
  Upload/runtime mounts compare identically before/after replacement.
- Independent SSH check confirmed runtime HEAD. Public release-info.json and
  authenticated ADMIN footer show 1.4.16, built `2026-10-16T17:31:16.194Z`
  (20:31 MSK). `/api/health` returns `{ "ok": true }`.
- Public pwa-copper.css SHA-256 matches committed local file:
  `36d47b4bf301a80bcf9f7c4d22ece9e44daf8957d149dfb195b83ff112c193f5`.
- Docker build metadata has revision null/source unknown (existing pipeline
  behavior); the exact source was verified separately over SSH.

## Rollback evidence

- Previous image: `sha256:73fbca54e8daa4adee071582d53bfb8cb35fb5110557d3ef6ee9cce880a13f58`,
  retained as `portal-app:rollback-before-1.4.16`.
- Replacement image: `sha256:e6511ec2a051b509f32d17dabe04f985bdfed46e31ae605ed29104161577275b`.
- No schema change; previous runtime remains schema-compatible. A rollback
  restores version 1.4.15 and its original image. No DB restore is needed.
- Unrelated dirty files in the primary checkout and existing VPS `.rollback/`
  were left untouched. This release record is committed separately from code;
  project architecture and roadmap documents were not changed for this small UI fix.
