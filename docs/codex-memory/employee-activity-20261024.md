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

## Daily timeline correction — 1.15.1

Owner reviewed the actual local application and approved production release.
Released and verified 2026-10-24. Source/server commit
`80a92cb7497fe243cc90db7d7b44a0596b471b05`.

- One chronological history is now primary: visible page visits, named message
  opens and saved actions. Six latest events initially; inline expansion shows
  the rest. Section visit counts are secondary; informational messages are
  separate from actionable obligations. No inference that opening means reading.
- Returning to the same tab after at least 30 seconds in the background records
  a new visit; brief interruptions and hidden screens do not. Existing bounded,
  best-effort journal and ADMIN/service exclusion remain unchanged.
- Employee single/bulk/bulk-edit schedule changes appear in the history;
  administrator schedule edits are excluded from employee actions.
- Real local UI evidence: test manager opened Schedule at 19:43:17 and saved
  October 25 as working at 19:43:44. No real employee was impersonated.
- Local typecheck/build passed; 12 activity/client/worker/HTTP checks and five
  release metadata tests passed. Desktop/mobile, expansion and close/re-entry
  checked. Physical iPhone background-return capture is not yet verified.
- No schema, 1C, notification-delivery or business-action changes. Previous
  compatible image retained for rollback; additive 1.15.0 tables stay in place.
- Runtime files: `app/(dashboard)/admin/employees/EmployeeActivityDialog.tsx`,
  `components/EmployeeActivityTracker.tsx`, `lib/employee-activity-report.ts`,
  `package.json`, `package-lock.json`. Tests:
  `tests/employee-activity-client.test.cjs`,
  `tests/employee-activity.integration.test.ts`.
- Unrelated main and older preview worktree files were not staged or reverted.

### Production verification for 1.15.1

- Public version 1.15.1, build `2026-10-24T18:03:11.226Z` (21:03 MSK).
  Exact source independently verified over SSH; public metadata revision remains
  null/source unknown. Authenticated Employees UI shows version 1.15.1.
- Liana's actual Activity modal loads the new daily history, six saved facts,
  completed tasks and the 500 RUB posted expense. Zero recorded visits remains
  explicitly distinguished from proof of non-use; no fabricated history.
- Health 200, anonymous ADMIN activity API 401, container healthy. Environment
  checksum and mounts unchanged. No migrations run. About 15 GiB free afterward.
- Previous image: `sha256:920ecad24047202f2262a5d9e3554bc0058325647e816e3361fc985a2133a45d`;
  replacement: `sha256:ceb0602512dc32032fb6208797777ddd4185e2246d5dbf469a65aa7630636162`.
  Previous tagged `portal-app:rollback-before-1.15.1`; all three prior registry
  images existed at preflight. New image registered after independent UI check.
- `/tmp/mobo-activity-151-output.log` ends `ACTIVITY_151_VERIFIED=1` and
  `ACTIVITY_151_EXIT=0`. Native Terminal launch and completed deployment are
  separately confirmed. Production screenshot capture timed out twice; actual
  authenticated UI and source/public checks succeeded. No screenshot claimed.
- Actual future employee visits after this release, including physical iPhone
  background-return capture, remain to observe; local behavior is verified.

## Pilot day audit — local interface proposal, not released

Owner asked to see a richer daily audit on the real screen. Approved scope is
an interactive local interface proposal only; event collection, production and
business workflows remain unchanged. Route `/admin/employees/activity-preview`
requires ADMIN and explicit `EMPLOYEE_ACTIVITY_PREVIEW=1`; renders the existing
Employees page with a focused modal inside its actual AdminShell.

The example clearly labels all events as fictional, including the name Zukhra.
Overview separates outstanding work, notification opens, saved actions, system
waits and confirmed outcomes. Episodes expand inline; Visits shows section/time
history without invented dwell time. Three selectable scenarios: outstanding
question, all done, no records. Unknown 1C actor/posting times remain unknown.
No inference of reading from opening or non-use from missing events.

Local fixture is UI-only, no DB seed/migration, no pushes or 1C operations. The
new attempt/warning-display history is NOT yet collected. Implementing that
backend is a separate defined change after the interface review. Preview files:
`app/(dashboard)/admin/employees/activity-preview/page.tsx` and
`EmployeeDayPreview.tsx`. Local port 3163 with the existing isolated activity DB.

