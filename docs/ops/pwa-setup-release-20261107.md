# Employee PWA setup, help and completion — 1.21.46

## Release scope and owner approval

Owner reviewed the actual authenticated local mobile screens and explicitly approved
all shown changes, then authorized release conditional on regression verification.
Runtime commit: `d9d8adc06ca2ba8a6667a16001b5d12e8f5d26dc`.
Integrated on latest deployment source `dbf01fb`, preserving runtime1.21.45 /38e3b15.

- Immediate Safari Home Screen instruction, hidden in standalone launch.
- Compact push connection banner only without a confirmed subscription; existing
  registration mechanism, explicit permission click, denied-permission guidance.
- Approved numbered role-specific guide; `?` left of the unchanged rightmost bell.
  Planning is distinct from QR arrival; retail/wholesale cash checks and handover
  differ from Procurement/helper departure. No extra notifications paragraph.
- Server-recorded guide acknowledgement in the existing activity journal; daily
  automatic help only while today/tomorrow is missing, manual reopening retained.
  Existing date-specific schedule reminder/editor paths remain unrestricted.
- Logout in existing logo/About popup; same confirmation/endpoint, cancel restores
  About. Shared Procurement reminders/help across all three mounted views.
- Approved sunset departure card and previous unfinished-day card; compact
  attention rows retain every group/count/action, without extra aggregate heading.
- Previous-day form retains date/start and four approved reasons; no guessed
  departure-time input. Confirmation stores a technical late close, with unknown
  actual departure explicitly audited. Existing ADMIN technical-close interpretation
  retained. Older clients' explicitly supplied departure times stay compatible.
- Today's normal completion still stores the actual current server time. Retail
  and wholesale handover/checklist and financial/receipt/payroll rules unchanged.

Excluded: calendar redesign, demo routes/fixtures, new unshown auto-guide intro,
new cash/receipt/staffing rules, schema changes, migrations,1C publication.

## Verification before installation

- Exact release build and TypeScript passed.
-302 workday +77 surrounding checks passed,0failures/0skips.
- Two real isolated PostgreSQL boundary tests rerun serially: guide acknowledgement
  and late-close vs current-time preservation; both passed.
- Five release metadata/version tests passed. Three package version fields match.
- Real ordinary release routes at390x844, without demo flags: retail and Procurement
  help, bell/new/history/back/close, logo/About, logout confirmation/cancel, actual
  logout/login, three mounted tabs and prior-day reason-only form verified.
- No real employee completion, schedule edit, acknowledgement, permission grant,
  cash transaction or photo write was used as a production smoke test.

Local evidence: `/tmp/mobo-pwa-release-{build,tsc,workday,focused,db-serial,metadata-tests}.log`
and `/tmp/mobo-pwa-release-20261107/` screenshots.

## Exact changed code/test/version files

- `app/(dashboard)/employee/EmployeePortalHeader.tsx`
- `app/(dashboard)/employee/EmployeeTodayClient.tsx`
- `app/(dashboard)/employee/StaleWorkdayCloseSheet.tsx`
- `app/(dashboard)/employee/WorkdayNotificationsClient.tsx`
- `app/(dashboard)/employee/layout.tsx`
- `app/api/employee/work-help/route.ts`
- `app/api/employee/workday/finish/route.ts`
- `components/EmployeeAboutApp.tsx`
- `components/LogoutButton.tsx`
- `components/ProcurementMobileCabinet.tsx`
- `components/ProcurementWorkdayContent.tsx`
- `components/workday/EmployeeActionReminder.tsx`
- `components/workday/EmployeeAppSetupContext.tsx`
- `components/workday/EmployeeAppSetupProposal.module.css`
- `components/workday/EmployeeAppSetupProposal.tsx`
- `components/workday/EmployeeAppSetupProvider.tsx`
- `components/workday/EmployeeAttentionPanel.module.css`
- `components/workday/EmployeeAttentionPanel.tsx`
- `components/workday/EmployeeHelpSheet.tsx`
- `components/workday/EmployeePreviousDayProposal.module.css`
- `components/workday/EmployeePreviousDayProposal.tsx`
- `components/workday/EmployeeUnfinishedDayCard.module.css`
- `components/workday/EmployeeUnfinishedDayCard.tsx`
- `components/workday/EmployeeWorkHelp.module.css`
- `components/workday/EmployeeWorkHelp.tsx`
- `lib/employee-action-reminder.ts`
- `lib/employee-activity-report.ts`
- `lib/employee-app-setup-state.ts`
- `lib/employee-push-connection.ts`
- `lib/employee-work-help.ts`
- `lib/push-subscription-client.ts`
- `package-lock.json`
- `package.json`
- `tests/employee-about-app.test.ts`
- `tests/employee-action-reminder.test.ts`
- `tests/employee-app-setup-state.test.ts`
- `tests/employee-push-connection.test.ts`
- `tests/employee-work-help.integration.test.ts`
- `tests/employee-work-help.test.ts`
- `tests/workday-late-close-no-time.integration.test.ts`

