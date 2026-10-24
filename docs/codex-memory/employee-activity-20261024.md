# Employee activity journal — 2026-10-24

Owner approved implementation, additive migration and production release after
reviewing the actual Employees → Activity modal. Phase: launch hardening;
operational visibility, not employee scoring. Candidate version 1.15.0,
feature commit 7c83951. Production verification is pending below.

## Accepted contract

- One focused modal from each employee row/card. Day picker, section visits,
  expandable saved facts, notification send/open/result evidence.
- Whitelisted visible section visits and intentional notification opens only.
  No keystrokes, raw forms, screen recording, dwell-time or productivity score.
- Signed employee identity, active non-service access session; ADMIN inspection
  never writes employee telemetry. Later service classification excludes that
  session's journal from the report.
- New visits start at deployment. Existing workday/task/schedule/cash records
  may show earlier facts; old navigation cannot be reconstructed. Legacy readAt
  may be automatic and must NEVER be labelled proof of a person's opening.
- Notification click in the app or on a push is first-open evidence only, not
  proof the text was understood or the task done. Provider acceptance is not
  proof of physical device display. Existing notification lifecycle unchanged.
- Report reads local data only, including latest saved expense evaluation.
  RKO document time is not posting time; absence of actor evidence prevents
  attributing the result to an employee. Incomplete source never proves payment.
- Capture is best effort, no offline retry queue, bounded 4-second client request,
  2-second DB transaction, per-user try-lock, 600 events per rolling 24 hours,
  idempotent first open and 30-second repeated-section suppression.
- Journal retention 90 days with indexed, bounded hourly cleanup on traffic.
  Business records are never removed by telemetry cleanup. No new polling.
- Migration 20261024130000_employee_activity_journal adds two new tables and
  indexes only. Old application remains compatible; rollback leaves tables.

## Verification

- Typecheck and production build passed against origin 8b5f74a (1.14.7) baseline.
- 36 journal/expense/navigation/inbox/notification/merged-procurement checks;
  9 worker/release tests; HTTP auth/actor/CSRF/date boundaries passed.
- Real local PWA: workday → schedule → bell → message, four event types/readouts
  verified via the ADMIN report; no fake production events created.
- Actual ADMIN modal at desktop and 390×844: inline expansion, close/re-entry,
  day before collection, error and recovery. Actual production collection and
  physical phone push-open telemetry remain to verify after deployment.
- Fresh migration-chain replay exposes a pre-existing historical migration
  ordering problem (20260830143000 references a later participant table).
  Did NOT edit old migrations. Isolated database recreated from the exact
  current baseline schema, then the exact new SQL migration was applied and
  PostgreSQL tests passed. Production preflight must allow only the new migration.
- Isolated local DB: mobo-activity-test-20261024 / 55464 / activity_test.
  Local preview port 3163, no production credentials. Existing main/preview
  worktrees and private historical fixtures were left untouched.

## Files
app/(dashboard)/admin/employees/EmployeeActivityDialog.tsx
app/(dashboard)/admin/employees/EmployeesClient.tsx
app/(dashboard)/employee/EmployeeTodayClient.tsx
app/(dashboard)/employee/WorkdayNotificationsClient.tsx
app/(dashboard)/employee/layout.tsx
app/(dashboard)/procurement/layout.tsx
app/api/admin/employees/[id]/activity/route.ts
app/api/employee/activity/route.ts
components/EmployeeActivityTracker.tsx
components/ProcurementNotificationsButton.tsx
lib/employee-activity-policy.ts
lib/employee-activity-report.ts
lib/employee-activity.ts
package-lock.json
package.json
prisma/migrations/20261024130000_employee_activity_journal/migration.sql
prisma/schema.prisma
public/workday-sw.js
tests/employee-activity-http.test.mjs
tests/employee-activity-worker.test.cjs
tests/employee-activity.integration.test.ts
tests/employee-activity.test.ts

## Production release — verified 1.15.0

Released 2026-10-24. Source/server commit `dab98849282e4eb0a7b65421beb9b8de3035378a`
contains feature `7c83951` and the already-approved procurement 1.14.7 changes
from `8b5f74a`. No separate installation of the older 1.14.7 is needed; its
prepared script fails closed on the changed deployment branch/head.

- Public version **1.15.0**, build `2026-10-24T16:08:56.751Z` (19:08 MSK).
  Public metadata still has revision null/source unknown; exact commit was
  independently read over SSH. Authenticated Employees UI displays 1.15.0.
- Previous image `sha256:bfb70bf64074f17ef231a56a46a6618786bf7a3e3ff3b456f83f88096efd353a`;
  replacement `sha256:920ecad24047202f2262a5d9e3554bc0058325647e816e3361fc985a2133a45d`.
  Previous image kept as `portal-app:rollback-before-1.15.0` and current + two
  verified rollback images registered after independent UI/public verification.
- Backup: `/var/backups/offonika/employee-activity-before-1.15.0-20261024T160650Z.dump`;
  nonempty custom archive, pg_restore list verified before migration.
- Every applied migration checksum matched the source manifest; the ONLY
  pending migration was `20261024130000_employee_activity_journal`. Applied
  successfully. Coverage row starts `2026-10-24T16:13:21.297Z` (19:13:21 MSK).
  No old rows were backfilled. Application env checksum and volume mount
  signatures unchanged. 17 GiB free after release; unrelated `.rollback/` kept.
- Health 200; anonymous ADMIN activity endpoint 401. Read-only real ADMIN
  verification: Liana's six saved workday facts, three completed cash tasks,
  request 00OF-001129 for 500 RUB and posted RKO 00OF-001938. Original 10:10:46
  readAt is visibly historical/possibly automatic, not proven opening.
- Real visits remain zero immediately after rollout; no real employee was
  impersonated to fabricate journal evidence. New visits require the updated
  app. Physical iPhone push-click capture has NOT yet been tested; service
  worker failure/navigation and ADMIN isolation are covered by tests.
- Final validation: typecheck + local and VPS production builds; 36 domain/
  journal regressions, 9 worker/release checks, one HTTP test with multiple
  auth/CSRF/actor/date assertions against the actual local production build.
  Real local PWA capture and ADMIN inspection exclusion also checked visually.
- Runtime log `/tmp/mobo-activity-release-output.log` ends
  `ACTIVITY_DEPLOY_VERIFIED=1`, `ACTIVITY_DEPLOY_EXIT=0`. Screenshot
  `/tmp/mobo-activity-1.15.0-production.png`; actual production tab left open.

Rollback restores the previous compatible image/version and leaves the two
additive journal tables. No auth, notification cadence, routing, payroll or 1C
write mechanism was altered by the activity feature. Existing unrelated main
and preview worktree changes were not staged or reverted.