Preview verification: TypeScript and final production-mode local build passed;
actual UI checked at 1440×1000 and 390×844 with no horizontal overflow. Inline
KKM episode, section visit times, completed/empty states and close/re-entry
verified. Restored normal browser viewport; visible local tab left open.
Screenshot: `/tmp/mobo-day-audit-overview.png`. Real new audit capture and
physical-phone behavior are outside this UI-only preview and not tested.

## Approved daily audit implementation — local candidate, 2026-10-24

Supersedes the UI-only scope above following owner approval “Хорошо, делай свою
рекомендацию”. No production release was authorized for this candidate.

- One shared report drives the actual Activity modal and the explicitly
  fictional preview. Five states: ended shift with outstanding work, employee
  working, stale source, completed, empty. Distinguishes owner intervention,
  employee work and unknown results. Visits stay separate; no invented dwell
  time, reading evidence, productivity score or employee blame for system waits.
- Bounded handover events record visible form/wait/error/KKM question states,
  submit attempts and existing server check evidence. Confirmed task completion
  supplies the result. Client cannot forge server stages; signed session/task
  ownership, context whitelist, dedupe and existing journal limits apply.
- Server capture uses after-response work; no new 1C requests or notification
  delivery changes. Existing financial/workday validation is preserved.
- Additive nullable PortalActivityEvent.context JSONB migration applied ONLY to
  isolated activity_test at localhost:55464. Production needs this migration
  before the new app. Previous app is compatible with the extra nullable field.
- Actual local employee UI: opened handover 22:06, submitted 22:07, completed
  22:07. ADMIN displayed that sequence from persisted test events. Only the
  named local test employee was used; no production employee or 1C write.
- TypeScript and final production-mode build passed; 40 policy, integration,
  client, worker, deferred-server, HTTP-access and workday checks passed.
  Desktop 1440×1000 and mobile 390×844 reviewed; no horizontal overflow.
  Preview and real local screenshots: /tmp/mobo-day-audit-refined.png and
  /tmp/mobo-day-audit-real-local.png. Normal viewport restored afterward.
- Limits: capture remains best effort; offline failures can lose client events.
  Physical iPhone capture and live KKM failure/recovery not tested this turn.
  Only instrumented handover states are collected, not every application error.
  Source freshness uses the existing six-minute expense policy. Unknown actor
  or exact 1C posting time stays unknown. No claim of a complete surveillance
  trail or employee performance measurement.
- Production remains 1.15.1; candidate uncommitted/unreleased, no version bump.
  Unrelated main-checkout edits untouched. Documentation should be committed
  separately from code if a later release is approved.

Exact candidate files (relative to this checkout):

- app/(dashboard)/admin/employees/EmployeeActivityDialog.tsx
- app/(dashboard)/admin/employees/EmployeeDayReport.tsx
- app/(dashboard)/admin/employees/activity-preview/page.tsx
- app/(dashboard)/admin/employees/activity-preview/EmployeeDayPreview.tsx
- app/(dashboard)/admin/employees/activity-preview/demo-report.ts
- app/(dashboard)/employee/EmployeeTodayClient.tsx
- app/api/employee/shift-control/tasks/[id]/route.ts
- components/EmployeeActivityTracker.tsx
- components/HandoverAuditShown.tsx
- lib/employee-activity-policy.ts
- lib/employee-activity-report.ts
- lib/employee-activity.ts
- lib/employee-handover-audit-policy.ts
- lib/employee-handover-audit-server.ts
- prisma/schema.prisma
- prisma/migrations/20261024193000_employee_handover_audit/migration.sql
- tests/employee-activity.integration.test.ts
- tests/employee-activity.test.ts
- tests/handover-audit-client.test.cjs
- tests/handover-audit-server.test.cjs
- docs/codex-memory/employee-activity-20261024.md
- docs/codex-memory/project-index.md


## Interaction audit — revised local candidate, 2026-10-25

Supersedes the overview-first candidate above. Owner explicitly wants application
interactions, not another Control Day dashboard. Approval: “да” to the defined
local notification/receipt/cash/handover audit. No production release approved.

- Actual Employees → Activity now shows “День в приложении”: chronological
  episodes with inline steps, quiet section visits, filters for errors, warnings
  and notifications without recorded opens. No duplicated cash/task dashboard.
