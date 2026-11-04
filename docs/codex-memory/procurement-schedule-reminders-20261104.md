# Procurement personal schedule reminders — released 1.21.22, 2026-11-04

Owner explicitly approved giving Astemir and Muhamed the same personal schedule
completion reminders as other employees. Released with the approved shift picker
in1.21.22 /5a7e8d3. Final production verification and delivery limits are recorded
in workday-shift-choice-candidate-20261104.md; the sections below retain the
initial isolated verification evidence.

## Approved behavior and boundaries

- Active Procurement EMPLOYEE accounts join the existing today/tomorrow rule,
  in both PROCUREMENT and WORKDAY cabinets. The reminder does not require an
  active shift or cashier checklist. No special name or account-ID matching.
- Only missing Moscow today/tomorrow dates matter. Working, off and an active
  vacation cover a date. Later gaps remain optional; the calendar is unrestricted.
- Same existing minute worker from 08:30; one persisted daily cycle per person.
  Existing employee quiet hours, retries and successful-delivery suppression stay.
- One missing date opens the existing day sheet; two open the normal calendar.
  Direct calendar/ADMIN/vacation changes immediately retire live action and push
  eligibility. Reading/cancelling does not complete the task. History is retained.
- Procurement is not added to ADMIN staffing questions or seller replacement
  actions. Existing legacy seller replacement rows do not become new Procurement
  attention just because personal completion is enabled.
- No salary rules, cash, fiscal/KKM matching, shift selection, accounts/access,
  schema/migrations, production schedules, environment or uploads changed.
  The proposed redesign of staffing reminders remains deferred by the owner.

## Runtime and tests

- lib/schedule-near-reminder.ts
- lib/employee-schedule-attention.ts
- lib/schedule-coverage-reconciliation.ts
- tests/schedule-near-reminder.test.ts
- tests/procurement-schedule-reminders.integration.test.ts

The shared department list applies only to personal completion. The separate
Retail/Wholesale staffing loop and its ADMIN event policy are unchanged.

## Verification

- 272 Workday tests (262 server-condition + 10 capture/date tests) passed.
- 27 adjacent ADMIN attention, mobile navigation, inbox and icon tests passed.
- One real PostgreSQL lifecycle integration passed for both portal areas:
  worker timing/deduplication, inactive/ADMIN exclusion, direct save, live bell
  destination, read-is-not-complete, vacation, date rollover, retained delivery
  evidence and no second successful push after same-day reactivation.
- TypeScript, production build and diff whitespace passed.
- Dedicated empty integration DB: procurement_schedule_test_20261104 at
  127.0.0.1:55481. Run with PROCUREMENT_SCHEDULE_REMINDER_TEST=1 under
  --conditions=react-server --import tsx. The test asserts the exact local DB and
  zero subscriptions before writing synthetic data; no source/financial readers.
- Real local app uses separate procurement_schedule_preview_20261104 at the
  same localhost instance. Two synthetic accounts are visibly labelled demo.
  The normal dispatcher created both daily messages with not_configured push
  state and zero device subscriptions; no provider acceptance is fabricated.
- At 390x844 the Astemir cabinet retained its three mounted sections and shared
  header/bell. Both missing -> normal month -> save today directly -> tomorrow
  action -> one-day sheet -> cancel/reopen -> save off -> no action. The Muhamed
  WORKDAY cabinet shows the same personal reminder and direct bell-to-day editor.
  Document width375 <= viewport390. No new styling or rebuilt mock screen.

Screenshots:
- /tmp/mobo-procurement-schedule-both-20261104.jpg
- /tmp/mobo-procurement-schedule-tomorrow-20261104.jpg
- /tmp/mobo-procurement-schedule-day-editor-20261104.jpg
- /tmp/mobo-procurement-schedule-completed-20261104.jpg
- /tmp/mobo-procurement-schedule-muhamed-20261104.jpg

No physical-phone push or overnight device resume was tested. Root Workday
business tests cover rollover; real provider delivery awaits an approved release
and normal production missing-date case. Existing unrelated checkouts untouched.

## Separate read-only shift investigation

The owner asked why Zukhra/Magomed appeared to start from09 rather than11.
Live ADMIN cards on November4 show Zukhra November3 as11:00–20:00, actual10:56,
and Magomed November4 as11:00–20:00, actual10:36. Their History sections show
09:00–20:00 ->11:00–20:00 corrections at17:57 November3 and11:55 November4.
These are existing production changes, not writes made by this candidate.

The current start picker opens after QR, but the complete one-person Retail plan
normally permits only09_20 unless an already-recorded colleague supplies a paired
shift. An unrecorded/shiftless morning helper does not supply that evidence.
This explains why an open picker can still offer no actual choice. The owner
subsequently approved free department-shift choice with an optional suggestion;
see workday-shift-choice-candidate-20261104.md for the approved combined release
and real production verification. Do not infer a later planned start merely from a
late actual QR mark. No historical production shifts were changed here.
