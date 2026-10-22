# PWA native tabs and semantic reminders — 1.13.13

Owner explicitly authorized the combined production release after local visual
approval and fresh payroll reconciliation. Runtime candidate:
`3cd8bba3838c7a2a0eabdbcdba06c82d220a4609`, based on deployment branch `8bffd24`
and live runtime 1.13.12 / `cc1b359`. Production deployment verified October 23.

## Approved scope and retained boundaries

- Salary joins the existing native Workday/Schedule tab shell. No blocking
  server navigation when entering or leaving salary. Schedule defaults to month.
  Attention stays mounted so an existing receipt opens with its known detail,
  not a transient zero count. No new workday loading screen or parallel poller.
- Salary immediately reuses its existing account/inspection-scoped volatile
  result, then refreshes in the background. First current-month entry can request
  the stored projection before reading fresh advances. Keep only current and
  previous month, rolling with Moscow dates across years. No financial browser
  storage or extra scheduled jobs. Private/no-store/auth gates preserved.
- Unknown advances stay unknown; confirmed zero hides the advance card. Technical
  source-refresh failures are not employee tasks and do not erase known actions.
  Existing task completion/read/defer rules and the header inbox remain intact.
- Header bell remains the inbox entry. Action reminders use receipt, checklist,
  money and other meaningful symbols, with bounded copper/motion emphasis.
  Inbox/history/detail symbols remain static; reduced motion is respected.
- Approved start-shift card retains its graphite button, larger readable text,
  copper QR scan cue/arrow and one native scan action. No shift-start rules change.
  Bottom icons use equal base sizing plus the approved optical clock adjustment.
- Full previous-shift details stay on Workday, not above salary/calendar.
  Calendar cells are not resized. October fits at 390x845 with a 48px reminder;
  smaller screens and six-week months may need limited vertical scrolling.
- Confirmed earlier salary credit is disclosed separately, without rewriting
  cash paid or accrued totals. Unique recorder/person/date/amount evidence joins
  cash and ledger; their unrelated line numbers are not equated. Unknown matches,
  future advances and cross-organization netting cannot manufacture a zero debt.
- No payroll formula, discipline policy, ADMIN workbook, attendance module,
  database migration, production financial record or 1C write. Procurement and
  terminal-fiscal 1.13.11/1.13.12 changes preserved byte-for-byte.
- Animation comparison route is authenticated and isolated-demo-only; production
  compose keeps PORTAL_ISOLATED_DEMO=0. Example tasks never persist or execute.

## Verification before deployment

- Merged-candidate TypeScript, production build, whitespace and five release-info
  tests passed. 153 workday tests, 78 payroll tests, 128 focused private-payroll,
  native-tab, reminder, inbox and surrounding server tests, plus 19 client-compatible
  settlement/estimate tests passed. Counts overlap; do not sum as unique cases.
- Buyer SSR/home suite: 20/25 pass; five legacy baseline assertions fail.
  Existing 1.13.12 release notes already disclose this baseline. Exact buyer UI
  and failing test source match production `cc1b359`; no procurement repair was
  included. Initial combined invocation also used an unsuitable React server
  condition for buyer SSR; rerun with the correct runtime separated that issue
  from the five baseline failures. Never describe the entire repository as green.
- Fresh read-only 1C cash, ledger and balance sources checked through October 23:
  43 cash rows and 87 ledger movements. Four PWA managers fully paid for September;
  Milana has 89,100 posted / 89,000 cash / 100 earlier credit / zero remaining.
  August 99,600 posted / 99,700 cash explains the credit. No rounding write-off.
- Isolated real-application replay of four complete captured 1C responses,
  captured `2026-10-22T21:51:49.313Z` (October 23 Moscow), passed API checks for all
  five managers: exact amounts, private boundaries, account override rejection,
  procurement exclusion, malformed query rejection and zero-advance hiding.
- Actual local app: day/schedule/salary transitions, cached salary during seven-
  second delay, HTTP 503 retaining salary and receipt detail, no false-zero check
  list, account change, scanner open/no-camera/cancel and responsive layout checked.
  Fresh merged app displays Milana's correction and full-month calendar correctly.
- Physical iPhone, real camera recognition and live push delivery are not claimed
  tested. Owner will verify the phone after publication. Production view/mutation
  checks must not start shifts, alter schedule or issue cash.

## Persistent source limit

October sales earnings remain through October 17 because live 1C's last executed
cost close is October 17, 21:35:54. A close request for October 22 returned
ready=false with that earlier execution date. This is not fixed or hidden by
salary caching. Cash payments/advances have their own fresh-through-October-23
read. Do not call an old earnings boundary fresh or conflate it with payout date.

## Production verification

- Independently read server HEAD: `3cd8bba3838c7a2a0eabdbcdba06c82d220a4609`.
  Public release-info reports 1.13.13, built `2026-10-22T22:03:58.594Z`.
  Revision metadata remains null/source unknown; exact source identity was checked
  independently through Git, not inferred from that missing metadata.
- Authenticated production employee inspection: new start card present; salary
  tab opens locally; Schedule opens immediately and defaults to whole month.
  After current calculation loads, returning to salary shows 38,600 immediately
  while refresh runs. September shows 89,100 / 89,000 / earlier credit 100 / zero.
  Confirmed zero advances hidden. No global technical task errors appeared.
  About dialog visibly reports 1.13.13 / October 23 01:03 Moscow.
