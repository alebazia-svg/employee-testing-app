# Weekly schedule reminder — local candidate 2026-10-26

Superseded by the owner's later explicit today/tomorrow-only decision. See
schedule-near-reminder-candidate-20261026.md for the current local candidate.
This document retains the historical 1.18.3/1.18.5 release evidence.

Owner approved a defined weekly policy after reviewing the unshipped monthly
prototype, then explicitly authorized production deployment. Main weekly
reminder was released and verified as 1.18.3; inspection parity follow-up below
was released and independently verified as 1.18.5 after the parallel 1.18.4 release.
Live public metadata and freshly fetched deployment branch were both 1.18.2
before preparing this patch. Runtime commit: 8167990. Previous server source:
d9da4c7cbb7b09b86aeeac3b75c0d0e0d461e041. No migration or schema delta;
rollback to the previous app image remains compatible.

## Production 1.18.3 verification

- Deployed source 9dbe926696bd1632988d07d1bae5e8689bc8b28d, runtime 8167990.
- Public version 1.18.3, builtAt 2026-10-26T15:02:48.195Z (18:02 Moscow).
  Authenticated ADMIN footer matches. Metadata revision is null in the existing
  Docker pipeline; server source was verified independently over SSH.
- Running image sha256:a7245f982dc56194db10411ad090d2494f7698964bdba88e2c4b7620cf0d72b1,
  healthy, public API health ok. Env hash and uploads mounts unchanged.
- Previous image sha256:4cdb1c936362243e998b9afcc1a87bfb5ea9fd83e53c6a7e9740095c225a53ff.
  Verified registry now holds current plus 1.18.2 and 1.18.1
  (sha256:a39a49a9bcdd44182528950bbe1f7927897b97e41859ba27f1ea8afefcc7b0b7).
  Registration succeeded after releasing the deploy lock; release exit 0.
- Real Zukhra read-only inspection shows “Заполните график / Завтра не отмечено”
  and opens the bounded calendar, retaining the unrelated handover reminder.
  No employee answers or schedule edits were made. Screenshots are
  /tmp/mobo-schedule-week-production-1.18.3.png and
  /tmp/mobo-schedule-reminder-production-1.18.3.png.
- No migration, manual production DB write, 1C write or physical-device push
  test. Disk free after release 17 GiB; prior service stayed healthy during build.

## Inspection parity follow-up

Final review found ADMIN inspection dropped the new week query, so a midweek
inspection could still read only today forward. The read-only transport and
inspection GET now forward and validate the same week range as the employee
endpoint. Identity filtering, actor-bound visits and blocked writes remain.
The real isolated HTTP test compares both snapshots, rejects far weeks,
employee access and POST. Transport tests, TypeScript and build passed.
Parallel receipt release a718908 (1.18.4) was fast-forwarded without editing its
files. Its completion/verification was observed before publishing the follow-up.
Public 1.18.4 and its source a718908 were observed before choosing 1.18.5.
Inspection runtime fix b88372f preserves the colleague's receipt changes.
No schema changes.

## Production 1.18.5 verification

- Source 08218287296db57fa1999c662f1802f0735aa877, inspection runtime b88372f,
  version commit c7addd1. Includes the parallel 1.18.4 code and its verified-release
  documentation; none of its receipt runtime files were changed by this task.
- Public and authenticated ADMIN version 1.18.5; build
  2026-10-26T15:27:02.643Z (18:27 Moscow). Server source independently read via SSH.
  Existing public metadata revision remains null/unknown in Docker.
- Current image sha256:6cf1a18ea1a0d5b4a2074f33898262115469287590929c073f3a4cae194bca85,
  running/healthy; public health ok. Previous 1.18.4 image
  sha256:593329090e2d3b7b5456390d5ba254895a5fd50cb1f77bb9099573e2412483cf.
  Verified registry contains current, that 1.18.4 image and the 1.18.3 image above.
  Parent lock released before registration; release exit 0.
- Env hash and upload mounts matched before/after. No migration, manual DB,
  employee plan/answer or 1C write. Daily notification retirement/creation uses
  the approved ordinary worker. Physical-device push display is not verified.
- On the actual employee inspection, Zukhra had filled 27 October while this
  release was in progress. The row correctly stopped saying tomorrow missing,
  remained for later empty days, and opened directly on 28 October in the bounded
  26 October–1 November calendar. Existing receipt/closing reminders remain.
  Screenshots: /tmp/mobo-schedule-admin-1.18.5.png and
  /tmp/mobo-schedule-week-production-1.18.5.png. No actions submitted.
- Final source build, TypeScript, five release checks, preview transport tests
  and the real isolated HTTP parity/authorization/write-blocking test passed.
  Earlier full workday/adjacent/lifecycle checks remain above.
- Disk free after this release is 14 GiB. A future build must reapply the 15 GiB
  capacity gate and the existing approved retention/runbook before starting;
  this task performed no cache/image/volume cleanup.
- Activity follow-up remains untouched in its named Git stash; main checkout
  work was not included. Final changes and evidence are listed in this document.

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
- `app/api/admin/employees/preview/[visitId]/route.ts`
- `components/workday/EmployeeActionReminder.tsx`
- `components/workday/EmployeeAttentionPanel.tsx`
- `lib/employee-action-reminder.ts`
- `lib/employee-attention.ts`
- `lib/employee-notice-icons.ts`
- `lib/employee-notification-snapshot.ts`
- `lib/employee-schedule-attention.ts`
- `lib/employee-schedule-snapshot.ts`
- `lib/employee-preview-request.ts`
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
- `tests/employee-preview.test.ts`
- `tests/work-schedule-notifications.test.ts`
