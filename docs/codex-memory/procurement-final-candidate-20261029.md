# Procurement mobile final candidate, 2026-10-29

Status: built for local owner review; NOT published or production-ready approval.
Base: 7f4a3a7e8a8265a4f500889f4ba39be9b235788d, origin/design-local-updates, published version 1.19.1.
No future release number reserved. No commit, push, deployment or production writes.

## Scope and preserved baseline

One actual authenticated mobile app at http://localhost:3233/mobile-test-frame.html.
The wrapper contains a 390px iframe of the actual application, not recreated UI.
TEST 1C only; external guard allows GET to the exact test publication only.
Native mutation flags remain off; production credentials are not loaded.

Desktop ProcurementShell rendering branch exactly matches the current baseline.
Financial app/api/procurement routes, lib/one-c.ts, five source helpers and Prisma
schema match baseline. Experimental HTTP body recovery is excluded from this
candidate and preserved in the original worktree. Published procurement QR assets
are unchanged; the existing payload is decoded by the test and accepted by API.

Astemir: procurement / PROCUREMENT. Muhamed: procurement / WORKDAY, no financial
access. Diana: retail / WORKDAY, retail QR. These are LOCAL fixture users only.
Production users were not created or reassigned.

## Merge and acceptance corrections

Preserved new cash-inventory reconciliation in notification dispatcher.
Kept published QR card/assets, removed duplicate old candidate card; card now
states workday attendance is connected. Removed candidate desktop workday link.
Finish resolves all three reminder slots immediately. Mobile document chooser,
retained upload/retry and modified error copy are scoped to mobile presentation;
desktop retains its original picker and labels.

## Verification

- 74 policy/contract tests and 6 SSR UI tests passed; no skips.
- TypeScript check passed; production build passed, receipts flag enabled.
- Real local HTTP flows for buyer, Muhamed and Diana: wrong QR 400; start 200
  without shift; planned start/end null, late=0, no cashier checklist; 3 notices;
  finish 200 without QR; no pending/sent reminders after finish; repeat finish404.
  Forgotten day: missing actual time400, future400, actual18:17 Moscow persisted
  as15:17UTC with audit. Financial GET buyer200, Muhamed/Diana403.
  Disposable QA clones were deactivated after testing.
- Actual mobile navigation Day/Schedule/Procurement; schedule editor open/cancel;
  order search/selection, USDT/CNY/QR fields, draft discard confirmation;
  accountable balance1205 and request form open/cancel; history order000455
  paid100 with TEST RKO001908; uploaded DEMO2pagePDF and reopened it.
  Authenticated receipt GET200, one RECEIPT,2365bytes, exact original SHA256.
- Mobile body clientWidth390 equals scrollWidth390; desktop shell inspected wide.
- Normal TEST planning sync:214orders,53settled,145needs_review,1prepayment,
  12receipt_debt,3small_balance; oneCWrites=0. Not all orders financially cleared.

## Test environment and limits

Old tmpfs database disappeared after Docker shutdown. Created isolated persistent
PostgreSQL container/volume mobo-procurement-final-candidate-20261029 on localhost
55438. Clean historical migration chain failed because an old migration references
missing TerminalFiscalReviewParticipant. Current schema was pushed ONLY to this
new disposable test database; no production migration or unrelated OFD repair.
No new migrations are part of the candidate.

Restored the local fixture of the previously verified TEST payment
PAY-20261029-052634. Live TEST RKO001908 was independently recognized again.
This fixture restoration is not a new end-to-end 1C submission. DEMO receipt was
uploaded again. Previous topup001106/RKO001907 proof remains in the earlier report;
no new 1C documents were created during this candidate pass.

Physical phone camera, push, safe-area and system keyboard remain device acceptance
items. No guarantee that prior network stalls are permanently resolved.
Release requires separate owner approval, a new version and live/branch recheck.
Original dirty worktree preserved. Local harness, credentials, uploads, fixtures,
node_modules and diagnostic files are excluded from the source manifest/patch.

## Exact candidate source files

- `app/(dashboard)/admin/employees/EmployeesClient.tsx`
- `app/(dashboard)/admin/workday/WorkdayQrCodes.tsx`
- `app/(dashboard)/employee/EmployeePortalHeader.tsx`
- `app/(dashboard)/employee/EmployeeTodayClient.tsx`
- `app/(dashboard)/employee/StaleWorkdayCloseSheet.tsx`
- `app/(dashboard)/employee/WorkdayNotificationsClient.tsx`
- `app/(dashboard)/employee/layout.tsx`
- `app/(dashboard)/procurement/ProcurementPaymentCalendarClient.tsx`
- `app/(dashboard)/procurement/ProcurementPaymentForm.tsx`
- `app/(dashboard)/procurement/layout.tsx`
- `app/api/employee/workday/finish/route.ts`
- `app/api/employee/workday/start-intent/route.ts`
- `app/api/employee/workday/start/route.ts`
- `components/EmployeeNavigation.tsx`
- `components/ProcurementCargoPaymentForm.tsx`
- `components/ProcurementChangeHistory.tsx`
- `components/ProcurementCnyFields.tsx`
- `components/ProcurementDataRefresh.tsx`
- `components/ProcurementDeliveryNativeStatus.tsx`
- `components/ProcurementDeliveryPanel.tsx`
- `components/ProcurementDocumentSections.tsx`
- `components/ProcurementReceiptEvidence.tsx`
- `components/ProcurementReceipts.tsx`
- `components/ProcurementShell.tsx`
- `components/ProcurementUsdtFields.tsx`
- `components/procurement-receipts.css`
- `lib/employee-home.ts`
- `lib/workday-notifications.ts`
- `lib/workday-qr.ts`
- `lib/workday.ts`
- `public/pwa-design-studio.css`
- `tests/procurement-delivery-native-ui.test.tsx`
- `tests/procurement-document-picker.browser.test.ts`
- `tests/procurement-qr-check.test.ts`
- `components/ProcurementMobilePresentation.tsx`
- `components/procurement-mobile-shell.css`
- `lib/procurement-file-size.ts`
- `lib/procurement-mobile-view.ts`
- `lib/workday-end-notifications.ts`
- `lib/workday-end-policy.ts`
- `tests/procurement-file-size.test.ts`
- `tests/procurement-mobile-view.test.ts`
- `tests/workday-end-reminder.test.ts`

## Subsequent production release

Owner approved release and reserve recovery. Version 1.19.3 / code `2c1d4961` was
released and independently verified on 2026-10-29. See
[release record](../ops/procurement-mobile-release-20261029.md). The local-only and
release-pending statements above describe the earlier candidate phase.
