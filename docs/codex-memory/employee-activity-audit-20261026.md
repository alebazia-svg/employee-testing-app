# Employee activity: useful audit — local candidate, 2026-10-26

Owner approved improving the existing Activity section after a read-only live
review of Milana's day. Current phase remains launch hardening. This approval
covers local implementation and verification, not production deployment.

## Initial candidate scope (superseded below)

- Keep Employees → Activity and the shared ADMIN visual language.
- Day overview, grouped notification outcomes, searchable chronological events.
- One object per notification card; repeat reminders stay in its details.
- Distinguish provider acceptance, visible in-app display, explicit opening,
  saved response and system-confirmed business result. Never infer reading.
- Surface previously queried shift/task/schedule/cash facts that the old table
  omitted. They remain system evidence, not proven personal actions.
- Restore current task/issue result for older notifications interacted with on
  the selected day; retain the original send date and current result timestamp.
- Preserve event order at equal timestamps and deduplicate the same result
  reached through task and handover evidence.
- Show later saved response/result beside an earlier error for that same object;
  this is not a claim that every historical error is fixed.
- Separate optional section transitions from important actions; support search,
  outcome/error filters, bounded display batches and explicit incomplete data.

## Initial candidate safety boundaries

No schema/migration, new tracking mechanism, sending policy, employee workflow,
1C requests/writes, production data changes, version bump or deployment.
Existing signed-session checks, service-session exclusion, whitelist, retention,
event caps and best-effort capture remain. No productivity score, idle-time
tracking, other-app observation or inferred employee fault.

The result of a task is its latest persisted state at report read time, not a
reconstructed historical snapshot. Explicit result dates and the explanation
identify this distinction. Phone display/read/sound cannot be proved from push
provider acceptance. Physical employee iPhone behaviour was not newly tested.

## Initial candidate verification

- 35 focused tests passed, including isolated PostgreSQL integration on
  localhost:55464/activity_test and 9 projection tests.
- Real local HTTP gate passed: ADMIN access, anonymous/employee denial, invalid
  dates/employee IDs, actor injection, cross-site capture rejection.
- TypeScript and optimized Next.js build passed; no dependency versions changed.
- Real shared component inspected in authenticated local ADMIN at port3186;
  preview scenarios are explicitly fictional, not a screenshot of Milana's phone.
- Existing integration fixture was missing the payment date required by the
  current expense-allocation contract; added that date to the test fixture only.
- Dependency installation reports existing npm advisories; dependency remediation
  is not part of this UI/read-only report change. No npm audit fix was run.

Source: EmployeeDayReport.tsx, employee-activity-view.ts,
employee-activity-report.ts, employee-audit-timeline.ts. Tests:
employee-activity-view.test.ts, employee-activity.integration.test.ts,
employee-activity-http.test.mjs. Unrelated worktrees preserved.

Next: owner review of the local screen; production release requires explicit
approval and the normal live-version/build/commit verification gate.

## Approved operations audit — current candidate

The owner rejected click-oriented activity and explicitly approved meaningful
workflow chains: action, obstacle/delay, repeated attempt and persisted result.
Phase remains launch hardening / employee pilot. Local implementation only;
no release, push, commit, production writes or 1C changes in this step.

### Screen and evidence contract

- One chronological row per business operation; notification repeats stay in
  its details. Main row shows outcome, relevant times, views and problems.
- Hide generic Workday visits. Payroll and schedule views retain the selected
  period; background polling does not increase the view count. A visible return
  after at least 30 seconds in background counts as another view.
- Payroll: selected month, view count, measured request duration, failure and
  later response. No salary amounts or form contents in client event context.
- Schedule: viewed period, save/confirmation/error, persisted before→after
  changes. Success on another date cannot hide a failed save. Existing saved
  changes stay visible even if a later attempt failed.
- Encashment: retries linked by the existing idempotency key, offline queue
  outcome, client response, server save and persisted 1C confirmation. A client
  success never proves posting. Current 1C error/manual-review state remains
  visible even when the client received a successful portal response.
- Day start/end and vacation save/cancel have bounded attempt/result events.
  Existing handover/notification interaction capture is reused.
