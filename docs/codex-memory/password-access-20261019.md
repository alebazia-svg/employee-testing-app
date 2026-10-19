# Employee password access — local candidate, 2026-10-19

Status: implemented and checked locally; NOT released. No real employee password has been reset. Runtime committed locally as b45c959; no production migration or deployment performed. Original baseline origin/design-local-updates 3725e6b, package 1.9.1; recheck current live metadata and release branch before assigning a release version.

## Owner decision

The owner explicitly approved permanent administrator-generated passwords. The earlier temporary-password proposal is superseded: NO 24-hour expiry, NO forced first-login change, NO password-change screen for employees. A generated password works until the next explicit ADMIN reset. Each employee gets an individual random password. Owner refinement: EMPLOYEE generation uses exactly 10 lowercase Latin letters/digits, both classes required, with no separators or ambiguous i/l/o/0/1. ADMIN (and any unknown future role) generation retains 16 random mixed-case letters/digits in four groups (19 characters including hyphens). These rules apply to issuance, not an automatic rotation of existing accounts. Reset reads the role from the database and includes it in its optimistic update predicate. The owner copies login/password separately or a complete message (heading, portal link, login, password; owner requested no explanatory footer) and forwards it manually. The portal does not send messages.

Show plaintext only in the issuance response and the administrator's transient dialog; database stores bcrypt hashes only. Closing the dialog removes the plaintext from UI state. Lost credentials require a fresh reset. Do not implement retrieval/storage of plaintext passwords. Resetting one's own ADMIN account is excluded to avoid locking the administrator out; another administrator can issue access.

## Implementation

- Employees retains the table/fields, uses existing ADMIN section tabs, and adds one focused access dialog; the owner requested common copper/graphite styling without the old green success panel or nested boxes.
- New employee creation generates a password when none is supplied and returns issuedAccess separately. UI removes it before storing the employee record in list state. Profile editing no longer accepts password changes; dedicated reset is required.
- ADMIN-only POST /api/admin/employees/[id]/password requires JSON and same-origin browser requests, validates expected sessionVersion, and performs an atomic compare-and-increment reset. Inactive accounts, self-reset, stale/concurrent reset and changed login are rejected. Credentials responses are no-store/private.
- Additive User fields: sessionVersion default 0, passwordResetAt, passwordResetById. Migration preserves existing hashes and users.
- Signed v2 sessions include sessionVersion. getCurrentUser verifies the version and active user. Legacy signed v1 sessions map to version 0 and survive deployment until their own user is reset. All existing authenticated business APIs inherit revocation. The separate PortalAccessSession journal remains a journal, not the auth authority.
- Session-cookie lifetime stays 30 days, as before. This is independent of the generated password's indefinite validity.
- Removed this task's unpublished temporary-password schema fields, forced-change API/page, login redirect/client split and expiry logic. No production migration ever contained those temporary fields.

## Verification

PASS: npx tsc --noEmit; git diff --check; npm run build in an isolated source copy, using the same local Prisma client and the isolated preview DB, excluding the demonstration route.

PASS: 16 auth/password tests, including real PostgreSQL and HTTP integration through the running Next application; plus 4 existing portal-access route regression tests. Commands:

    node --conditions=react-server --import tsx --test tests/auth-session.test.ts tests/password-access.test.ts tests/password-access.integration.test.ts
    node --conditions=react-server --import tsx --test tests/portal-access-routes.test.ts

Integration test requires PASSWORD_ACCESS_TEST_DATABASE_URL and PASSWORD_ACCESS_TEST_ORIGIN, refuses any DB other than local 127.0.0.1:55449/password_access_preview_20261019 and origin http://127.0.0.1:3197. Fixture accounts are created and removed by the test; no real data is used.

Verified: additive SQL preserves an existing hash/default version; legacy signed sessions before reset; ADMIN and employee permissions; cross-origin rejection; self/inactive account rejection; uncached issuance; old password and old session rejected; other user's session/password and administrator session preserved; password accepted long after issuance (reset date backdated to 2020); immediate employee API access without forced password change; stale reset rejected; concurrent resets produce one valid password and one conflict; new employee creation and profile edits preserve access; short employee format and long administrator format verified through creation/reset APIs. A further 1,000 generated employee passwords passed format, uniqueness and class checks. Local workday/payroll row counts unchanged. Generated secrets are not printed to logs.

