# Schedule reminders: today and tomorrow — local candidate

Owner explicitly replaced the weekly obligation after production 1.18.5:
if today and tomorrow are filled, an empty later date must not cause a reminder.
The previous default weekly calendar was rejected as misleading. This decision
supersedes the weekly policy in schedule-week-reminder-candidate-20261026.md.
Current phase: production 1.18.11 released, independently verified and registered
with two verified rollback images. Exact evidence is recorded below.

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
- package.json (test command and shared release version)
- package-lock.json (synchronized release version)
- tests/employee-schedule-attention.test.ts
- tests/schedule-dispatch.integration.test.ts
- tests/schedule-reminders.integration.test.ts
- tests/schedule-week-reminder.test.ts (legacy API range compatibility only)
- tests/schedule-week-bulk.integration.test.ts (calendar date/parity contract)
- tests/schedule-near-reminder.test.ts
- tests/employee-operation-client.test.cjs (preserve activity capture with the unrestricted calendar)
- tests/schedule-policy-lifecycle.integration.test.ts (allow a separate isolated release-test DB)
- docs/codex-memory/project-index.md
- docs/codex-memory/schedule-week-reminder-candidate-20261026.md
- docs/codex-memory/schedule-near-reminder-candidate-20261026.md

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

## Approved production release preparation — 1.18.11

Owner explicitly approved release. Fresh live/branch checks found concurrent
1.18.9 staffing and 1.18.10 cash releases; both are preserved by merges. The
former keeps wholesale one-worker coverage normal and retail one-worker
coverage a soft replacement question. Existing activity capture remains in
the unrestricted calendar load/save flow. No other runtime domains differ
from the concurrent deployment source 72418f4. No schema, Dockerfile or compose
change; the previous image is schema-compatible for rollback.

Source: 93688f7044ecf618a4a4a49c5b5dda3fe0bd6496. Runtime work b57142c;
merged staffing/activity f70f607; merged cash release 72418f4 retained. Package
and both lockfile versions are 1.18.11. An unpublished local 1.18.10 preparation
was advanced after the deployment branch independently used that number.

Final combined verification passed: 188 workday tests, 66 adjacent reminder/
activity/cash-timing tests, five release metadata tests, TypeScript, production
build and four isolated DB/HTTP lifecycle tests. Three use the established demo
DB serially; the staffing lifecycle uses the fresh schedule_policy_test_near_release
DB. The other chat's original policy DB already contained separate preview
employees; those fixtures were preserved rather than changed to make a test pass.
The first pre-merge test expecting a two-person wholesale target was corrected
to the accepted one-person target; zero coverage is tested in the isolated policy
lifecycle. The final real local PWA still opens the one-day native editor.

Server scripts: /tmp/mobo-schedule-near-1.18.11-server.sh and the matching
observe script/Native Terminal .command. They wait for the previous release's
successful verification, serialize the build with the shared storage lock,
verify all three reserve images and 15 GiB free space, preserve env/upload
mounts, build only portal-app, and wait for independent verification before
registering the new image. Previously approved retention is used only if the
disk gate requires it. No manual production business-data edits or migrations.

## Production verification — 1.18.11

Release exited 0. Independent SSH read confirms server commit
93688f7044ecf618a4a4a49c5b5dda3fe0bd6496; public metadata and authenticated ADMIN
footer agree on 1.18.11, built 2026-10-26T17:38:21.124Z (20:38 Moscow). Metadata
revision remains null under the existing Docker pipeline; exact source was
verified separately over SSH. Public health returned ok; employee, workday and
schedule route checks returned 200 without persistent 500s. Separate observer
confirmed the new running image healthy. Env hash and upload mounts were unchanged.

Authenticated read-only ADMIN inspection of the actual Zukhra PWA confirms the
ordinary month with no week tab. Both 26 and 27 October are working; 28–31 remain
empty. No completion action is shown, correctly ignoring the later empty dates.
No real plan was changed to manufacture a missing-day example; one-day direct
editing/save/cancel was verified in the isolated database. Screenshots:
/tmp/mobo-near-production-1.18.11-admin.png and
/tmp/mobo-near-production-1.18.11-calendar.png. Actual inspected content width
was 375px, with no horizontal overflow. Preview remains read-only.

Registered verified image set:
- Current 1.18.11: sha256:8e8c6354c61a76fe095bb57643602aadc2191a27fda176b67ef66d539cf6c4e1
- Previous 1.18.10: sha256:1acbd3acca78528bc961a9a40a11a7ee89d483194f7906ec8d204ba37b35b127
- Previous 1.18.9: sha256:b2fb99d2481fc3c31dff05df2a59aca3ff43816dbe971c090de961d3cc76a9a0

The approved retention pass removed eligible older portal rollback images and
unused build cache; it did not prune containers, volumes, uploads or backups.
Final free disk: 19,314,655,232 bytes (17.99 GiB). The shared deployment lock was
released before verified-image registration. No schema migration, environment
edit, manual production business-data write or 1C publication occurred. Main
checkout's unrelated work and the activity stash remain untouched. Physical
device display/delivery of a real push and actual overnight resume remain unverified.
