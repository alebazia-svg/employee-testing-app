# PWA payroll and action reminders — released 1.13.7, 2026-10-22

## Verified production release — 1.13.7

Owner explicitly approved publishing: «Ну, приступай. Выпустишь, я тогда проверю
экран». Classification OPERATIONS APPROVAL, scoped to saved-first employee
payroll, rolling two-month selection, the approved actionable reminders and ADMIN
draft-control corrections. No payroll formula, calendar geometry, PROCUREMENT
salary, database migration or 1C publication/write.

- Reconciled production 1.13.6 and deployment branch `b3514b2`, preserving author
  identity/notification wording and procurement editing fixes. Runtime commit
  `d34e813b3c545195ed347cd1b0a22577a570243f`, app version 1.13.7 in both manifests.
- Repeated merged-candidate verification: 82 focused tests, 78 payroll tests,
  five release-metadata tests, TypeScript/production build and whitespace checks.
  Source assertions updated for the accepted 1.13.5 wording, not old UI restored.
- Native Terminal preflight exited 0. Approved retention cleared unused build
  cache and three unprotected old portal images; 24.93 GiB free afterward.
  No volumes/uploads/backups or used images touched. Registry's current and two
  rollback images verified by the existing fail-closed maintenance utility.
- Previous live runtime `4d2d44afc9eda6f4c0d7dc50fd6671468f304860`, version 1.13.6,
  image `sha256:4d64a1620eebcdbe9cc0809032c90d46a97d35804d52fe8bef5cd61b4632ef9d`.
  Protected reserves: `sha256:1347a05b913c2325633a8b5728b8295f0c63a7198701fe673bdf591719545688`
  and `sha256:e72975b706c981a7df73b78e2aa1c1d8a44bdc60b00cb6a06d8bad35e7094320`.
- Deployed only portal-app at runtime commit
  `d34e813b3c545195ed347cd1b0a22577a570243f`. Public version 1.13.7, build
  `2026-10-22T19:25:16.513Z`; authenticated ADMIN footer independently matched.
  Metadata revision remains null/source unknown in the existing pipeline; exact
  source identity was independently checked with server Git, not inferred from it.
- Replacement image
  `sha256:1bdfbbab39765027a10c4ce659489f20a2f10fa106f11cc79ec37e73b111e10a`.
  Deployment wrapper exited 22 only because the immediate public metadata read
  returned transient 404 after restart. Subsequent independent public read,
  authenticated pages and root verification passed; no rebuild/retry needed.
  Container running/healthy, public `/api/health` returned `{"ok":true}`.
- Native Terminal final verification exited 0 (`PWA_VERIFIED_REGISTERED_OK`).
  Env checksum, mounts and payroll/demo flags unchanged; no Prisma file delta,
  no explicit migration or production business-data write. Registered new image
  after releasing the deployment lock. Registry now protects replacement,
  previous 1.13.6 image and `sha256:1347a05b913c2325633a8b5728b8295f0c63a7198701fe673bdf591719545688`.
  Retention timer enabled, approximately 20 GiB free after build. This is a
  capacity check, not a guarantee that storage can never fill.
- Production authenticated UI: ADMIN overview loaded, no persistent saved-status
  clutter, review button opened questions and returned to overview. Existing
  Liana employee inspection opened Workday, Schedule and Salary; current salary
  59,800 estimate stayed visible during background refresh, October/September
  were the only choices. September confirmed 130,500 paid / zero remaining.
  No shift, schedule, payroll or 1C financial mutations were used for verification.
  Inspection audit visit is the normal read-only ADMIN facility.
- Important source caveat: production October still explicitly says sales through
  17 October; ADMIN review displayed a days/late refresh Bad Gateway warning.
  Stored values remained visible. Do not claim live sources are fully current or
  that this release fixed the independent source freshness problem.
- Physical iPhone/standalone push-resume check remains with owner. Production
  Liana had completed shift and no actionable reminder; positive action resolution
  and failure recovery were rehearsed in isolated local data, not manufactured
  on production. Main dirty checkout and unrelated work left untouched.