Visual: actual Employees screen, common tabs on desktop/mobile, filtering and empty states, reset confirmation/cancel/Escape/focus return, success dialog with explicitly fake credentials. Message composition tested. The owner pasted the exact previously copied demonstration message into chat, confirming native clipboard copying. The browser tool's separate virtual clipboard cannot read native clipboard contents; the copy helper's shortened message is covered by an exact-content assertion. No real credential delivery, production device login or production migration has been tested.

## Preview and release boundary

Live local entry http://127.0.0.1:3198 redirects to authenticated http://127.0.0.1:3197/admin/employees. Database contains synthetic demo employees only. Local-only /admin/employees/demo-access renders the actual dialog with invalid fixture credentials, without issuing/resetting a password. REMOVE the demo-access directory before any commit/release. The build check already excludes it. Local preview/bootstrap/build/test scripts live in ignored .wip; credentials stay in a mode-0600 temporary file outside Git.

Deployment and its additive migration need owner approval under AGENTS.md. Recheck live/release-branch version, runbook, pending migration list and rollback before deployment. Keep all real passwords untouched until explicit per-employee issuance. A rollback to pre-versioned-auth code must not silently restore revoked legacy v1 access: retain the version check in any rollback/fix-forward plan. Do not change the shared signing key to compensate (would end unrelated sessions).

## Exact product/test files

- app/(dashboard)/admin/employees/EmployeesClient.tsx
- app/(dashboard)/admin/employees/EmployeeAccessDialog.tsx
- app/(dashboard)/admin/employees/page.tsx
- app/api/admin/employees/route.ts
- app/api/admin/employees/[id]/route.ts
- app/api/admin/employees/[id]/password/route.ts
- app/api/auth/login/route.ts
- lib/auth.ts
- lib/session.ts
- lib/password-access.ts
- lib/employee-access-message.ts
- prisma/schema.prisma
- prisma/migrations/20261019110000_employee_password_access/migration.sql
- tests/auth-session.test.ts
- tests/password-access.test.ts
- tests/password-access.integration.test.ts

Documentation: this file and the project-index entry; commit docs separately from runtime code.
Local-only visual fixtures to remove: app/(dashboard)/admin/employees/demo-access/page.tsx and DemoAccess.tsx.
Worktree: /Users/bela/.codex/worktrees/employee-start-colleagues/employee-testing-app. Main checkout's unrelated dirty files remain untouched.

## Astemir recommendation, no reset authorization

Owner asked whether to change Astemir's password. The historical access notes confirm the owner also used his account on her Mac (`portal-access-journal-20260929.md`, 2026-09-29); this is not evidence of compromise or proof of his present password. Recommend issuing a fresh individual password after release to separate real use from testing. No reset has been requested/implemented for his account. Current production role was not independently confirmed: the available browser session could not open ADMIN Employees (redirected to procurement); no login or account mutation attempted.

## Approved employee inspection — local implementation, 2026-10-19

Owner explicitly approved adding «Посмотреть как сотрудник» alongside password issuance and showing it in the real local app. Implemented for active WORKDAY employees (retail/wholesale) and, after explicit owner approval, PROCUREMENT employees. The owner clarified that ALL employee cabinets must allow inspecting forms and locally changing fields, blocking only persistence/submission rather than opening dialogs. No production publication or password rotation was authorized by this approval.

Architecture: ADMIN «Посмотреть» POST records an EmployeePreviewVisit (actor/target ids and names, open/expiry time). The 30-minute visit is an audit record, NOT an authentication credential: every page/read requires the original administrator's valid, active ADMIN session and an active WORKDAY or PROCUREMENT employee. Another administrator cannot reuse it. Existing login cookie is never overwritten and passwords/sessionVersion are untouched. Additive migration 20261019130000_employee_preview_visit is applied only to the isolated local DB; production application needs explicit release/migration approval.

Actual EmployeeTodayClient/header/tasks/schedule/bell/attention/cash-issue components are reused. Shared home/schedule/attention/notification loaders preserve normal employee behavior. Preview uses a strictly allowlisted GET endpoint, with no forwarding to arbitrary routes, no effective-user auth override and no mutation endpoint. Notification preview uses the existing read-only lifecycle filter instead of the ordinary cancellation/reconciliation write. Reading a notice does not mark it read. General notifications show their text; identifiable procurement payment/receipt notifications reuse the actual DB-only record dialog through an employee-scoped reader. Navigation to ordinary employee-only routes is blocked, not impersonated. Current attention sheets and task sheets can be inspected. Native push delivery/sound and employee device permissions are not simulated or sent.

