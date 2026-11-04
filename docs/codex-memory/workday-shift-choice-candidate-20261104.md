# Suggested shift and free choice — released 1.21.22, 2026-11-04

Owner approved allowing Retail11:00–20:00 even with one planned employee, then
explicitly extended free selection to all usual Retail/Wholesale shifts,
independent of plan completeness and colleagues' selections. Latest refinement:
retain the original helpful suggestion, show other shifts separately, and show
the real screen before release. The owner approved the exact real local picker and combined release on November4.
Final checks and production installation completed successfully.

The release is intended to include the already-verified Procurement personal
schedule reminders in procurement-schedule-reminders-20261104.md. The real revised picker was shown and approved.
Release1.21.22 is prepared at5a7e8d3; the production/base at preparation
is1.21.21. Its two-percent payment completion rule is preserved.

## Approved interaction

- After actual QR confirmation, show the existing picker and require an explicit
  employee choice. No automatic workday start and no choice inferred from time.
- Reuse the old solo/pair/remaining-shift algorithm only for a suggestion:
  `По графику на сегодня` or `С учётом смены коллеги`. Show remaining usual
  department shifts immediately below `Другая смена`, without another disclosure.
- Retail always permits09_18,09_20,11_20; Wholesale09_18,09_19,10_19. Empty/off
  plans, one planned employee, unknown colleagues or their earlier choices do
  not remove options. A failed/slow recommendation read yields all options;
  the optional picker read is bounded to1.5seconds.
-Actual colleague marks outrank incomplete plan data. An opening colleague
  suggests the paired late shift. Without that evidence, from30minutes before
  the department late start suggest10–19 Wholesale/11–20 Retail by Moscow QR
  time; earlier complete plans suggest the usual opening/long shift. Two late
  arrivals do not suggest a fictitious early start to the second employee. All
  alternatives remain visible. Reused QR intents retain their original time,
  rather than acquiring a new clock time when the picker is reopened.
- Starting and correcting never query the plan for permission. QR ownership,
  expiry, department support, idempotence, nonempty template and serializable
  guards remain. Self-correction remains limited to the existing five-minute
  window and rejects a checklist with saved facts/financial actions.
- Lateness uses the original QR timestamp and the chosen start. Checklist
  deadlines and end time use the selected existing template. Never rewrite
  existing production workdays or invent a helper's attendance.
- Until an employee actually chooses, colleague cards show a working-day plan,
  without inferring fixed hours from headcount/another person's selection.

## Exact runtime/test changes in this phase

- lib/workday-shift-selection.ts
- lib/workday-colleague-shift.ts
- app/api/employee/workday/start-intent/route.ts
- app/(dashboard)/employee/EmployeeTodayClient.tsx
- tests/workday-attendance-shadow.test.ts
- tests/workday-colleague-shift.test.ts
- tests/manual-shift-start.integration.test.ts

The prior Procurement reminder commit isad52876. This candidate also retains
production1.21.21 /4a2b257 and its docs via a normal merge. No financial matching,
1C client, payroll rule, schema, upload or environment runtime changes.

## Dependency audit and verification

-266 Workday tests passed (256 main +10 capture/date).
-296 terminal/fiscal tests passed; one optional live-OFD fixture test skipped.
-30 adjacent workplace, ADMIN attention, mobile navigation and production
  small-remainder regression tests passed.
-Two real isolated PostgreSQL tests passed: Procurement reminder lifecycle;
  actual start-route handler with real persistence/templates/notifications for
  all six department shifts under solo, empty-plan and colleague-started cases
  (18 scenarios), replay, original QR reuse, a real alternative choice,
  five-minute correction and refusal after saved facts.
-TypeScript, production build and diff whitespace passed.
-Fiscal attribution/admin gate/review participants use actual startedAt/endedAt
  and dated KKM/cashier evidence. Their logic, equipment bindings, global
  terminal/1C/OFD matching, financial totals, source safeguards and historical
  persistence are byte-unchanged. Full fiscal regression was run.
-The existing hidden ADMIN typical-combination diagnostic is preserved. It is
  informational (`Необычная комбинация`), not a source of employee errors or
  shift permission. Staffing-notification redesign remains explicitly deferred.

There is an independent baseline test conflict: procurement-payment-history
expects collapsed<details> in split mode, while production source uses a plain
detail panel. With the documented CSS loader,10 pass/1 fail. An independent
esbuild run sourcing all local modules from origin/design-local-updates gives
the identical10/1 result and failing test. No candidate changes to that component
or test. Evidence:/tmp/mobo-baseline-history-20261104.log and
/tmp/mobo-choice-release-history-20261104.log. Do not claim every project test
passes or change accepted Procurement UI to make this unrelated assertion pass.

## Real UI preview

The actual built app atlocalhost3219 uses the isolated
procurement_schedule_preview_20261104 database, synthetic labelled accounts and
loopback-only unavailable1C. No real devices/subscriptions or production writes.
Department QR PNGs were generated locally, selected through the normal photo
chooser and decoded by the real client. The actual start-intent endpoint opened
the picker. Latest examples: Retail11–20 suggested by QR time, with09–18/09–20 below; Wholesale10–19 suggested after an actual09–18 colleague, with09–18/09–19 below.
Unchanged shell, icons, theme and surrounding page are actual application UI.