### Exact runtime files in d34e813

```text
app/(dashboard)/admin/employees/preview/[visitId]/page.tsx
app/(dashboard)/admin/payroll/PayrollClient.tsx
app/(dashboard)/admin/payroll/PayrollDraftSync.tsx
app/(dashboard)/admin/payroll/PayrollFinalOverview.tsx
app/(dashboard)/admin/payroll/PayrollLivePayments.tsx
app/(dashboard)/admin/payroll/PayrollOverviewPreview.tsx
app/(dashboard)/admin/payroll/PayrollPaymentEvidence.tsx
app/(dashboard)/employee/EmployeeTodayClient.tsx
app/(dashboard)/employee/layout.tsx
app/(dashboard)/employee/payroll/PersonalPayrollClient.tsx
app/(dashboard)/employee/payroll/PersonalPayrollScreen.tsx
app/(dashboard)/employee/payroll/payroll.css
components/EmployeePayrollSnapshots.tsx
components/useEmployeePayrollMonth.ts
components/workday/EmployeeActionReminder.module.css
components/workday/EmployeeActionReminder.tsx
components/workday/EmployeeAttentionPanel.tsx
components/workday/ReminderBell.module.css
components/workday/ReminderBell.tsx
lib/employee-action-reminder.ts
lib/employee-payroll-response.ts
lib/employee-payroll-view.ts
lib/payroll-draft.ts
package-lock.json
package.json
tests/employee-action-reminder.test.ts
tests/employee-attention-card.test.mjs
tests/employee-payroll-view.test.ts
tests/employee-pwa-design-baseline.test.mjs
tests/payroll-draft.test.ts
```

The remaining content below is historical candidate evidence, superseded by the
latest status sections where they differ.

## Verification completed locally — 2026-10-22, 22:14 Moscow

This section supersedes earlier pending local checks below; it is not deployment
approval or a claim of a physical iPhone test.

- Actual browser transport rehearsal via ignored, loopback-only proxy:
  eight employee API requests deliberately returned 503. October retained its
  last 53,500 fixture estimate and all earnings with a last-loaded warning;
  an unvisited September showed an error, never invented zero values. Restored
  service and retried with a seven-second response delay: the amount stayed
  visible during updating and the warning cleared after the successful read.
- Repeated entry renders the stored calculation before the advance read.
  No localStorage/sessionStorage/service-worker financial cache or new DB writes.
  Store remains scoped to the active employee/inspection and two rolling months.
- Native receipt read leaves its unresolved action active. Resolving only the
  isolated example removed that reminder and exposed the actual cash checklist
  task. Saving zero through the native cash form completed task 1/2; Schedule
  then reminded about the remaining handover, not the completed cash task.
  Restored only the guarded fixture task and reopened the same example afterward.
- Temporary advance layout example injected 13,000 into the isolated HTTP
  response only, without changing 1C/payroll/DB. On 390x845 CSS viewport it ended
  at y=753.18 with navigation starting y=760.77; on 430x932 ample space remains.
  Compact 375x812 adaptation ended the advance at y=704.05, navigation y=728.04.
  Body fonts remain 17px and amount fonts 19px; only salary margins/padding adapt.
  Calendar, Workday and navigation geometry unchanged. Very short devices,
  enlarged accessibility fonts and error text retain ordinary scrolling rather
  than clipping data or shrinking text. Measurements are browser emulation.
- Added focus/pageshow restoration of deferred reminders for iOS stale
  visibilityState, with symmetric listener cleanup. Desktop IAB did not emulate
  a genuine hidden/visible transition; physical standalone resume remains a pilot
  verification, not falsely recorded as an end-to-end pass.