- Explicitly instrumented visible messages, card opens/closes, attempts and
  displayed errors are captured. Notification click and card open are distinct;
  the same navigation is not counted as two notification opens. Repeat opens
  remain in the trail while legacy first-open semantics remain unchanged.
- A successful repeated response is visible beside the historical error. This
  means the application saved a response, never that a 1C document was corrected.
- Strict bounded context, signed employee session, object ownership and preview
  exclusion apply. Raw errors, free text, form contents and arbitrary clicks are
  not recorded. Existing 600-event/day and 90-day retention policy remains.
- Client collection uses a bounded in-memory FIFO (30 queued, five-second stale
  cutoff, four-second request timeout), avoiding simultaneous best-effort writes.
  No offline persistence, automatic retries, new polling, 1C or push requests.
- Existing context migration from the prior candidate is reused, local only.
  Production needs that migration before this code; no further schema additions.
- Local actual PWA test (25 Oct, Moscow): notification 24 shown 00:27:09;
  clicked/card opened 00:27:13; attempt 00:27:21 produced a visible error;
  repeated answer saved 00:27:27; card closed 00:27:30. ADMIN displayed this
  persisted chain. Test issue 1 was temporarily closed then reopened only in
  localhost:55464/activity_test to produce the genuine 409 path. No employee
  production record, real document or external push was changed.
- Fictional preview now says “Тестовый сотрудник”; it is not real Zukhra data.
  Actual local “Тестовый менеджер” demonstrates real collected browser actions.
- Limits: only connected screens/states are covered; no dwell time, other apps,
  complete screen recording or guaranteed offline history. Showing/opening is
  not proof of reading. Provider push acceptance is not device display proof.
  Historical uncaptured events cannot be reconstructed. Real iPhone and live
  KKM/1C failure-recovery remain unverified for this candidate.

Additional exact changed files in this phase (previous candidate list above
also remains part of the uncommitted work):

- app/(dashboard)/employee/CashIssueClient.tsx
- app/(dashboard)/employee/WorkdayNotificationsClient.tsx
- components/EmployeeInteractionAudit.tsx
- components/EmployeeCreditIssueActionCard.tsx
- components/EmployeePaymentCheckActionCard.tsx
- components/NotificationRecordDialog.tsx
- components/TerminalFiscalReviewConversation.tsx
- components/workday/EmployeeAttentionPanel.tsx
- components/workday/EmployeeNotificationInbox.tsx
- lib/employee-interaction-policy.ts
- lib/employee-audit-timeline.ts
- tests/employee-interaction.test.ts
- tests/employee-interaction-client.test.cjs
- tests/employee-activity-client.test.cjs

Final verification for 25 Oct candidate: 56 distinct policy, DB ownership,
client/observer, worker/server, workday regression and HTTP-auth tests passed.
Latest timeline regression includes old shown-but-unopened messages and separate
notification/card open counting. Final TypeScript/build passed; git diff --check
clean. Actual local ADMIN checked at 1440×1000, 390×844 and restored default
viewport: no horizontal overflow; error/unopened/empty filters, inline details,
close/re-entry verified. Actual screenshot files:
`/tmp/mobo-interaction-audit-real-20261025.png` and
`/tmp/mobo-interaction-audit-steps-20261025.png`. The live local Employees modal
is left open for owner review. Unrelated primary-checkout edits remain untouched;
no commit, production migration or deployment performed.

## Compact day table — owner review, 2026-10-25

Owner rejected the episode-card presentation as difficult to understand and
approved showing the proposed simple chronology. Local presentation now uses
one table: time / location / action / outcome; details expand inline. Visits,
notification display/open and system events remain distinct. An immediately
following application acknowledgement/error can share its preceding answer-click
row (same object, adjacent event, under ten seconds); exact source events remain
in details. Never merges server/1C completion into a click. Missing send
confirmation is not labelled as definitive failure to persist.

Changed in this iteration:
- app/(dashboard)/admin/employees/EmployeeDayReport.tsx
- app/(dashboard)/admin/employees/activity-preview/EmployeeDayPreview.tsx
- app/(dashboard)/admin/employees/activity-preview/demo-report.ts
- docs/codex-memory/employee-activity-20261024.md