## Production verification and preservation

Released and independently verified November7,2026. Public metadata and the
actual authenticated ADMIN/employee About label agree on1.21.46, built
`2026-11-07T20:39:36.808Z` (23:39MSK). Server HEAD is the exact runtime commit above.
The deployed container is healthy; `/api/health` returns `{"ok":true}`; public
employee, Procurement, ADMIN workday/payroll/inbox and login routes return200
(no500). Some unauthenticated200 responses are the existing login shell, not proof
of authorized business-data access.

Authenticated production ADMIN inspection verified the visible version/About,
bell → New → History → back → close. It is read-only; no employee was logged out,
no schedule/acknowledgement/finish/financial record was changed. The existing ADMIN
inspection renderer does not mount the ordinary employee setup/help providers;
its inspection is not proof of the setup guide or real employee permission flow.
Those ordinary release routes were tested locally as described above.

Before/after/final comparisons matched:
-10 selected account configurations (including password hashes, without exposing them),
 9 checklist templates including their tasks and5 employee/cashbox mappings.
-324 mature existing upload files retained at the same paths and sizes.
-157 workday rows and104 cash-operation rows before/after/final. Counts are
 observation only; no real business record was reset or rewritten.
- `server.env` hash, upload/container mounts and workday notification service/timer
 definitions unchanged. Source/applied migration sets matched; no pending/new
 migration existed and no migration was applied. No1C/OFD publication/write.

Only `portal-app` rebuilt/restarted. Parent release lock was released before
verified-image registration. Current plus two verified rollback IDs all exist:
- `sha256:4cbb484ff476b7de777de56f123f2808b2c733622337942201e915567a806c1b` (1.21.46)
- `sha256:2c566d9c88919738087612c0298ecee774c8b57f9c8a6d8a25bee4a0524c6f18`
- `sha256:41262568aef851dddaee9dd77555110889382f411917753c589e4e3d8b0087e5`

Standing approved bounded portal storage retention completed;18.95GiB free.
Final markers: `RELEASE_VERIFIED_AND_REGISTERED`, `RELEASE_EXIT=0`, `healthy`.
Server log: `/home/bela/mobo-pwa-1.21.46-release.log`.
Preservation evidence (root-only): `/root/mobo-pwa-1.21.46-20261107/`.
Visible production proof: `/tmp/mobo-pwa-release-20261107/production-version.jpg`.

Limitations: physical iPhone Safari installation, denied/granted native settings,
OS push delivery, keyboard/navigation and animation on hardware still require the
owner's phone check. No claim of guaranteed future fault-free network/device
operation is made. Package dependencies were unchanged; installer audit output
was not addressed by an unrelated dependency upgrade.

Original dirty task/integration checkouts and the release worktree's untracked
`node_modules` symlink were left intact. No demo routes or data entered this release.
This phase/release record is committed separately from code; documentation-only
publication does not rebuild or change the running application version.