- Updated three obsolete visual-source assertions to the already released
  shared navigation/inbox contract (not by restoring old product markup).
  Added a spacing-only/readable-earnings regression. 77 focused private-payroll,
  reminder, inbox, draft, navigation/visibility/visual tests + 78 payroll tests
  passed; TypeScript, production build and diff whitespace checks passed.
  Earlier Workday policy regression set also passed. No claim about every test
  in the entire repository or real 1C receipt correction was made.
- Proxy shut down cleanly, zero active requests; temporary delayed/error/advance
  responses removed. Ordinary isolated Next server restored on localhost:3198.
  QA backend on 3200 and proxy are stopped. Test scripts/artifacts stay ignored.
  Main checkout dirty files, production, uploaded files and real 1C unchanged.

Evidence: `.wip/artifacts/pwa-salary-outage-keeps-amount.png`,
`pwa-completed-cash-next-real-task.png`,
`pwa-salary-compact-390-with-advance-qa.png`,
`pwa-salary-compact375-advance-qa.png`. Advance screenshots are explicitly QA
examples, not real employee payment facts. Final ordinary screenshot is
`pwa-salary-final-iphone.png`.

Files additionally edited in this verification: employee `payroll/payroll.css`
and `PersonalPayrollClient.tsx` (spacing/status line),
`components/workday/EmployeeActionReminder.tsx` (resume listeners),
`tests/employee-pwa-design-baseline.test.mjs` and this note. Other dirty files
remain the already approved candidate; no commit, push or deployment occurred.

## Preparation update — evening 2026-10-22

### Owner correction: salary first, rolling two-month window

- Owner reiterated the original priority: immediately show the stored personal
  calculation while refreshing in background. That item is now in implementation,
  not to be omitted in favor of reminder decoration.
- Exactly two months: Moscow current month + previous calendar month, rolling
  automatically including December/January and while the screen stays open.
  Daily-capped sleeping boundary timer and foreground recheck do not poll APIs.
- Fast server-rendered current calculation bypasses external advance reads;
  the existing private live endpoint refreshes advances/payments in background.
  No new database/schema/service-worker/browser-storage cache. Volatile snapshots
  are account/inspection-keyed and bounded to the two displayed months, loaded
  lazily. Authoritative unavailable/access-denied responses invalidate old values.
  Network/timeout errors retain last known values with a clear warning.
- Pending final build and interactive slow/failure/recovery validation. This is
  not a release-readiness claim. Earlier paragraphs below are historical evidence.
- Two-month implementation: `lib/employee-payroll-view.ts`,
  `components/useEmployeePayrollMonth.ts`,
  `app/(dashboard)/employee/payroll/PersonalPayrollClient.tsx`,
  `tests/employee-payroll-view.test.ts`. Current saved-view work also adds
  `components/EmployeePayrollSnapshots.tsx` and updates PersonalPayrollScreen,
  employee layout, ADMIN inspection and `lib/employee-payroll-response.ts`.
- Verified local build and 34 focused private-payroll/cache/month/navigation
  tests, including Moscow midnight and Dec 2026 -> Jan 2027. Actual rendered
  salary selector now has October/September only; first entry displayed stored
  53,500 fixture estimate while `Обновляется…` was visible, then background
  refresh completed without replacing the calculation with a loading screen.
  Final tiny retry-button suppression during update still needs final rebuild.
  Source-outage and full rollover-in-browser rehearsal remain open; unit coverage
  is not described as a physical-device or full release verification.

- Owner approved finishing the defined reminder + ADMIN payroll save-control
  candidate, and explicitly required protecting existing calendar geometry.
  Production deployment is not authorized by this preparation step.
- Reconciled this checkout by fast-forwarding to deployment branch `a4dee53`
  (runtime 1.13.4), then reapplied the existing scoped changes. Only index-note
  conflict needed resolution; both upstream and candidate notes retained.
  Recoverable pre-reconciliation stash remains. Main dirty checkout untouched.
- Reusable provider, banner and bell now live in `components/workday/`.
  Deleted the untracked animation comparison/demo route from candidate source;
  no runtime import from indicator-preview remains. Employee layout and safe
  ADMIN inspection use the same provider inside existing CashIssueProvider.