No collection, API, schema, production or business-rule change this iteration.
The preview is clearly fictional; the actual local Employees modal uses recorded
test-browser events. Full real employee interaction histories still require
releasing the previously approved collector; uncaptured history is unavailable.
TypeScript, final build and diff whitespace check passed. Actual browser checks:
error filter, inline source detail, empty scenario, mobile 390x844, desktop
1440x1000, no horizontal overflow, original viewport restored. Persisted test
error/retry rows verified. No new production/physical-phone test. Screenshot:
/tmp/mobo-day-table-desktop-20261025.png. Both local views left available for
owner feedback; uncommitted/unreleased. Unrelated work untouched.

## Release-readiness review — 2026-10-25, not deployment approval

Owner accepted the compact table and asked to continue. Scope is the already
approved local audit and release preparation; no permission inferred for a
production migration/deployment or server cleanup.

One correctness fix: cash request visibility is now labelled “Заявка показалась
на экране”, keeping it in the cash surface instead of incorrectly classifying
it as notification display. Added a regression covering both visibility events
in the same cash episode. Updated the DB repeated-open assertion to use the
structured notification-open evidence after the earlier label clarification.
Changed this review: lib/employee-audit-timeline.ts,
tests/employee-interaction.test.ts, tests/employee-activity.integration.test.ts,
and this note. No business logic changes.

Verification: six interaction regressions plus seven real isolated-DB integration
tests passed (13 total); HTTP auth/isolation test passed separately. Final local
build including type checking passed; diff check clean. Local port 3163 restarted
on that build. Existing visual approval/desktop/mobile checks remain applicable;
no new physical-device test. Unrelated primary-checkout files untouched.

Read-only production/source evidence:
- Latest origin/design-local-updates remains docs commit 7f82a17 (package 1.15.1),
  matching candidate HEAD; no intervening remote runtime changes to reconcile.
- Public release-info: 1.15.1, builtAt 2026-10-24T18:03:11.226Z, revision unknown.
- Independently read server checkout: 80a92cb7497fe243cc90db7d7b44a0596b471b05.
- Free filesystem bytes: 15,464,816,640 = about 14.40 GiB, below the runbook's
  15 GiB pre-build gate (16,106,127,360 bytes). Do not start a production build.
- Read-only `sudo -n docker system df` could not run: password required.
  Docker cache/image reserve verification and production migration state remain
  unverified. No pruning, restart, image change, migration or environment edit.

Remaining release sequence: inspect server storage/reserve registry with normal
owner-entered sudo in native Terminal; obtain scoped cleanup authority if needed,
restore capacity without touching uploads/DB/current or reserved images; then
commit only candidate files (docs separately), recheck live/branch version and
apply routine new release version. Production rollout requires explicit approval
including additive migration 20261024193000_employee_handover_audit. Confirm the
migration set/backup before applying; preserve current verified image. Migration
adds only nullable JSON context to the audit table and is compatible with the
previous application on rollback. Finally verify server/public/authenticated UI
and test physical employee-PWA capture. No version reserved or commit created.

### Storage preflight completed — 2026-10-25

Owner authorized the proposed native Terminal read-only diagnostic with
“Продолжай”. Both diagnostic scripts completed; the reserve check explicitly
returned exit code 0. No cleanup, build, restart, migration or deployment was
performed in this task. This supersedes the earlier capacity blocker:

- Free bytes: 28,369,342,464 (about 26.42 GiB), above the 15 GiB gate.
- Docker build cache: 6.826 GB; no cache deletion needed for this preflight.
- portal-app healthy. Storage maintenance Result=success, ExecMainStatus=0,
  completed 2026-10-25 04:38:38 UTC.
- Current image is registered and exists:
  sha256:03906bd520bbe85c777a2d3b19e1336ddbc25c4f36acc2533b40fe2eea2baebe.
- Both additional registered images independently exist:
  sha256:95b70df633f58b2d869422de94b58faab4bbb65cd93449976c18528960768960,
  sha256:ceb0602512dc32032fb6208797777ddd4185e2246d5dbf469a65aa7630636162.