UI: separate copper-tinted sticky inspection banner with employee name, «Обновить» and «К сотрудникам». Current data is refreshed through scoped reads; 30-minute expiry/401/403/410 removes the inspected screen. Final mutations, camera/file picker, cash outbox retries, employee updater, employee logout, push subscription/badge effects, notification-read writes and ordinary employee navigation are blocked. PortalAccessTracker skips the inspection route so the visit does not masquerade as an employee connection; the explicit audit is the evidence instead. Provider keyed by visit id prevents previous employee state surviving a change of subject. Normal employee mode retains its original callbacks/endpoints and updater.

Verification: PASS typecheck, isolated production build (demo-access excluded), 16 existing auth/password tests, 4 portal-access route regression tests and 2 new preview tests (22 total unique tests). Real PostgreSQL+Next HTTP verifies no auth cookie change, permissions, CSRF rejection, actor-bound reads, no-store, read resource allowlist, mutation 405, invalid month, inactive target, expiry, visit id rejected as auth cookie, unchanged employee hash/sessionVersion, workday, task, unread and stale notification rows, cash and push subscriptions. New integration tests refuse all databases/origins except the named localhost fixture. Browser checks used actual ADMIN/PWA components at desktop and 390px: open/return, active and unstarted shifts, blocked start/confirmation/schedule change, calendar month switch, notification open/close, empty notifications, retained unread count. Fixed the notification popover offset below the preview banner without changing ordinary employee placement.

Real phones, production auth/migration and live 1C/cash-issue states remain untested; local inspection uses synthetic accounts with external integrations disabled. No real employee password, shift or notification was modified. Unrelated dirty files in the main checkout were untouched. This document records the accepted architecture/local phase; keep docs commit separate from runtime.

### Additional exact files for inspection

- app/(dashboard)/admin/employees/EmployeesClient.tsx
- app/(dashboard)/admin/employees/preview/[visitId]/page.tsx
- app/api/admin/employees/[id]/preview/route.ts
- app/api/admin/employees/preview/[visitId]/route.ts
- components/EmployeePreviewProvider.tsx
- lib/employee-preview.ts
- lib/employee-preview-request.ts
- lib/employee-home.ts
- lib/employee-attention-snapshot.ts
- lib/employee-notification-snapshot.ts
- lib/employee-schedule-snapshot.ts
- app/(dashboard)/employee/page.tsx
- app/(dashboard)/employee/EmployeeTodayClient.tsx
- app/(dashboard)/employee/WorkdayNotificationsClient.tsx
- app/(dashboard)/employee/CashIssueClient.tsx
- app/api/employee/workday-attention/route.ts
- app/api/employee/workday-notifications/route.ts
- app/api/employee/workday/schedule/route.ts
- components/LogoutButton.tsx
- components/NotificationRecordDialog.tsx
- components/PortalAccessTracker.tsx
- components/workday/EmployeeAttentionPanel.tsx
- lib/use-employee-app-update.ts
- app/globals.css
- prisma/schema.prisma
- prisma/migrations/20261019130000_employee_preview_visit/migration.sql
- tests/employee-preview.test.ts
- tests/employee-preview.integration.test.ts


## Procurement and all-cabinet interaction refinement — 2026-10-19

Phase remains local review, not released. Owner explicitly approved PROCUREMENT/Astemir-style cabinet inspection, then required opening «Изменить» and other forms across ALL employee cabinets. Preserve this intent: fields and local navigation work; final write/submission is blocked. Do not revert to blocking dialog entry.