- Cash issuance reuses its already-authorized snapshot and native open handler;
  no extra issuance poll or new financial action. All native actionable attention
  kinds use the existing priority order. Waiting is never an actionable reminder.
  Salary inspection uses its existing actor-bound GET transport and routes.
- Compact banner is 48 CSS px, with an 8 px following gap (previously 62 + 12).
  Calendar markup, calendar CSS, legend, grid geometry and navigation untouched.
  Owner supplied a physical-phone Liana schedule screenshot as visual baseline.
- Actual rendered isolated employee UI checked at 390 CSS px wide / ~845 high
  (browser zoom accounted for). October's calendar, legend and selected date
  fit above navigation. November's six-row calendar/legend are visible, but its
  selected-day detail may require a short scroll; narrower/shorter screens are
  not promised to fit without scrolling. No shrinking cells to conceal overflow.
  Screenshot `.wip/artifacts/pwa-calendar-compact-reminder-390.png`.
- Current merged UI: Schedule -> native exact receipt modal with ADMIN reply ->
  Salary; receipt action remains after read. Salary shows the existing isolated
  estimate and does not change formulas. Fixture values/dates are not live truth.
- Build, TypeScript, diff check, 78 payroll regressions, 10 draft tests,
  39 reminder/attention/navigation/inbox/visibility tests and 140 Workday,
  schedule, cash-issue, private-salary and preview policy tests passed.
- Replaced obsolete inline attention-card source assertions with equivalent
  native-panel direct-single / grouped-multiple / resolved-row assertions.
  Separate old `employee-pwa-design-baseline.test.mjs` still has 3 failures:
  it expects removed inline navigation and former notification palette/markers.
  Those patterns are absent in unmodified deployment HEAD too. Do not call the
  entire repository test suite green. Updating that historical visual contract,
  physical-device, source-outage/recovery and foreground/snooze checks remain
  release gates. Payroll last-view/background refresh is still not implemented.
- No commit, version allocation, push, deploy, production data edit or 1C write.

Current runtime files added: `components/workday/EmployeeActionReminder.tsx`,
`EmployeeActionReminder.module.css`, `ReminderBell.tsx`, `ReminderBell.module.css`,
`lib/employee-action-reminder.ts`. Integrations: employee layout, Today client,
PersonalPayrollClient, EmployeeAttentionPanel, ADMIN employee preview page.
Tests: employee-action-reminder, employee-attention-card. Earlier scoped ADMIN
payroll draft files remain uncommitted and are listed by `git status`.

## Accepted UX

- Copper filled bell with thin appearing/disappearing side zigzags; no icon
  background, gradients, panel flashing or scaling. Motion respects reduced motion.
- One actionable reminder on Schedule/Salary. No duplicate on Workday: the
  actual existing checklist/attention UI owns the work there.
- Open checklist, briefly outline the native card in copper, then fully remove
  the outline. Do not alter the checklist layout or replace its native cash form.
- No forced navigation, five-minute return rule or separate cash-entry popup.
- Reading a notification does not complete an action. Waiting for ADMIN is not
  an employee action. Future tasks are not shown before their planned minute.
- Defer is in-memory until foreground return; no financial/sessionStorage cache.

## Local implementation and boundaries

`ReminderPreviewProvider` remains gated by `PORTAL_ISOLATED_DEMO` in employee
layout. Old synthetic reminder state/form was removed. The provider uses actual
authorized `/api/employee/workday/today` and `/api/employee/workday-attention`.
Native Workday state and AttentionPanel publish already-read snapshots. Only
off-Workday reads need a 60-second visible sync; Salary reads attention itself,
where the native panel does not exist. In-flight reads are bounded/aborted and
do not overwrite a newer native action snapshot. No endpoint/schema/1C change.