-/tmp/mobo-shift-choice-retail-20261104.jpg
-/tmp/mobo-shift-choice-wholesale-20261104.jpg

No physical-phone capture/push, live employee shift start or real1C write was
tested. Procurement financial source is deliberately unavailable in this demo.
Native QR capture itself is unchanged. Existing unrelated checkouts untouched.

## Final release checks

On the exact1.21.22 candidate:605 passes (266 Workday,296 fiscal,36 adjacent
workplace/remainder/ADMIN/mobile,2 isolated DB lifecycle,5 release metadata).
One optional live-OFD fixture skipped. TypeScript and production build passed.
Logs:/tmp/mobo-12122-*.log. Existing unrelated Procurement-history baseline
conflict remains disclosed and outside scope. No production shift was started
for verification. Production UI and rollback registration are verified below.

## Verified production release

- Owner approved the final real local picker and combined release, then requested
  another compatibility check before deployment.
- Runtime version1.21.22; server commit5a7e8d36ecc8e2074c9c29ec3847673f71eacc31.
- Public builtAt2026-11-04T12:28:54.120Z (15:28 MSK). Public revision is null /
  source unknown because the Docker context has no Git; do not invent metadata.
  Server Git, public metadata, authenticated ADMIN footer and health were
  independently checked after installation.
- Root deployment result:/home/bela/shift-choice-12122-result:RELEASE_EXIT=0.
  Full log:/home/bela/shift-choice-12122-release.log. No migrations executed;
  migrate status showed no pending migrations. All runtime env values, server.env
  and mounted data locations matched the saved preflight hashes. The historical
  November2 user7 workday/run/tasks hash was unchanged. No production schedules,
  attendance, cash operations, financial documents or uploaded photos were edited.
- Running healthy image:sha256:29f92435db1574c30fd5571e508d64acb4dd8a8637a98d597430295b3bf0f8cf.
  Independently verified before registration. Current plus two existing verified
  reserves are present:sha256:e689310bc1aa31ffc537c9120720999ad2efe99a3ef42fea41575fffd75efb74
  and sha256:d3eb916075151404fdc1d7e682b5c6c9fcb112da428776dc55c692a25cd11936.
  Final free space17.22GiB. Shared maintenance lock released before registration.
- Authenticated read-only employee preview verified both real Procurement
  cabinets. Each shows `Заполните график / Завтра не заполнен`; one tap opens
  `Изменить мой день`, November5. Closed without saving; no real employee shift
  was started and no task/notice was marked read/completed by this verification.
- Normal production worker created one personal reminder per person at
  15:35:01 MSK, IDs8941/8942. Existing ADMIN activity report confirms provider
  acceptance for Astemir. Muhamed's in-app reminder exists, but provider acceptance
  is absent. Existing device page shows no confirmed active subscription for his
  iPhone, last observed15:06 before this deployment. He needs to open the bell in
  his own installed app and connect notifications. Do not claim delivery to his
  phone, force a subscription from an administrator's browser, or equate provider
  acceptance with physical display/read confirmation.
- Real production evidence:/tmp/mobo-12122-production-control.jpg,
  /tmp/mobo-12122-astemir-reminder.jpg,/tmp/mobo-12122-astemir-day-editor.jpg,
  /tmp/mobo-12122-muhamed-reminder.jpg,/tmp/mobo-12122-muhamed-push-status.jpg.
  Filtered delivery evidence:/tmp/mobo-12122-astemir-delivery.json and
  /tmp/mobo-12122-muhamed-delivery.json.
- Subsequent owner request concerned changing the past calendar plan, not adding
  actual attendance times. The existing ADMIN Workday pencil already permits
  this for the selected past date with history. Verified its real November3
  dialog without saving. No additional product change was needed or included.
  Evidence:/tmp/mobo-past-schedule-admin-20261104.jpg.
- Unrelated dirty files/checkouts were left untouched. Physical-phone QR capture,
  push display and a real 1C transaction were not tested. Dependencies were not
  upgraded; the existing npm-ci audit warnings and disclosed baseline history-test
  conflict are outside this compatible release.

## Complete changed file manifest

Runtime:
- app/(dashboard)/employee/EmployeeTodayClient.tsx
- app/api/employee/workday/start-intent/route.ts
- lib/workday-shift-selection.ts
- lib/workday-colleague-shift.ts
- lib/schedule-near-reminder.ts
- lib/employee-schedule-attention.ts
- lib/schedule-coverage-reconciliation.ts

Tests:
- tests/workday-attendance-shadow.test.ts
- tests/workday-colleague-shift.test.ts
- tests/manual-shift-start.integration.test.ts
- tests/schedule-near-reminder.test.ts
- tests/procurement-schedule-reminders.integration.test.ts

Routine version fields:package.json,package-lock.json (including root package).
Memory in separate docs commit:this note,procurement-schedule-reminders-20261104.md
and project-index.md. No other product files changed versus production1.21.21.
