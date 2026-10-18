# Team control and schedule — 2026-10-18

Owner approved the integrated ADMIN daily-control/schedule UI and production
release on 2026-10-18. This replaces the earlier local snapshot proposal with
source-backed views, preserving the working Google integration and all existing
ADMIN correction, task, issue and technical workflows.

## Current rollout policy

- The one-person app pilot remains Liana (canonical attendance identity).
  Other active Retail/Wholesale staff remain on Google for the primary schedule
  and arrival/departure presentation. `usesAppSchedule` in `lib/team-control.ts`
  centralizes this explicit pilot decision; it must be revisited together with
  an approved expansion/cutover, never silently inferred from a missing mark.
- Google plan, Google Form marks and portal schedule rows stay separate. A form
  mark does not create a plan. Conflicting plans remain unknown.
- Procurement/Operations staff, including Astemir, are outside shift-control
  counts. This does not change their account, compensation or persisted data.
- Neither this UI nor its refresh performs an import, schedule write, source
  cutover, notification send or payroll action. The sources page explains the
  current mode; it does not pretend to save integration settings.

## Interface decisions

- Keep Schedule and Daily Control separate, linked by selected date/employee.
- Reuse shared ADMIN section tabs. Subordinate filters have quiet selection and
  no copper underline. Department bands retain visible cool-grey grouping.
- Department summaries show plan, starts, days off/leave and unknown plans;
  timing exceptions and required issues are collected under Need action.
- Task deadline and server-recorded completion are distinct from reconciliation
  result. Timeliness uses Moscow date/time, including next-day completion.
- Future pending tasks must not inflate unavailable completed-check counts.
  The detail summary must not claim no action while completed checks need review.
- The original detailed Google report remains available in a disclosure, with
  its filters and history preserved. Calendar supports primary/app/Google layers,
  week/month, unknown-range compression, source details and date-preserving links.
- Google snapshot is read-only, cached 30 seconds, bounded at 12 seconds per
  source and labelled with read time. Visible-page refresh is 60 seconds and
  avoids active dialogs/inputs; existing app revision synchronization remains.

## Verification / release

Target version: 1.5.0. Code commit: f745a8443c559b218be64791d0d0555469be69cd.
Local TypeScript, production build and 33 focused tests passed. Authenticated
actual app checked against an isolated local PostgreSQL database and saved
Google snapshot. No local test records or source fixture are in the release.
Browser checks covered filters, five eligible staff, two issue cards, task
planned/completed times, week/month, calendar dialog/Escape and 390px layout
(no document overflow; calendar scrolls inside its container).

Production activated successfully on 2026-10-18. Public team.mobo-opt.ru
reports 1.5.0, builtAt 2026-10-18T10:51:47.688Z (13:51 MSK). Independent SSH
readback confirms server commit f745a8443c559b218be64791d0d0555469be69cd;
only the pre-existing untracked .rollback/ remains. Public health is 200.
Metadata revision remains null under the existing Docker convention; commit
was verified separately, not inferred from the visible label.

Backup: /docker/employee-testing-app/.rollback/team-control-1.5.0/database.dump
(21,646,027 bytes; pg_restore listing validated). Previous image:
sha256:d2604ae718a62e5f4c1769480c9031c0da3adfe61bc814c4cf90dd389ef73bb4,
tagged portal-app:rollback-before-1.5.0. Replacement image:
sha256:60e67205cee0132b8f3c141ee02912ba9c0913692c24acc0cf08380f3b72c659.
The release script confirmed the same environment hash, mount set including
/app/uploads, and identical cashbox-mapping/template fingerprints. Counts of
users, schedules, schedule audit, workdays, checklist runs/tasks, cash operations,
vacations and control issues did not decrease. No schema change means rollback
to the preserved image is database-compatible.

Authenticated production Edge checks confirm five eligible staff, app start
08:46 and actual cash completion 09:00 in time for Liana, Google starts
09:02/11:01, Milana off and two unknown plans. Both actual Zukhra issue documents
00OF-010876 (120,000 RUB) and 00OF-011445 (185,180 RUB) remain available.
Week/month calendar and shared visible footer 1.5.0 were checked. Source switching
was not applied; no real correction, message or notification was sent.

Limits: physical phones were not tested. The in-app browser is signed into a
procurement account and redirects away from ADMIN; its session was not changed.
Production ADMIN verification and screenshots used the existing authenticated
Edge session. The old portal.alebazia.xyz public metadata request stalled from
the local network; the canonical team.mobo-opt.ru host was verified independently.
No production migration, import, environment edit or upload cleanup is included.

## Exact code file scope

- app/(dashboard)/admin/attendance/page.tsx
- app/(dashboard)/admin/workday/page.tsx
- app/(dashboard)/admin/workday/AdminShiftControlDetails.tsx
- app/(dashboard)/admin/workday/AdminWorkdayCorrectionButton.tsx
- components/admin/TeamDailyControl.tsx
- components/admin/TeamSchedule.tsx
- components/admin/TeamScheduleServer.tsx
- components/admin/TeamSourceRefresh.tsx
- lib/team-control.ts
- lib/team-control-source.ts
- app/globals.css (scoped team-control styles only)
- tests/team-control.test.ts
- package.json
- package-lock.json

## Follow-up UI correction 1.5.1

Owner approved release of the reviewed UI correction after noticing misaligned
row actions and an almost full-screen employee dialog in 1.5.0. The correction
keeps the same data sources and workflows:

- Action controls have one fixed 128px column on desktop, with matching widths;
  the detail trigger reads `Подробнее`. Mobile actions use two columns.
- Employee detail is centered, max width 960px, with desktop viewport margins
  and internal scrolling rather than forced 100dvh height. At 390px the panel
  stays inside the viewport with 12px margins.
- Medium-width rows retain plan/start labels. The detail header uses neutral
  text, not the unrelated green brand class.
- Keyboard focus enters and stays in the main dialog; Escape closes it and
  restores the initiating button. Existing nested review/photo workflows remain.

Only AdminShiftControlDetails.tsx, app/globals.css and the synchronized package
versions change. No DB, Google, API, compensation, notification or template
change. Local TypeScript and production build passed; browser checks verified
identical action-column coordinates, 128px action widths, a 960x640 centered
panel at 1280x720, a 366x820 panel at 390x844, no document overflow, Tab containment
and Escape/focus return. No real employee action was submitted for testing.

Code commit: ab1cecf4af6293366ba8a05f823686af540859bd.
Production activated successfully: 1.5.1, builtAt 2026-10-18T11:32:08.274Z
(14:32 MSK), health 200. Independent SSH confirms the exact code commit above;
visible authenticated ADMIN footer also reports 1.5.1. Production browser
readback confirms all action columns have width 128 and identical x=764 at a
952px viewport, and the dialog is 888x641 at x=32/y=106.5 inside 952x854.
Escape closed it and returned focus to `Подробнее`.

Fresh verified backup: .rollback/team-control-1.5.1/database.dump, 21,652,817
bytes. Previous image sha256:60e67205cee0132b8f3c141ee02912ba9c0913692c24acc0cf08380f3b72c659
is retained as portal-app:rollback-before-1.5.1. Replacement image:
sha256:cf2c76f9fd73df1e0071ac424916c3762f4f6e2a965438a0b98d82773a6f391e.
Release postflight confirmed unchanged environment hash, mount set (including
uploads), mapping/template fingerprints and nondecreasing business-record
counts. No migration/import occurred. VPS tracked tree is clean; existing
.rollback/ retained. Source metadata revision is still null under the existing
Docker convention; server commit was independently verified.