Concurrent releases changed the baseline: public version is now 1.15.3, built
2026-10-24T22:38:48.215Z; server checkout is
f7961e20922344faf10a71cd28438a11deccff2c. Fetched deployment branch is 211444b
(documentation after the release). Candidate remains based on 7f82a17 and must
be reconciled with these procurement changes and checked before release.
Both sides change prisma/schema.prisma in different models: procurement adds
receipt-purpose/confirmation fields, candidate adds PortalActivityEvent.context.
Preserve both. New notification reader/lifecycle changes also require combined
verification; no runtime compatibility claim follows from the schema inspection.
Production migration state and candidate capture on a physical iPhone remain
unverified. No version reserved, commit created or production rollout approved.
Only this status note changed during diagnostics; unrelated work left untouched.

### Candidate reconciled with 1.15.3 — 2026-10-25, local only

Owner approved the next defined step (“Приступаем”): reconcile the local audit
with current production-source changes and verify together. No deployment or
production migration authorization inferred. Saved a tracked binary patch and
all 15 untracked candidate files in /tmp/mobo-activity-before-1153-20261025,
then fast-forwarded codex/employee-activity-release to 211444b with autostash.
Autostash applied cleanly; the audit context field and all upstream procurement
fields are preserved. No new runtime changes needed for reconciliation.

The isolated activity_test database had been created from baseline schema SQL,
not Prisma migration history. migrate deploy therefore failed safely with P3005.
Applied only the exact newly upstream procurement migration SQL to this local
database using ON_ERROR_STOP; existing audit context and captured fixtures remain.
No production database accessed or modified.

Added a real-DB regression for procurement_qr_check shown/open/error/retry events:
cancellation and legacy readAt do not establish execution or personal delay.
Updated the existing lost-handover-response test harness to provide the newly
instrumented audit ref/sender; its completed-versus-active assertions remain.
Changed tests this step:
- tests/employee-activity.integration.test.ts
- tests/employee-handover-photo-flow.test.cjs

Verification on the combined source: 79 distinct checks passed (46 audit and
procurement checks, one added QR integration check, 31 preview/workday/notification
regressions, one HTTP authentication/actor-isolation check). Final TypeScript and
production-mode local build passed; diff check clean. Build preceded test-only
edits; tsc and the affected suites were rerun afterward. Local server 3163 now
serves the reconciled build, with the existing candidate preview flag enabled.
Version remains the upstream 1.15.3 for local verification only, not a releasable
artifact under that number. Choose a fresh version immediately before release.

Authenticated local ADMIN reviewed against recorded test-browser data: normal
chronology, error-only filter and inline error evidence work. Mobile 390x844:
dialog clientWidth=scrollWidth=364, no page horizontal overflow. Restored default
viewport and left the actual Employees activity modal open. Screenshot:
/tmp/mobo-activity-1153-verified-20261025.png. These are test employee records,
not a claim about real staff. Physical iPhone capture and live 1C failure/recovery
remain unverified. Production migration-state/backup checks remain release gates.
No commit, push, version reservation or deployment in this step. Primary-checkout
unrelated files untouched; candidate code and scoped docs remain uncommitted.

### Candidate committed; concurrent Terminal work checked — 2026-10-25

Owner approved continuing the stated commit/release preparation and specifically
asked to check existing Terminal work before releasing. Local process/script
inspection found /tmp/deploy-alfa-date-window-20261025.command for the separate
ai-business-os bank resolver, plus a running AUSN report request. The bank
installer was absent from the remote process snapshot; the report was present.
No portal compose build, Next build, Prisma migration or storage-maintenance
process was found in that snapshot. This is not proof that the other installation
succeeded, and no other task's processes were stopped or changed. Native Terminal
UI inspection was denied by the UI tool; no alternate UI access was attempted.

Fresh public metadata remains 1.15.3, server checkout f7961e2; fetched deploy
branch remains 211444b. Free bytes 28,368,035,840. Recheck these and the deployment
flock immediately before any approved rollout; a prior snapshot is not a lock.

Candidate runtime/tests/migration committed locally as 54e9b10 (35 exact files),
based on 211444b. No version bump or deployment-branch push yet. The prior 79
checks and build apply to this exact runtime content; staging/diff check passed.
Documentation is committed separately. Primary-checkout unrelated edits untouched.
Before release: obtain explicit rollout authority including the additive context
migration, choose the fresh version from live/deploy branch, verify production
migration checksums/pending set and backup, then serialize build/migration/restart.
Do not rerun old /tmp release scripts or confuse Terminal launch with completion.