- Public health OK; container running/healthy. Environment file hash, mounted
  volumes and relevant feature flags unchanged; no migrations or financial writes.
- Previous image: `sha256:254b556fa468bcaf98bfb874c5b70a01b2a5f8e5a582dfd1e1dc532bb3074439`.
  Replacement: `sha256:1292b455fc49b509e5276e00d9eb558bac0f41dceb52d2ca8ab0b90a585538c4`.
  Verified-image registry now contains this image and two previous checked images.
  Registration followed independent UI verification. Deploy exit 0; 19 GiB free
  (81% filesystem used). Retention reduces accumulation, not a guarantee against
  all future capacity incidents. Physical iPhone/live push still owner checks.

## Exact runtime file scope

### Follow-up 1.13.14 — calendar first display and active icon details

Owner approved this narrow release; salary loading and all task/notification
behavior remain unchanged. Runtime/server commit:
`5432908809b6de1268c090be83d43a837b2e8e4c`. Public and authenticated About show
1.13.14, built `2026-10-22T22:22:05.325Z` (October 23 01:22 Moscow).
Home reads the complete current calendar grid plus the existing 31 upcoming
dates in the same bounded queries. Only the explicitly complete initial month
is marked loaded; other months still require a successful range response.
No new browser persistence or polling. Active calendar/card inner strokes are
white, copper bodies retained, calendar cell dimensions unchanged.

TypeScript, production build, 154 workday tests and 25 release/UI/tab tests pass.
Local seven-second transport delay leaves calendar visible. Authenticated
production first opening immediately shows Liana's eight original working days
(16, 18–24 October), no ellipsis cells; cell height remains 52px. Actual SVG
computed strokes for both active icons are `rgb(255,249,235)`. No production
schedule edit or financial write was submitted. Physical iPhone check remains
the owner's verification.

Previous image: `sha256:1292b455fc49b509e5276e00d9eb558bac0f41dceb52d2ca8ab0b90a585538c4`.
Replacement: `sha256:c2e6790bbf40b085c79dd9d2c99dc3f4bc15b9c583ef23ec1a892d7ee510dda7`.
Container healthy; environment hash, mounts and feature flags preserved. Brief
public startup failure cleared within the scripted retry before UI verification.
Verified-image registration followed independent server/public/UI checks;
deployment exit 0. Registry contains 1.13.14, 1.13.13 and 1.13.12 checked images;
17 GiB free after deployment. Owner's unrelated primary-checkout WIP untouched.

Exact files in follow-up: `app/(dashboard)/employee/EmployeeTodayClient.tsx`,
`components/EmployeeNavigation.tsx`, `lib/employee-home.ts`,
`lib/workday-schedule.ts`, `public/pwa-copper.css`,
`tests/employee-tab-streaming.test.mjs`, `tests/workday-schedule.test.ts`,
`package.json`, `package-lock.json`.

### Original 1.13.13 file scope

The full original exact file list is `git show --format= --name-only 3cd8bba`; it includes
the shared employee shell/preview, personal payroll screens/read models, reminder
and inbox components, semantic icon helpers/styles, start-card CSS, package
metadata and focused tests. No procurement runtime file changed. Unrelated dirty
files in the owner's primary checkout were left untouched.

- `app/(dashboard)/admin/employees/preview/[visitId]/page.tsx`
- `app/(dashboard)/employee/EmployeeTodayClient.tsx`
- `app/(dashboard)/employee/WorkdayNotificationsClient.tsx`
- `app/(dashboard)/employee/payroll/PersonalPayrollClient.tsx`
- `app/(dashboard)/employee/payroll/PersonalPayrollScreen.tsx`
- `app/(dashboard)/employee/payroll/page.tsx`
- `app/(dashboard)/employee/reminder-comparison/ReminderComparison.tsx`
- `app/(dashboard)/employee/reminder-comparison/comparison.module.css`
- `app/(dashboard)/employee/reminder-comparison/page.tsx`
- `components/workday/EmployeeActionReminder.tsx`
- `components/workday/EmployeeAttentionPanel.tsx`
- `components/workday/EmployeeNoticeIcon.module.css`
- `components/workday/EmployeeNoticeIcon.tsx`
- `components/workday/EmployeeNotificationInbox.tsx`
- `lib/employee-attention.ts`
- `lib/employee-navigation.ts`
- `lib/employee-notice-icons.ts`
- `lib/employee-payroll-history.ts`
- `lib/employee-payroll-read.ts`
- `lib/employee-payroll-response.ts`
- `lib/employee-payroll-view.ts`
- `lib/employee-preview-request.ts`
- `lib/payroll-one-c-ledger.ts`
- `package-lock.json`
- `package.json`
- `public/pwa-copper.css`
- `tests/employee-attention.test.ts`
- `tests/employee-navigation.test.ts`
- `tests/employee-notice-icons.test.ts`
- `tests/employee-payroll-history.test.ts`
- `tests/employee-payroll-read.test.ts`
- `tests/employee-payroll-view.test.ts`
- `tests/employee-pwa-design-baseline.test.mjs`
- `tests/employee-reminder-comparison.test.mjs`
- `tests/employee-tab-streaming.test.mjs`