- Notification shown/opened and system result remain distinct. Elapsed time is
  descriptive, never a claim of reading, employee inactivity or personal blame.

The existing signed-session activity endpoint now accepts the strict `operation`
vocabulary, whitelisted in employee-operation-policy.ts. Existing JSON storage
is reused; no migration. Events deduplicate by attempt/stage, retain existing
600/day cap, 90-day retention and service-session exclusion. Capture is best
effort, not awaited by business actions and guarded against collector exceptions.
No new financial, payroll-calculation, schedule-validation or notification-send
logic was introduced. Report reads persisted data and does not refresh 1C.

### Coverage limits / release gate

- This is not complete surveillance of every action. Earlier unrecorded actions
  cannot be reconstructed. Old versions lack the new operation events.
- Offline telemetry is best effort, not a second durable outbox. Missing client
  events do not prove an employee did nothing. Financial outbox is unchanged.
- Schedule measures the first refresh per visible period; not all background
  refreshes. Local draft/photo steps, some validation/cancel paths, old-day
  closure and shift changes are not exhaustively instrumented by this change.
- A completed response can precede a later local cleanup/refresh failure; that
  response is not labelled completion of the whole financial workflow.
- 1C confirmation time is the portal's recorded time, not independently proven
  time/actor of the human action inside 1C. Manual resolution is distinguished.
- Live employee iPhone/PWA and live 1C end-to-end were not tested. Before release,
  review the local UI and verify a controlled real-device workflow; do not claim
  universal capture or zero regression risk from these checks.

### Current verification

- 55 activity/policy/interaction/projection/client tests passed, including 10
  isolated PostgreSQL integration tests and visibility/return lifecycle tests.
- 84 existing cash-outbox/replay, photo, schedule, payroll-view and handover
  regression tests passed. The source-extraction cash harness received a no-op
  audit stub; its business assertions were not weakened.
- All 78 `npm run test:payroll` tests passed.
- Real local HTTP test passed: role/actor isolation, invalid dates and unsafe
  input rejection, operation write/readback. Only isolated test DB was used.
- TypeScript, optimized Next.js build and diff whitespace checks passed.
- Authenticated shared component checked at localhost:3186: search, section and
  problem filters, details and empty states. 390×844 responsive check: dialog
  clientWidth=scrollWidth=364, no horizontal overflow. Viewport reset afterwards.
- Preview is explicitly fictional; not Milana's actual activity or phone screen.
  Existing dependency advisories were not remediated. Unrelated worktrees intact.

### Exact candidate files

UI/capture:
`app/(dashboard)/admin/employees/EmployeeDayReport.tsx`,
`app/(dashboard)/admin/employees/activity-preview/EmployeeDayPreview.tsx`,
`app/(dashboard)/admin/employees/activity-preview/demo-report.ts`,
`app/(dashboard)/employee/EmployeeTodayClient.tsx`,
`app/(dashboard)/employee/payroll/PersonalPayrollClient.tsx`,
`components/EmployeeActivityTracker.tsx`, `components/EmployeeOperationAudit.ts`.

Server/projection:
`lib/employee-activity-policy.ts`, `lib/employee-activity-report.ts`,
`lib/employee-activity.ts`, `lib/employee-audit-timeline.ts`,
`lib/employee-activity-view.ts`, `lib/employee-operation-policy.ts`,
`lib/employee-process-view.ts`.

Tests:
`tests/cash-outbox-lifecycle.test.cjs`,
`tests/employee-activity-http.test.mjs`,
`tests/employee-activity.integration.test.ts`,
`tests/employee-activity-view.test.ts`,
`tests/employee-operation-client.test.cjs`,
`tests/employee-process-view.test.ts`.

Handoff: this document. Existing root workspace changes were not edited.

## Follow-up: actual local browser capture, 2026-10-26

Continued the approved validation, not deployment. Used the actual employee UI
on localhost:3186 with the isolated `activity-employee` account; ADMIN readback
on 127.0.0.1:3186. No production users, push subscriptions or 1C writes.

