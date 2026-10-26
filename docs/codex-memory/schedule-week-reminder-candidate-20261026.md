# Weekly schedule reminder — local candidate 2026-10-26

Owner approved a defined weekly policy after reviewing the unshipped monthly
prototype, then explicitly authorized production deployment. Current phase:
release 1.18.3 prepared; deployment/production verification pending.
Live public metadata and freshly fetched deployment branch were both 1.18.2
before preparing this patch. Runtime commit: 8167990. Previous server source:
d9da4c7cbb7b09b86aeeac3b75c0d0e0d461e041. No migration or schema delta;
rollback to the previous app image remains compatible.

## Accepted policy

- Fixed Monday–Sunday weeks, not a rolling seven-day chore. Existing worker
  begins at 08:30 Moscow; Friday requests the following week. Saturday/Sunday
  retain that target, and Monday continues the same persisted question/key.
- During Monday–Thursday, incomplete remaining days of the current week are the
  catch-up target. From Friday the required range includes any still-missing
  current days plus the following week (at most ten future/current days).
  Past gaps and dates after the target Sunday are never required.
- One live fill row and successful push cycle per employee/target week. Old daily
  fill questions retire without deletion. Delivery retries use existing policy;
  reading alone does not complete the obligation. A previously sent resolved
  question may reactivate after a missing plan without another push.
- Compact title “Заполните график” does not imply a maximum planning horizon.
  Factual qualifier “Сегодня не отмечено” or “Завтра не отмечено” takes priority in the same row, not another
  message. A tap directly opens the existing native calendar in weekly mode.
- A missing tomorrow is visible in advance on the same row. The next morning
  changes its qualifier to today without a new source or repeated delivered push;
  reading stays distinct from completion. Verified in isolated PostgreSQL.
- Weekly calendar reuses the month calendar and its editor with a bounded range,
  including cross-month/year weeks. “Неделя / Весь месяц” makes the scope explicit.
  Dates outside the week are never defaulted to off. Whole-month planning remains
  optional. One atomic existing bulk save can span a week across two months.
- The bulk endpoint accepts the additive weekStart scope only for plan mode and
  only for the current week or the permitted next week from Friday. Existing
  authentication, own-user scope, vacation, previous-status/concurrency and past
  date guards remain. Ordinary monthly saves retain their original validation.
- Working, off and active vacation cover a date. Live calendar state controls
  main row/bell relevance; direct single/bulk/admin save needs no notice response.
  Successful calendar synchronization refreshes attention immediately. The same
  reminder is hidden inside its own calendar; unrelated urgent reminders remain.
- Concrete replacement questions stay dated and separate. Unknown plans in
  legacy replacement digests use the weekly request rather than another day row.

## Scope and evidence

No new job, endpoint, schema/migration or production write. Preserves ADMIN daily
plan coverage, Team Today/actual attendance, Google, payroll, receipt matching,
env and uploads. Activity follow-up stays in its separate named Git stash; ignored
receipt-dispatch follow-up is outside this change. Previous monthly prototype
snapshot: /tmp/mobo-schedule-month-before-week-20261026.tar.gz; never released.

Preview: http://127.0.0.1:3212/employee, isolated schedule_preview_20261026 DB on
127.0.0.1:55471, zero device subscriptions. Synthetic staff identities only.

Passed after full verification: 180 workday checks, 21 adjacent reminder/ADMIN
policy/view checks, three real isolated PostgreSQL lifecycle/dispatcher/live-API
tests, TypeScript and production build. Tests
include Friday/weekend/Monday reuse, bounded past/future validation, cross-month,
year and leap dates, vacations, read vs done, full/partial fill, expiry and
coexistence with a dated replacement. Database checks verify no duplicate source.
The actual bulk endpoint rejects unauthenticated requests, distant/past/outside
dates, duplicate dates, missing confirmation, stale previous states and vacation
overwrites. Conflicts are atomic with no partial write/audit. Another userId in a
payload cannot change the authenticated scope; ordinary future month saves still
work. Schedule reminders never displace due checklist/receipt/cash actions.

Actual mobile-width PWA verified one direct opening, all seven dates including
1 November saved atomically from the October week, immediate removal without a
notification answer, and zero writes to 2–30 November. Cancellation without save, re-entry and optional whole-month view were also
verified on the actual final UI. The reminder remains after cancellation.
Final screenshots: /tmp/mobo-week-reminder-final.png and
/tmp/mobo-week-calendar-final.png. No horizontal overflow at 390 CSS pixels. No physical
push display tested and no production deployment. Preview restored for owner.

Owner clarification: the row now says “Заполните график”, while the editor keeps
the exact bounded period and optional whole-month navigation. On the real local
PWA, saving today directly changed the row to “Завтра не отмечено” without another
notice. Screenshot: /tmp/mobo-week-tomorrow-reminder.png. The isolated DB test also
verified the next-day transition keeps source ID, readAt, sentAt and delivered
push state. Targeted tests, TypeScript and production rebuild passed after this
text adjustment. Local preview is left in the tomorrow-missing state.

Full review found and fixed a midweek display gap: weekly mode previously read
only today forward, although its grid includes Monday onward. The existing GET
schedule endpoint now accepts a bounded week query and reads the entire visible
grid, including saved past dates. Required fill dates and server write guards
still begin today. Wednesday and Friday range regressions are covered, as are
invalid/far weeks. The final rendered build and API were rechecked afterward;
no browser errors on the reviewed flow. No production or physical-device tests.

## Changed runtime/test files

- `app/(dashboard)/employee/EmployeeTodayClient.tsx`
- `app/api/employee/workday/schedule/bulk/route.ts`
- `app/api/employee/workday/schedule/route.ts`
- `components/workday/EmployeeActionReminder.tsx`
- `components/workday/EmployeeAttentionPanel.tsx`
- `lib/employee-action-reminder.ts`
- `lib/employee-attention.ts`
- `lib/employee-notice-icons.ts`
- `lib/employee-notification-snapshot.ts`
- `lib/employee-schedule-attention.ts`
- `lib/employee-schedule-snapshot.ts`
- `lib/schedule-coverage-reconciliation.ts`
- `lib/schedule-week-reminder.ts`
- `lib/work-schedule-notifications.ts`
- `lib/workday-notifications.ts`
- `package.json`
- `package-lock.json`
- `tests/employee-schedule-attention.test.ts`
- `tests/schedule-dispatch.integration.test.ts`
- `tests/schedule-reminders.integration.test.ts`
- `tests/schedule-week-reminder.test.ts`
- `tests/schedule-week-bulk.integration.test.ts`
- `tests/work-schedule-notifications.test.ts`
