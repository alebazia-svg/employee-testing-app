# Unified Procurement mobile cabinet — release1.19.8, 2026-10-30

Owner approved release after full candidate verification, preserving desktop
calendar, financial functions, payroll formulas/bonuses and 1C connection.
Released server/source commit `bbbbce2d5f4bf5d114158a5b00d0209642aff7df`
(runtime implementation commit `db1d59b`). Public metadata and authenticated
ADMIN footer show1.19.8, build `2026-10-29T22:53:50.164Z` (30October01:53:50MSK).
Metadata revision is null because Docker excludes.git; server commit independently
read back. Only portal-app rebuilt/restarted. No migration delta/pending migrations.

## Scope

Three Procurement mobile sections now stay mounted in one cabinet: local state
and native history switch the view, preserving the header/bell, calendar month,
financial subview/details and scroll. Original workday providers/loaders and
ProcurementHome streams are reused; no financial authorization/validation cache.
Account/inspection keys reset volatile state across identities. Legacy /employee
entries for Procurement-department buyers join /procurement, retaining push date/
edit/attention targets. Internal state replaces history and consumes targets;
explicit tabs push history. Other employee routes remain unchanged.

Phone-only style preload complements shared React stylesheet precedence from
1.19.7. Desktop gets its previous calendar, with no mobile workday navigation.
Procurement inspection gained only own-workday read resources; payroll remains
forbidden and mutation requests remain405. Outer preview height subtracts its
banner. Buyer completed-issue amount/request caption removed at owner request;
current balance, collection action/notification, ADMIN details and history remain.

## Checks before release

- 227 workday tests, 78 payroll regressions, 15 navigation/inbox/entry-policy
  tests, six delivery UI tests and five release-info tests pass. TypeScript and
  final production build pass. Formula/bonus engine, financial API, 1C client,
  schema/migrations and compose are byte-unchanged against production1.19.7.
- Six frame/tab HTTP reads and actor-auth/mutation guards pass; users, attendance,
  notifications and receipt/plan/cash snapshots unchanged. Redirect tests accept
  Next streaming redirects and verify actual target parameters. QA identity was
  restored inactive before the final snapshot test.
- Real isolated app390×844: single header; bell available in all three tabs;
  same synthetic badge across transitions; November and History preserved;
  browser Back/Forward; payment form open/type/cancel; refill form open/cancel;
  history detail and two-page stored PDF receipt. Proxy page-read count unchanged
  during the tab sequence; background reads continue. This is not a physical
  device latency guarantee. Desktop title present with mobile navigation count0.
- Ordinary manager QA Day/Schedule/Salary retain one header and all three current
  theme links. Google/payroll/money sources not overwritten for QA.

## Production verification

- Public health200, metadata1.19.8 and exact server commit independently verified.
  Employee/procurement/admin workday/payroll shells200; unauthenticated employee
  workday API401. Authenticated ADMIN footer confirms version/build date.
- Astemir: desktop calendar without mobile navigation. In the real phone preview,
  Day/Schedule/Procurement switch with one header, unread badge5 before/after,
  November month preserved, History subview preserved. Bell opens the five real
  notices. Accountable panel has no duplicate completed-issue caption. No employee
  action, financial request, receipt upload or read acknowledgement submitted.
- Zukhra: Day/Schedule/Salary and current1.19.8 theme links verified; one header,
  no Procurement mobile context. Diana: past October1 remains editable, no save.
- Old design did not appear in these tested transitions. No blanket claim for
  every physical phone, every route or arbitrary network conditions. Physical
  camera/push and real financial writes/1C roundtrip not repeated in this release.
  Local TEST source incomplete/unavailable state remains explicit in candidate
  evidence; submit guards remained active. Financial source code unchanged.

## Runtime safety and reserves

Approved root script holds deployment/storage flock. Every registered reserve
was present before build. Baseline hashes of1C environment plus sorted mounted
volume/bind identities compared after restart: `ONE_C_CONNECTION_AND_MOUNTS_UNCHANGED`.
No connection values or credentials logged. Only derived hashes in root-owned
`/tmp/mobo-1.19.8-config-before.json`. Env/uploads/database manually untouched.

After independent UI/public verification, current image registered and approved
conservative maintenance completed. Final image is healthy, registry images all
inspected successfully, `DEPLOY_EXIT=0`, free space26.53GiB:

- Current1.19.8: `sha256:65506462e34bd861bd15de84215c695013cf2f1a5917a1645588de913144ed9c`
- Reserve1.19.7: `sha256:c79e6e7966103bff46324e78ea4aff60365a53287b5c3f431a0a0d032594ebd0`
- Reserve1.19.6: `sha256:71c972d5d0fdc7d747f98611ff01f559f5641faacaffacc58a35b971a9ac558b`

Evidence: `/tmp/mobo-cabinet-release-1.19.8.log`,
`/tmp/mobile-cabinet-1.19.8-*`, and current visualization image
`unified-mobile-released-1.19.8.png`. The real Astemir inspection is left open in
Edge; original masked Muhamed access dialog preserved, no reset/copy. Untracked
node_modules/uploads links and old local mobile harness excluded and untouched.

## Exact release delta from1.19.7

- `app/(dashboard)/admin/employees/preview/[visitId]/page.tsx`
- `app/(dashboard)/employee/EmployeeTodayClient.tsx`
- `app/(dashboard)/employee/WorkdayNotificationsClient.tsx`
- `app/(dashboard)/employee/page.tsx`
- `app/(dashboard)/procurement/layout.tsx`
- `app/api/admin/employees/preview/[visitId]/route.ts`
- `components/EmployeeActivityTracker.tsx`
- `components/EmployeeMobileStylePreload.tsx`
- `components/EmployeeNavigation.tsx`
- `components/EmployeePreviewViewport.tsx`
- `components/ProcurementDeliveryNativeStatus.tsx`
- `components/ProcurementDeliveryPanel.tsx`
- `components/ProcurementMobileCabinet.tsx`
- `components/ProcurementMobileNavigation.tsx`
- `components/ProcurementShell.tsx`
- `components/ProcurementWorkdayContent.tsx`
- `components/procurement-mobile-shell.css`
- `docs/codex-memory/diana-days-candidate-20261030.md`
- `docs/codex-memory/employee-preview-devices-candidate-20261029.md`
- `docs/codex-memory/procurement-mounted-mobile-candidate-20261030.md`
- `docs/codex-memory/project-index.md`
- `docs/ops/employee-cabinet-release-20261030.md`
- `lib/employee-preview-request.ts`
- `lib/procurement-mobile-navigation.ts`
- `package-lock.json`
- `package.json`
- `tests/procurement-delivery-native-ui.test.tsx`
- `tests/procurement-mobile-navigation.test.ts`
