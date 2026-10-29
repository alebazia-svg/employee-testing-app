# Unified Procurement mobile cabinet — local candidate, 2026-10-30

Owner explicitly approved a local unified three-tab cabinet after reproducing
cross-route pauses and the bell disappearing/reloading in production1.19.7.
The owner subsequently approved release after final verification; this note
records candidate preparation, with release verification tracked separately. Existing finance/1C, desktop calendar and other
employees must remain unchanged. A subsequent owner correction removes the
mobile-only completed-issue amount/request caption: current balance is sufficient.
The existing actionable cash-collection notice and bell linkage stay unchanged.

## Architecture and boundaries

Existing route prefetch in1.19.7 was insufficient: /employee and /procurement
replace separate layouts and recreate the header/notification state. Reused the
existing Workday/Schedule client and the existing ProcurementHome calendar inside
one mobile-only mounted cabinet. The ordinary ProcurementShell desktop branch
remains in place; there is no desktop Workday/Schedule navigation.

- One common header/notification client and bottom navigation. Active view changes
  React state plus native Next-compatible history, without RSC route navigation.
  Browser Back/Forward restore the selected section. Calendar month, procurement
  subview, expanded details and scrolling are retained while views are hidden.
- Existing workday loader/providers and financial source streams are reused.
  Existing mutation endpoints and fresh financial checks are unchanged. Mounted
  component state is not an authorization/payment-validation cache; no new
  localStorage/sessionStorage/service-worker cache or financial API added.
- Identity/inspection keys reset the mounted state when principal/visit changes.
  Preview still requires its original live ADMIN actor; mutations remain blocked.
  Procurement department inspection may now read its own workday/schedule/attention/
  cash-issue/shift-correction snapshots; Procurement payroll stays forbidden.
- Common workday notification actions open the same workday/calendar/accountable
  views locally. Ordinary manager notifications keep their existing path.
  Hidden workday does not record a foreground visit or calendar-period view;
  shared activity tracking avoids duplicate Procurement visits.
- Phone-only CSS preload prepares the theme without applying it on desktop.
  Both panes share the original rounded content surface; calendar dialogs hide
  the common navigation as before. Inspection outer height subtracts its banner
  so the toolbar does not cover the phone header during excess outer scrolling.
- Buyer completed issue caption removed from ProcurementDeliveryNativeStatus.
  Ready/partial collection instructions and ADMIN document/status details remain.
  No issue amount, balance, request, RKO or notification lifecycle changed.

## Verification

- TypeScript and final production build pass. 227 workday tests, 27 targeted
  navigation/inbox/schedule/reminder checks, and six native-delivery UI tests pass.
- Six phone/desktop × Procurement/Day/Schedule HTTP reads, unauthorized/actor
  boundaries and mutation405 pass; users/workdays/notifications/receipt-plan-cash
  snapshots unchanged. No production database/1C writes performed.
- Browser390×844, real isolated authenticated app: common bell opens from all
  three tabs; two clearly labelled synthetic local notices keep their badge.
  November calendar month and History subview survive switching; native Back/
  Forward work. Exactly one header. Proxy page-read count3 before and after the
  final switch/back/forward sequence; background API polling remains active.
  This proves no server-page navigation, not a physical-phone latency benchmark.
- Payment form open/type/cancel, accountable refill form open/cancel, history
  detail, stored PDF receipt loading and two-page controls verified without send.
  Desktop calendar heading present and employee-navigation count0. Diana keeps
  ordinary Day/Schedule/Salary navigation, with no Procurement mobile context.
- TEST source currently gives an unavailable/incomplete order/debt refresh, so
  the original stale-data warnings and submission block are visible. Fresh 1C
  financial writes/roundtrip and physical QR/push not exercised in this iteration.
- Browser automation clicking the header inside the inspection iframe was
  unreliable; direct mobile-frame URL was used to verify real pointer opening
  of the bell and forms. The single interactive deliverable uses that real frame.
- Local synthetic notices exist only in isolated DB55438, marked local-navigation
  tests. No real employee messages/credentials copied. Unrelated node_modules,
  uploads links and old local harness remain untracked and untouched.

Logs: `/tmp/mobile-mounted-{final-build,final-http,tsc,regression,workday-tests,delivery-ui-tests}.log`.
Local HTTP observation proxy: port3236 forwards to isolated app3235, logs paths
and resource names only; no cookies/credentials/body data logged. It and the
launchers are .wip-only and excluded from product changes. Current preview is
read-only and expires normally after30minutes; reopen from local Employees if needed.

## Exact candidate files

- `app/(dashboard)/admin/employees/preview/[visitId]/page.tsx`
- `app/(dashboard)/employee/EmployeeTodayClient.tsx`
- `app/(dashboard)/employee/WorkdayNotificationsClient.tsx`
- `app/(dashboard)/procurement/layout.tsx`
- `app/api/admin/employees/preview/[visitId]/route.ts`
- `components/EmployeeActivityTracker.tsx`
- `components/EmployeeNavigation.tsx`
- `components/EmployeePreviewViewport.tsx`
- `components/ProcurementDeliveryNativeStatus.tsx`
- `components/ProcurementDeliveryPanel.tsx`
- `components/ProcurementShell.tsx`
- `components/procurement-mobile-shell.css`
- `lib/employee-preview-request.ts`
- `tests/procurement-delivery-native-ui.test.tsx`
- `components/EmployeeMobileStylePreload.tsx`
- `components/ProcurementMobileCabinet.tsx`
- `components/ProcurementMobileNavigation.tsx`
- `components/ProcurementWorkdayContent.tsx`
- `lib/procurement-mobile-navigation.ts`
- `tests/procurement-mobile-navigation.test.ts`

## Release acceptance additions

Legacy /employee entries for a Procurement-department buyer now redirect to the
unified /procurement cabinet, preserving requested date/edit/attention. The
ordinary employee route remains unchanged for other staff. Internal workday
selection replaces history; explicit bottom-tab navigation pushes history and
clears consumed deep-link targets, so a past push does not reopen its editor
after later tab changes. Salary/financial formulas and 1C client unchanged.