- At 16:34 MSK opened October schedule, selected 27 October and saved a working
  day. ADMIN recorded one view, the save attempt/response and persisted
  `не указан → рабочий день` result.
- At 16:35 opened the seeded informational notification from 24 October. Its
  incomplete test fixture produced a card-load failure. ADMIN separately showed
  visible display, explicit opening and the same `load_failed` event.
- At 16:38 opened October and September payroll and retried September loading.
  The isolated account has no verified payroll calculation. ADMIN showed one
  view per month, unavailable outcomes, and two load attempts for September;
  retry did not inflate view count. Payroll flags were enabled only in the
  local server process, not in an environment file or production.
- The local database also contains deliberate API-test events from earlier
  checks. It must never be presented as a real employee's day.
- Fixed long elapsed intervals: days/hours replace thousands of minutes.
  Removed the irrelevant 1C-posting explanation from schedule/payroll response
  details; it remains only on cash responses.
  Changed `lib/employee-process-view.ts`, `lib/employee-audit-timeline.ts`,
  `tests/employee-process-view.test.ts` and this evidence note in this follow-up.
- 31 focused integration/projection/client checks and the real HTTP auth /
  operation readback test passed again. Optimized build and whitespace checks
  passed; no release or schema migration. The final contextual-copy correction
  passed 25 projection checks; final build includes its type checks.

Physical iPhone/PWA and live 1C end-to-end remain unverified. This browser check
does not close that gate. No claim of complete historical capture or reading.

## Release preparation against 1.18.5 — 2026-10-26

Owner approved the compact `Требует проверки` count/filter and declined setting
up a separate phone QA environment. Physical iPhone/PWA remains explicitly
unverified; no claim that the desktop responsive test replaces it.

- The filter counts affected operations within the selected section/search,
  not individual repeated errors. Recovered errors remain in the full journal.
  Ordinary confirmation prompts and unopened informational messages do not
  create review cases. Main rows show specific recorded failure reasons.
- Public release metadata and fetched deployment branch both reported 1.18.5.
  Fetched branch head: `0821828`. Activity implementation was committed locally
  as `996d7c1`, then integrated with that deployment branch in `12e8629`.
- The overlap in EmployeeTodayClient was resolved preserving the weekly
  schedule query, loaded-week state, attention-refresh event and request body.
  Activity capture uses the selected week when present; polling is still bounded.
- Added a source-executed regression checking both weekly/monthly requests,
  retained attention refresh and one audit pair per viewed scope. The focused
  compatibility suite passed 47 checks.
- After integration: 148 activity/cash/schedule regression checks, 78 payroll
  checks and the optimized production build passed. Weekly schedule API/helper
  and attention-panel source match the fetched deployment branch unchanged.
- No production push, deployment, migration, financial writes, notification
  sending or version allocation occurred during preparation. Recheck live and
  deployment-branch versions immediately before an approved release.

## Production release 1.18.6 — 2026-10-26

- Owner authorized release. Runtime commit: `cf6d172e139060c96914451d390fac215ed1fe82`.
- Public release metadata and authenticated ADMIN footer independently show
  1.18.6, build `2026-10-26T16:03:06.555Z` (19:03 MSK).
- Server checkout matches the runtime commit; portal-app is running/healthy,
  image `sha256:4a9b0cb449891cae83db3fbdee06ce91f5ffaa32eb77cce56ebd25e6ea7f89d6`.
- Initial SSH connection dropped during image export before replacement;
  previous 1.18.5 remained healthy. Exact-release retry ran detached on the
  server and completed successfully. Only unused build cache was reclaimed;
  database, uploads, containers and verified rollback images were preserved.
- Production employee Activity report loads; review-only filter was toggled
  on and off successfully. Legacy missing telemetry remains explicitly unknown.
  New client telemetry requires the employee client to load the new release.
- Five release-metadata tests and production build passed in addition to the
  candidate checks above. Physical iPhone/PWA and live financial execution
  remain untested; no test financial operations or notifications were sent.
- After independent UI/public checks, server image/health was rechecked and
  `portal-storage-maintenance --register-verified` succeeded (`VERIFY_EXIT=0`).
