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

## Compact single-card review 1.5.5

Owner approved the final single-screen employee review and production release.
Internal Day/Cash/Closing tabs were rejected: the first screen must expose all
control outcomes, with inline disclosures for evidence and actions. Timeline
repetition was also rejected. Preserve the compact task deadlines/completion
view, with reconciliation result distinct from timeliness. Conditional closing
requests appear at the top only when pending; existing decision behavior is
unchanged. Cash operations show posted vs unconfirmed totals separately, document
numbers and photo thumbnails with enlargement. Unknown reconciliation explains
missing evidence rather than telling the administrator generically to check
manually. Desktop action buttons share explicit styling through nested wrappers.

Release candidate 1.5.5: 24c18c12bd25885f9e46fe961b9ab18755d7a2d6.
Reconciled with deployed 1.5.4 (d07d923) and deployment branch 43d0e4f; existing
access/device changes retained. No new migrations, source cutover, payroll or 1C
writes. Isolated local PostgreSQL and explicitly marked demo cash/photo/request
records were used only for preview, excluded from source and Docker context.

Verification: TypeScript, production build, 5 release-metadata tests and 16
focused workday/team tests passed. Final no-tab screen checked at 390px (document
390px, panel366px; no horizontal overflow), inline request/cash disclosures,
photo enlargement/Escape and specific check disclosure. Existing decision UI
was exercised against the isolated DB: blank rejection failed with a clear
message; commented rejection kept day active; approval completed day while
handover remained missed, not falsely confirmed. Preview scenario restored.
Physical phones not tested. No actual production employee decision submitted.

1.5.5 activated successfully: public version1.5.5, builtAt
2026-10-18T14:14:37.524Z; independent SSH confirms commit24c18c12bd25885f9e46fe961b9ab18755d7a2d6.
Health200 and authenticated ADMIN footer checked. Settings, environment and
upload mounts preserved; business-record counts did not decrease. Database
backup .rollback/team-control-1.5.5/database.dump (21,683,688 bytes) validated.
Previous image sha256:2dbdc3f72288544feb05e904fbd729968b728544bd08b5a66f969a4ecb04100b;
replacement sha256:44147f04ed55cd1f82ededf6cc22a74509917f0370bddb3cb2346dd9bc76682d.
Production readback showed real Liana values: cash11065/11065 at09:00,
5915/5915 at14:01 (late1minute), two posted cash operations. All seven actual
row buttons156x36. No local fixture uploaded. The final live check found two
misleading labels (normal reconciliation summary vs minor lateness, future
handover labelled not done); addressed immediately in patch1.5.6 under the
same release approval, with another version increment as required.

Patch1.5.6 source: d048e9cf451afc030b958cc54d23526caf58517e.
Summary now says no unconfirmed results rather than no remarks; minor timing
exceptions remain visible separately. Future handover reads expected by its
deadline; missed/overdue remain distinct. TypeScript, production build and
release metadata tests passed again. No business logic or schema change.

Exact runtime files for this follow-up (relative to live1.5.4):
- app/(dashboard)/admin/workday/AdminShiftControlDetails.tsx
- app/(dashboard)/admin/workday/AdminWorkdayCorrectionButton.tsx
- app/(dashboard)/admin/workday/close-exceptions/[id]/CloseExceptionDecisionClient.tsx
- app/(dashboard)/admin/workday/page.tsx
- app/globals.css
- package.json, package-lock.json

1.5.6 activated and independently verified: server commit
 d048e9cf451afc030b958cc54d23526caf58517e, public version1.5.6,
builtAt2026-10-18T14:22:37.220Z (17:22MSK), health200. Authenticated ADMIN
footer and actual Liana card confirm the final labels, no internal tabs and
inline cash operation/photo disclosures. Real operations133000 at13:17 and
72000 at16:17 are posted; first operation document numbers00OF-В00807 /
00OF-В00805 and its photo successfully loaded (natural width3024px).
Production actions were not submitted. Source revision remains null in metadata
under the existing Docker convention; SSH verified the commit independently.

Backup .rollback/team-control-1.5.6/database.dump:22,037,562bytes, pg_restore
listing validated. Previous image sha256:44147f04ed55cd1f82ededf6cc22a74509917f0370bddb3cb2346dd9bc76682d;
replacement sha256:98c6dd6f0dba96d3c433143dd28ed2bc63798de8a566f6a3be11e7c7b4187eaf.
Environment/settings fingerprints, uploads mount and record counts preserved;
no migration/import. Original workspace dirty-file inventory unchanged.
