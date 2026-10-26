# Schedule reminders candidate — 2026-10-26

Release preparation approved; candidate 1.18.2, not deployed. Owner approved schedule/reminder changes first,
with real local PWA and ADMIN visual review before any release. Detailed activity
instrumentation is deferred: saved separately in the named schedule-activity Git
stash; do not accidentally include it in the first release.

- Preserve Team Today layout and actual shift/start statuses. Schedule questions
  describe the recorded plan, never claim a shop is empty or someone is absent.
- Existing workday dispatcher produces missing-own-plan questions from 08:30 MSK
  for today, and from 18:00 for tomorrow, for active retail/wholesale employees.
  Vacations and saved working/off plans are excluded from fill requests. Existing
  explicit working-to-off coverage reductions can ask known days off about a
  replacement. No automatic assignment or shift-close block.
- Date-specific existing fingerprints keep one question per person/date. Read
  does not answer. Saving that date directly in the calendar (single/bulk/admin)
  removes it through live-state filtering; pending delivery is retired. A direct
  answer is final; only an auto-retired question may reopen on a later plan loss.
- Push target is per date, not per month. Future calendar pushes wait until the
  previous day at 18:00, and existing employee quiet hours remain in force. This
  avoids dispatching a whole month's questions at once. No device subscriptions
  are configured in the local demo.
- One ADMIN source per department/date, refreshed against saved plans/vacations.
  Restored coverage and past dates leave active attention even after reading.
  Wording gives names and planned statuses. Existing ADMIN attention digest is
  reused, with its existing quiet hours. No Telegram delivery added.
- No schema/migration, production data/env/uploads, payroll, receipt matching or
  source-cutover changes. The same saved application schedule as existing PWA
  questions is used; Google integration is neither disabled nor overwritten.

Preview uses isolated schedule_preview_20261026 on 127.0.0.1:55471, app port 3212.
Employee host 127.0.0.1, ADMIN host localhost keep local cookies separate.
The actual local PWA verified question opening/closing, direct calendar save and
immediate retirement, warning cancellation preserving plan, and confirmed day
change updating the existing ADMIN question without another copy.

Validation: 172 workday tests, 20 ADMIN attention/view tests, 5 version tests, two
isolated real PostgreSQL lifecycle/dispatcher tests, TypeScript and production
build passed. The full dispatcher test covers production scheduling, sent-state
creation, read without resolution and retirement after a direct calendar save.
Physical device push not
verified. Activity detail follow-up remains outstanding.

Release preparation:

- Runtime candidate: `426a50db79652562b376582f2e6e663048cc3962`.
- Current inspected production/deployment branch: 1.18.1; live build
  `2026-10-25T22:16:39.847Z`, runtime `9b944cdf788c5d68894c0234541ba74537c5a07e`.
- Candidate version is not reserved against other chats; re-fetch and compare
  live metadata immediately before any deployment-branch push or VPS launch.
- Rollback remains schema-compatible; no database migration, env, compose,
  upload-volume or external 1C publication changes. Only portal-app needs rebuild.
- No production launch or real employee notification was performed during
  preparation. The separate activity stash and ignored follow-up note are not
  part of this candidate.

Changed runtime/test files:

- `app/(dashboard)/employee/EmployeeTodayClient.tsx`
- `lib/admin-inbox-attention-policy.ts`
- `lib/admin-inbox-data.ts`
- `lib/admin-operations-view.ts`
- `lib/employee-schedule-attention.ts`
- `lib/schedule-coverage-question.ts`
- `lib/schedule-coverage-reconciliation.ts`
- `lib/work-schedule-coverage.ts`
- `lib/work-schedule-notifications.ts`
- `lib/work-schedule-persistence.ts`
- `lib/workday-notifications.ts`
- `package-lock.json`
- `package.json`
- `tests/employee-schedule-attention.test.ts`
- `tests/schedule-coverage-question.test.ts`
- `tests/schedule-dispatch.integration.test.ts`
- `tests/schedule-reminders.integration.test.ts`
- `tests/work-schedule-coverage.test.ts`
- `tests/work-schedule-notifications.test.ts`
