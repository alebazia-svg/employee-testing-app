# Schedule notification correction — 2026-10-26

Status: implemented and verified locally on the receipt-shift-responsibility
worktree, based on production 1.18.8 / 7b56cae. Not deployed; exact production
release approval is pending. The latest owner clarification supersedes the
weekly obligation described in schedule-week-reminder-candidate-20261026.md.

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
- Physical phone/push appearance and production behavior remain unverified.
  No real employee messages were sent during tests.
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
- package.json (adds near-day test to test:workday; release version unchanged)
- tests/employee-schedule-attention.test.ts
- tests/schedule-coverage-question.test.ts
- tests/schedule-near-reminder.test.ts (new)
- tests/schedule-policy-lifecycle.integration.test.ts (new)
- tests/schedule-week-reminder.test.ts
- tests/work-schedule-coverage.test.ts
