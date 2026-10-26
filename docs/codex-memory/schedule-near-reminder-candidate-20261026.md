# Schedule reminders: today and tomorrow — local candidate

Owner explicitly replaced the weekly obligation after production 1.18.5:
if today and tomorrow are filled, an empty later date must not cause a reminder.
The previous default weekly calendar was rejected as misleading. This decision
supersedes the weekly policy in schedule-week-reminder-candidate-20261026.md.
Current phase: implementation and local verification; not released.

## Approved behavior

- Check only Moscow today and tomorrow. Either missing date creates one live
  action with an explicit short qualifier: today, tomorrow, or both. Working,
  off and active vacation cover the date. Past and more distant gaps are ignored.
- The horizon advances every day, across weeks, months, years and leap dates.
  A person may fill only the dates they know, or plan a whole future month.
  Daily action identity changes with the date so a temporary snooze cannot carry
  over to the next day. Existing workday/calendar snapshots update the client's
  current Moscow date after resume instead of retaining yesterday's initial prop.
- One persisted source/push cycle per employee/current Moscow day through the
  existing minute worker beginning at 08:30. No repeating push during the same
  day. A new day's still-missing near plan can create the next daily reminder.
  Provider retries retain the existing delivery policy; opening is not done.
- The PWA action derives from live schedule data, even before a push exists.
  Direct single/bulk/ADMIN/vacation edits remove the action when both dates are
  covered. Removing coverage can reactivate the same day's action without a
  second push. Failure to read the source must not invent a missing plan.
- Tap opens the existing ordinary monthly calendar at the first missing date.
  There is no weekly segment, weekly heading, weekly editor or week parameter
  on new links. Original month arrows and optional upcoming-day view remain.
- Owner-approved interaction refinement: one missing near date opens the
  existing `Изменить мой день` sheet directly over the current screen, with
  `Работаю` / `Выходной`, cancel and a quiet `Открыть график` escape. Both dates
  missing still open the ordinary calendar. Reminder, bell and push links share
  this destination. A single-date link rechecks live near-plan state before
  opening, so a completed/vacation date is not treated as an outstanding task.
  Opening/cancel does not fill the date; saving closes the sheet and removes
  the action. Existing off-day coverage confirmation remains unchanged.
- Previously open clients receive the existing direct-calendar action intent
  without weekStart, so they also open the full month. Legacy bounded API reads
  and writes are retained for already-open clients/drafts, not offered by the
  new interface. This does not permit changes to past days or stale values.
- Retire old daily-fill/weekly sources without deletion. Live filters hide the
  weekly obligation immediately. A legacy push already accepted today prevents
  an extra migration push; the new inbox source does not fabricate delivery
  proof. Dated colleague replacement requests remain separate and unchanged.

## Scope

No new job, endpoint, schema or migration; no production writes/deployment.
Preserves actual workday/Google, ADMIN staffing control, replacement requests,
receipts, KKM, cash, payroll, env, uploads and the separate activity stash.
Uses the existing isolated schedule_preview_20261026 DB, 127.0.0.1:55471;
local preview on 127.0.0.1:3212. Zero real device subscriptions.

## Changed files

- app/(dashboard)/employee/EmployeeTodayClient.tsx
- app/(dashboard)/employee/WorkdayNotificationsClient.tsx
- components/workday/EmployeeActionReminder.tsx
- components/workday/EmployeeAttentionPanel.tsx
- lib/employee-action-reminder.ts
- lib/employee-attention.ts
- lib/employee-notification-snapshot.ts
- lib/employee-schedule-attention.ts
- lib/employee-schedule-snapshot.ts
- lib/schedule-coverage-reconciliation.ts
- lib/schedule-near-reminder.ts
- lib/work-schedule-notifications.ts
- lib/workday-notifications.ts
- package.json (test command only; no release version reserved)
- tests/employee-schedule-attention.test.ts
- tests/schedule-dispatch.integration.test.ts
- tests/schedule-reminders.integration.test.ts
- tests/schedule-week-reminder.test.ts (legacy API range compatibility only)
- tests/schedule-week-bulk.integration.test.ts (calendar date/parity contract)
- tests/schedule-near-reminder.test.ts

## Verification

Passed: 182 workday checks, 23 adjacent reminder/ADMIN/preview checks, five release
metadata checks, three isolated PostgreSQL/HTTP/dispatcher tests, TypeScript,
production build and diff whitespace checks. The integration suite shares a
database/department-wide worker, so run it with --test-concurrency=1. A parallel
test run correctly hit the existing serializable 409 guard; no partial write.
The existing stale-plan guard was preserved.

The actual mobile PWA was tested with the synthetic schedule-zalina account:
both missing -> only tomorrow missing after direct calendar save -> no action
after tomorrow was marked off. Another fixture run verified only today missing.
The next month was opened and 15 November saved directly, without requiring any
intervening dates. DB readback confirms 26 October working, 27 October off,
28 October–1 November still empty, and 15 November working. The reminder stays
absent. Current live preview is left in this filled-near-days/no-noise state.

Screenshots: /tmp/mobo-near-both-missing.png,
/tmp/mobo-near-today-missing.png, /tmp/mobo-near-tomorrow-missing.png,
/tmp/mobo-near-complete.png and /tmp/mobo-near-calendar-open.png. Final checked
viewport is 390 CSS pixels with equal document/content width; no overflow.

No production deploy or business-data edits; no physical-device push or actual
overnight device-resume test. Day transitions are covered by pure and real-DB
tests; the current Moscow date is verified in the live API contract. Existing
unrelated working-tree files and the activity stash remain untouched.

### Direct day editor refinement — local verification

Final source: 183 workday checks, 23 focused reminder checks (overlap with the
workday set), three isolated PostgreSQL/HTTP/dispatcher tests, TypeScript,
production build and diff checks passed. DB integration also verifies that the
bell's current link switches between the one-day editor and full calendar.

Real PWA at 390×844: two missing dates -> ordinary month -> today saved working
-> one tomorrow reminder -> direct day sheet -> tomorrow saved off -> sheet
closes and reminder disappears. DB readback confirms both statuses. Cancel/Escape
preserve the action; Shift+Tab stays inside the sheet. `Открыть график` opens the
selected date in the full month. Repeated bell entry after cancelling was tested
and fixed to use the existing direct event rather than an unchanged route.
An old single-date link after both days were filled opens the ordinary month,
without prompting to fill the already-saved date.

Preview is now left on the synthetic schedule-zukhra one-missing-tomorrow
example, restored solely in the isolated demo DB, for owner interaction. Screens:
/tmp/mobo-near-day-editor-final.png,
/tmp/mobo-near-two-days-calendar-final.png,
/tmp/mobo-near-day-saved-final.png. No horizontal overflow at 390px. Existing
material sheet/button styles are retained; the calendar escape is visually quiet.
Physical-device push delivery, a forced network failure and actual overnight
resume were not tested in this refinement. No release/deploy/version bump.