Pure selection policy: `lib/employee-action-reminder.ts`. Current supported
attention targets are receipt, payable-expense and closing; unrelated messages
and existing cash-issue flows remain in their current UI. No global bell/icon
replacement or mass notification redesign has been performed.

The reusable client code is still inside indicator-preview for owner inspection.
Before a production candidate, move it to the Workday shared component boundary,
remove demo-only routes/hooks, review all types/failure/foreground states and
seek exact release approval. Do not ship preview scaffolding accidentally.

## Verification

- 8 selection tests, 153 Workday tests and 78 payroll tests passed; TypeScript
  and production build passed for the local candidate.
- Actual local native checklist: pending cash task -> Open -> native cash form
  -> save zero in isolated DB -> done -> no reminder on Schedule or Salary.
  The next handover at 20:00 remained future and produced no premature reminder.
- Public/prod DB and 1C untouched; fixture DB is
  `payroll_real_acceptance_20261022`, fake account `real-preview-4`, local 1C
  proxy only, zero push subscriptions. Test shift was explicitly created for QA.
- Outline initially failed because native CSS forces box-shadow with !important.
  Use a temporary outline and trigger after React commits the actual card;
  verified both visible transient outline and no residual outline afterward.
- Narrow viewport checked: reduced empty padding/gaps in the reminder only;
  text now fits two lines, Open and Defer touch targets retained. Browser
  viewport override reset afterward; not a physical-phone verification.
- Physical phone, push/foreground/snooze lifecycle, real issue resolution and
  source-failure/recovery end-to-end are still release gates, not proven by this
  cash-only local walkthrough.

Shimmer on Start Workday was discussed but explicitly deferred until this task.

## Receipt / ADMIN reply walkthrough

- Owner approved a local demonstration using existing native attention/inbox UI.
  Isolated fixture `local-notification-preview-credit-20261022`, document clearly
  named `ПРИМЕР-001`; no 1C writes, no delivery process, zero push subscriptions.
  Fixture helper: `.wip/reminder-notification-scenario.mjs create|reply|resolve`.
- Native receipt group uses the selected animated bell only while the local
  provider exists and the group requires action. Waiting groups and inbox
  message icons are unchanged; production flag is still off.
- Verified Schedule reminder -> exact native receipt detail. Read marking removed
  unread badge but retained unresolved receipt action. Added ADMIN message and
  `workday_issue_reply` fixture: native inbox showed it as new with static message
  icon; opening showed the reply inside the same receipt detail, not a second task.
- Changing only the fixture issue to resolved was picked up automatically by the
  native refresh. Detail said the issue no longer required action, receipt group
  disappeared, and the next genuine checklist action became the reminder.
  Reopened the same fixture for owner inspection; no extra duplicate issue.
- Build/TypeScript and 8 reminder policy tests passed. Targeted pre-existing
  notification/attention suite: 16/17 passed. The failure in
  `tests/employee-attention-card.test.mjs` expects the former inline summary
  markup; HEAD also uses EmployeeAttentionPanel and does not match that regex.
  This baseline test was not silently weakened or changed. Reconcile before release.
- Existing resolved native detail still has a redundant `На проверке: 0` header
  above the accurate resolved text. Review this small copy state before release;
  it was not redesigned in the demonstration.
- Physical-device, failed-source recovery and actual 1C receipt correction remain
  unverified; fixture resolution proves portal lifecycle only, not fiscal matching.

## Exact files for this real-source step

- `app/(dashboard)/employee/payroll/indicator-preview/ReminderPreview.tsx`
- `app/(dashboard)/employee/EmployeeTodayClient.tsx`
- `app/(dashboard)/employee/layout.tsx`
- `components/workday/EmployeeAttentionPanel.tsx`
- `lib/employee-action-reminder.ts`
- `tests/employee-action-reminder.test.ts`
- This note and `docs/codex-memory/project-index.md`.
- Ignored local QA reset helper `.wip/reset-reminder-test-task.mjs`.

Earlier ADMIN payroll dirty files were not changed/staged. No commit or release.
