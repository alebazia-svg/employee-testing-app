# Schedule notification correction — 2026-10-26

Status: released and independently verified as 1.18.9, source
401a2a7098393baad8b73f40a5f66fc1fab9eb7f, following explicit owner production
approval on 2026-10-26. Built from production 1.18.8 / 7b56cae plus the scoped
correction a1f8b97. This owner clarification supersedes the weekly obligation
described in schedule-week-reminder-candidate-20261026.md.

## Behavior

- Wholesale target: one. One or two working employees is normal.
- Retail target: two. One is a soft replacement question, not an employee error
  or a hard shift block. Zero in either department needs attention.
- ADMIN staffing questions apply to today/tomorrow, once all individual plans
  are filled. A missing plan creates personal completion work, not a false claim
  that the department is empty. Repeated checks reuse the department/date event.
- Personal completion covers today/tomorrow only, with one daily persisted
  reminder per employee. Working/off/vacation counts as filled. The current
  missing-day qualifier stays visible. Clicking opens the existing normal
  calendar on the first missing date; no forced weekly range.
- Live plan checks remove completed obligations from attention, bell and push
  eligibility immediately. Ordinary reconciliation retires old weekly/date fill
  rows while preserving history. Legacy pushes already accepted today are not
  resent under the new kind. Actual colleague replacement requests remain
  separate and retire when coverage recovers.
- No schema/migration, payroll rule, employee scoring, fiscal/1C change or manual
  production DB write. Two days off per week are context, not a newly enforced
  payroll or scheduling constraint.

## Verification

- Full workday suite: 191 passes; adjacent notification/attention tests: 40 passes.
- Real isolated PostgreSQL lifecycle: passed, including old morning wholesale
  attention removal before worker execution, both-off recovery, retail soft
  question and two-worker recovery, near-day deduplication and immediate bell/
  push ineligibility after saving off. Test is opt-in, SCHEDULE_POLICY_INTEGRATION=1,
  and guarded to the dedicated localhost schedule_policy_test database.
- npx tsc --noEmit and npm run build passed. No production migration required.
- Actual authenticated local app, fake users in the isolated database: ADMIN
  showed exactly two seeded retail questions and no obsolete wholesale case.
  Employee saw only “Завтра не заполнен”; opening the normal calendar, saving
  tomorrow as off and returning removed the reminder immediately. Screenshot:
  /tmp/mobo-schedule-policy-admin.jpg.
- Physical phone/push appearance remains unverified. No real employee messages
  were sent during local tests; ordinary production dispatch uses the approved
  application policy. Production verification is recorded below.
- Main checkout's unrelated dirty files were left untouched.

## Exact runtime and test files

- components/workday/EmployeeAttentionPanel.tsx
- lib/employee-action-reminder.ts
- lib/employee-notification-snapshot.ts
- lib/employee-schedule-attention.ts
- lib/schedule-coverage-question.ts
- lib/schedule-coverage-reconciliation.ts
- lib/schedule-near-reminder.ts (new)
- lib/work-schedule-coverage.ts
- lib/work-schedule-notifications.ts
- lib/workday-notifications.ts
- package.json (near-day test in test:workday, release 1.18.9)
- package-lock.json (both root versions synchronized to 1.18.9)
- tests/employee-schedule-attention.test.ts
- tests/schedule-coverage-question.test.ts
- tests/schedule-near-reminder.test.ts (new)
- tests/schedule-policy-lifecycle.integration.test.ts (new)
- tests/schedule-week-reminder.test.ts
- tests/work-schedule-coverage.test.ts

## Production release verification

- Owner explicitly chose “Выпустить на рабочий портал”. Fresh live metadata
  and origin/design-local-updates were both 1.18.8 before choosing patch 1.18.9;
  rechecked before push. Server previous commit was
  7b56caee68e0c2554614dae8a9e5410b23e320ae; exact target independently read over SSH
  is 401a2a7098393baad8b73f40a5f66fc1fab9eb7f.
- Public version 1.18.9, builtAt 2026-10-26T17:13:34.277Z (20:13 Moscow).
  Authenticated ADMIN version/build label agrees. Existing Docker metadata
  revision remains null/source unknown; server identity was checked separately.
- Public health ok, container running/healthy. Current image:
  sha256:b2fb99d2481fc3c31dff05df2a59aca3ff43816dbe971c090de961d3cc76a9a0.
  Previous image / reserve 1:
  sha256:7382104f00e1bd029cafddc0fa4ba847a6913e788849d28872c2cf8efbe66705.
  Reserve 2:
  sha256:4a9b0cb449891cae83db3fbdee06ce91f5ffaa32eb77cce56ebd25e6ea7f89d6.
  All three verified registry entries existed before build. Registration was
  performed after independent verification and after releasing the deploy lock.
  Release exit code 0. Server.env hash and uploads mounts matched before/after.
- No migrations or manual production schedule/notification data edits. Existing
  approved retention was available but not needed: free space was 18 GiB before
  and 17 GiB after build. No cleanup executed in this release.
- Under the owner's authenticated account, the actual 09:11 “Опт · 26 октября:
  неполный график” disappeared from attention, count 6 -> 5. Other five matters
  remained. The original 09:11 record is still present in History. Screenshot:
  /tmp/mobo-schedule-policy-1.18.9-inbox.jpg.
- Real read-only employee inspection: Zukhra has working days on 26/27 October
  and unfilled 28-31 October. No completion reminder is shown. The normal monthly
  calendar remains accessible. No employee plan/answer was submitted. Screenshot:
  /tmp/mobo-schedule-policy-1.18.9-employee.jpg.
- Ordinary notification service ran after restart, 17:19:04–17:19:32 UTC,
  ExecMainStatus=0, inactive afterward. Its privileged journal is not readable by
  bela; individual provider-delivery counters were not independently inspected.
- Release metadata checks: 5 passes. Final TypeScript and optimized build passed
  locally; server build and health checks passed. Physical iPhone rendering and
  new real push delivery are not claimed. Main checkout WIP remains untouched.
