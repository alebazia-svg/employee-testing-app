# Employee preview devices / PWA polish — local candidate 2026-10-29

Owner explicitly approved a Phone/Computer selector in Astemir's ADMIN employee
inspection. Subsequent approved corrections: copper-filled selected Procurement
icon / outline inactive icon, remove old-design flashes and improve tab response,
show colleague first name and actual attendance times for no-shift employees.
Owner requires representative regression checks before any subsequent release.
This candidate is NOT deployed. No new release number allocated. Branch:
`codex/employee-preview-devices`, based on parallel 1.19.4 code `b4a4b6d` plus
separate activation documentation. Runtime code remains local modifications.

## Implementation

- PROCUREMENT inspection opens a Phone/Computer toolbar. Same-origin iframe uses
  the existing actor-bound preview visit and authentication, fixed 390/1440 CSS
  widths. Toolbar stays below the existing inspection banner; height fits the
  available window. Default phone, one screen at a time; desktop can pan on a
  narrow host panel. Regular WORKDAY manager inspection is unchanged.
- Inner `frame=phone|desktop` page omits the repeated banner, keeps modal read-only
  notices and full API restrictions. All three Procurement tabs stay inside the
  same visit/frame. Day/Schedule reuse EmployeeTodayClient; Procurement reuses
  existing ProcurementHome/Shell. Unsupported tabs and unauthorized employees
  cannot gain salary/finance access by supplying a query parameter.
- Existing PWA stylesheet links now use React stylesheet precedence: Next App
  Router hoists/deduplicates resources and waits for their loading before revealing
  the dependent UI. Real browser DOM verified all three stylesheet links in HEAD.
  No dependency version changed. See https://react.dev/reference/react-dom/components/link.
- Before matchMedia resolves, mobile CSS hides only the transient desktop SSR
  tree on phones. Desktop geometry and financial rendering remain unchanged.
- Cross-route Procurement navigation uses public Next Link full prefetch; local
  Day/Schedule selection still uses existing state callbacks. Pending route
  transition gives immediate explicit feedback. No custom financial cache or
  validation change. Existing saved-first and streamed live Procurement reads
  remain intact. Total streamed HTTP response time (3–4 seconds in TEST) is NOT
  a measurement of visible click delay; no claim of physically zero network
  latency or a real-phone performance benchmark.
- Procurement's first SVG path fills copper only when selected; internal strokes
  are white. Inactive paths all remain unfilled. Browser computed styles verified.
- Schedule display normalizes the known historical `Астемир Тохов` display order
  only for first-name labels/disambiguation. No account/payroll/1C renaming.
- No-shift colleagues show actual Moscow start/end, or actual start plus explicit
  unfinished/missing-end wording. No planned shift or invented checkout used.
  Ordinary retail/wholesale colleague shift details remain unchanged.

## Checks

- 16 navigation/read-boundary/presence/schedule tests and nine existing workday
  end-reminder tests passed (25 total). TypeScript and final production build pass.
- Real isolated production-build HTTP checks at localhost:3235, local DB:55438:
  both device frames × Procurement/Day/Schedule = six valid reads. Unauthenticated
  and employee callers cannot see the inspected identity; employee API 403 and
  mutation 405 verified. User/day/notification/receipt/plan/cash snapshots unchanged.
- Browser: Phone/Computer switching, all three Astemir tabs, payment form open /
  cancel, completed colleague name/time in Muhamed, own schedule, ordinary manager
  shift start + schedule editor open/cancel and salary tab with feature flags,
  Diana's shiftless Retail day and schedule. No actual workday or financial
  submission in production. Phone camera/push/device paint timing not tested.
- Isolated fixture Astemir display aligned with production's historical name order;
  synthetic completed attendance 08:43–18:12 used only in local DB. Ordinary
  manager QA fixture is disposable and is deactivated after checks. No copying of
  real employee attendance, payroll values or passwords into fixtures.
- Live 1C client, procurement APIs, schema/migrations, real financial state and
  production desktop calendar untouched. Unrelated node_modules/uploads links
  and the old local harness remain untracked and untouched.
- Local TEST planning refresh completed with 214 orders, oneCWrites=0. All writes
  in preview remain blocked. Local demo launchers/HTTP checks/fixtures in .wip
  are excluded from runtime changes.

## Separate Diana salary decision — investigation only

Diana's access was explicitly enabled earlier; she remains Retail, WORKDAY, SCAN,
linked to her existing payroll identity. Production actor-bound salary preview
currently shows “Расчёт временно недоступен”. Root cause not established by this
UI read; do not infer a missing salary rule or modify amounts. Owner is considering
whether/how to show bonuses because she already sees credit-cabinet information.
Recommendation was a single authoritative total with bonus breakdown and explicit
preliminary/final status. Not approved for implementation. Current formulas, salary
visibility, financial sources and credit cabinet remain unchanged. Resolve this
separately before claiming that Diana's whole salary screen is ready.

## Changed runtime/test files

- app/(dashboard)/admin/employees/preview/[visitId]/page.tsx
- app/(dashboard)/employee/EmployeeTodayClient.tsx
- components/EmployeeInterfaceStyle.tsx
- components/EmployeeNavigation.tsx
- components/EmployeePreviewProvider.tsx
- components/EmployeePreviewViewport.tsx
- components/ProcurementShell.tsx
- components/procurement-mobile-shell.css
- lib/employee-navigation.ts
- lib/work-schedule-coverage.ts
- lib/workday-presence.ts
- public/pwa-copper.css
- tests/employee-navigation.test.ts
- tests/work-schedule-coverage.test.ts
- tests/workday-presence.test.ts

Screenshots in the existing visualization directory:
`admin-phone-desktop-candidate-20261029.png`,
`muhamed-actual-colleague-local-20261029.png`.
Local logs: `/tmp/employee-preview-devices-{tests,tsc,build,http}.log` and
`/tmp/employee-preview-reminders-tests.log`.