- Actual ProcurementHome/ProcurementShell/calendar/forms/history/delivery/receipt viewer are reused. Normal procurement authentication remains in its page. Server evidence matching remains global, but only the selected manager's plans are serialized. A server closure keeps global matching inputs out of development RSC debug props; the HTTP test asserts absence of another manager's supplier in the entire response.
- Read-only procurement rendering calls preservePaymentEvidenceViews with persist:false: even complete successful 1C reads do not write the presentation cache. A unit test compares normal/inspection output and asserts zero inspection writes. Existing calculations and normal cache behavior are retained.
- Separate resource allowlists for WORKDAY and PROCUREMENT. Receipt list and bytes verify plan ownership as the selected EMPLOYEE, never using the ADMIN's broader authority. Receipt file headers retain private/no-store, attachment, nosniff and sandbox. Delivery reads require the exact existing unique manager mapping. Notification-detail reads verify both recipient and plan owner. No employee mutation proxy or effective-user session exists.
- Procurement edit/new/cargo/delivery dialogs open; field changes remain local. Form submission handlers stop before fetch and display an inline explanation. Dialogs show a small inspection notice. Uploads remain disabled; existing files can be viewed. When source data is absent, form fields can be inspected but unavailable supplier choices are not invented.
- WORKDAY QR scanner layout opens without requesting camera permission; a clearly labelled inspection control opens the real shift chooser without QR approval/start-intent creation. Its selection cannot start a shift. Cash operation and shift correction forms open; correction availability is read through the existing scoped read helper. Tasks scheduled for later may be opened for inspection. Handover drafts only update component state; final submission remains blocked. An inspection-only step selector allows viewing subsequent photo-dependent handover screens without uploading photos or completing tasks. Normal employee mode never receives these controls or changes.
- Browser checks: actual edit amount/reason and blocked save; cancel/discard; new payment and cargo tab; history/receipt list/file rendering and disabled upload; notification opening; return to Employees; unstarted retail QR/shift choice; wholesale cash form and handover; retail future task opening, cash draft 60000, local Next to reserve and direct step selection to encashment; mobile 390px including the procurement edit dialog. Retail post-UI assertions confirm the handover task remains pending with null stored draft and no cash operation. Post-UI DB assertions confirm unchanged original plan amount/comment/events, shift/task state, cash rows, unread notices, hashes and session versions. Test attachment is a copy of the public app icon, explicitly named as a test file, not a fabricated business receipt.
- Automated checks: 18 scoped URL/evidence/buyer-loading/notification-reader tests, 6 existing delivery-panel tests, 2 real HTTP/PostgreSQL integration tests (URL tests also rerun by that runner); typecheck and isolated production build. UI forms with live production 1C data and all possible exceptional business states have not been exhaustively exercised.
- Saved business data refreshes using existing polling (procurement calendar 120 seconds while visible; procurement notifications 30 seconds, focus refresh where supported). This is NOT a live mirror of the employee's device: no screen recording, current-page/typing/click tracking or remote control was added. The owner's question about personal ADMIN accounts for herself and Aslan was answered as a recommendation only; no accounts were renamed/created/reset.

Additional exact changed files for this extension, beyond the inspection list above:

- app/(dashboard)/procurement/page.tsx
- app/(dashboard)/procurement/ProcurementHome.tsx
- app/(dashboard)/procurement/ProcurementPaymentCalendarClient.tsx
- app/(dashboard)/procurement/ProcurementPaymentForm.tsx
- components/ProcurementCargoPaymentForm.tsx
- components/ProcurementDeliveryPanel.tsx
- components/ProcurementDeliveryRequestDialog.tsx
- components/ProcurementNotificationsButton.tsx
- components/ProcurementPaymentDialog.tsx
- components/ProcurementReceipts.tsx
- app/api/notification-details/[audience]/[id]/route.ts
- lib/notification-detail-reader.ts
- lib/procurement-evidence-continuity.ts
- tests/procurement-buyer-loading.test.ts
- tests/procurement-evidence-continuity.test.ts

No additional Prisma schema/migration is needed for this extension. Existing unpublished password/visit migrations still require their normal release authorization. Unrelated dirty files in the primary checkout remain untouched.

## Release preparation — 2026-10-19

Owner requested proceeding after visual acceptance. Preparing the approved feature; explicit deployment with the two additive migrations has been requested and remains pending. Personal ADMIN accounts remain a recommendation, not an approved implementation. Runtime commit b45c959 contains only the 57 listed product/test files; the local-only demo-access route is excluded. Documentation is committed separately. Live public metadata is 1.9.3 (built 2026-10-19T15:28:39.112Z), VPS commit 1e1af84311a73c89803047d6ac9d2855c191e741, latest fetched release-branch commit c38d062. No runtime file overlaps between the candidate and upstream changes. Recheck immediately before release; no future version reserved. Read-only VPS check showed 19 GiB free and no tracked changes; sudo requires an interactive password. No VPN, credentials, production schema, containers or external systems were changed.

Release preparation checks completed after merging latest origin/design-local-updates into 48c1970 (only documentation index required resolving two appended sections; both retained). PASS: typecheck, isolated production build without demo-access, 31 auth/access/preview/procurement/notification unit regressions, 11 delivery/release-metadata checks, and 9 PostgreSQL/HTTP tests including nested reset cases. Evidence: /tmp/employee-access-release-{tsc,build,unit,ui-tests,integration}.log. Existing actual-component desktop/mobile visual approval remains applicable: no visual behavior changed during preparation. No release version bump, remote push, production schema application or deployment yet. Production pending-migration/image/rollback checks require privileged VPS access and remain before deployment. After any real password reset, rollback must retain session-version revocation; an older application image alone is not a safe auth rollback.
