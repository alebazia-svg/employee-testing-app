# QR receipts before the supplier expense — release 1.10.5

Owner-approved change and production deployment. Runtime commit:
`138f1cf2bb60b07e8425dca662cfe9138bec4f3d` (version 1.10.5).
Both live metadata and the freshly fetched deployment branch were 1.10.4
immediately before assigning the patch version and pushing. Package and lockfile
root versions agree. No migrations or 1C extension changes.

## Agreed workflow

- Only `ACCOUNTABLE_QR`: after approval the buyer can attach proof before the
  supplier expense exists in 1C. Cashbox funding is not supplier payment.
- Missing QR proof appears in both cabinets' existing receipt queue on the
  planned Moscow calendar day, not before. Cancelled/unapproved/manual-completed
  requests and pre-rollout dates do not create pre-payment tasks.
- Upload removes the missing-receipt task, but does not change approval,
  financial evidence, balances, matching, order/contract links or completion.
- ADMIN sees “Чек добавлен · ожидает оформления в 1С” while the known state has
  no payment; incomplete/conflicting evidence is labelled not confirmed instead.
  Buyer sees “Чек добавлен”. Confirmed 1C payment retains existing closure rules.
- BANK, USDT, CNY still enter the queue after reconciled partial/full payment;
  CASH and the two existing 2026-10-10 rollout exceptions are unchanged.
- The existing bell dialog reads identity-checked saved evidence only; opening
  it does not request 1C or make a financial decision from a cache.

## Notifications / safety

No new notification kind, reminder, scheduler or send path. Existing receipt
events, deduplication, quiet hours and rate limits remain unchanged. Merely
entering the receipt queue emits nothing. Owner explicitly required no messages
to real employees during this work. No production test upload, test dispatch,
business DB write, 1C write or migration was performed.

## Verification

- 70 focused unit/regression tests: QR policy, partial payments, completion,
  small remainder, supplier advances/cargo, viewer, notification details,
  quiet hours and mocked push dispatch. All passed.
- Real persistence test passed on **isolated** PostgreSQL database
  `procurement_qr_receipts_20261020` at localhost:55439: upload before RKO,
  duplicates, both authors, access checks and unchanged financial plan row.
- Existing receipt dispatcher test mocks were completed for its newer attention
  and observation dependencies; no provider or real DB used by that test.
- TypeScript and production build checked in a temporary source copy without
  production credentials. No runtime source under an existing version published.
- Actual local buyer/admin screens checked using synthetic records: due QR
  enters queue, future QR remains out but allows upload, unpaid BANK remains
  out; buyer upload succeeds and ADMIN reads it while request stays open.
  Desktop and 390px mobile modal inspected. Test DB: zero push subscriptions
  and zero delivery records. Local server/tab stopped after review.
- Screenshots: `/tmp/mobo-qr-receipts-admin-desktop.png`,
  `/tmp/mobo-qr-receipts-admin-mobile.png`. These contain synthetic data only.

Procurement evidence score unchanged 54.8; no stage/item/ledger changes.
Real-device delivery and live 1C closure were deliberately not exercised
overnight. Five release-metadata tests and the final 1.10.5 build also passed.

## Deployment verification

Deployed and verified after midnight Moscow, 2026-10-21. Previous server
commit: `0caf26bccc8325e5fa3cd066de58b207cf870d63` (1.10.4).
Rollback image is protected as `portal-app:rollback-before-1.10.5`.
Disk preflight passed (18 GiB free; required minimum 15 GiB). No pruning used.

- Independent SSH readback confirmed exact runtime HEAD `138f1cf2bb60b07e8425dca662cfe9138bec4f3d`.
- Public `/release-info.json`: 1.10.5, built `2026-10-20T20:58:24.996Z`.
  Public revision remains null under the existing Docker build setup; commit
  identity was checked separately, not inferred from that metadata.
- Authenticated production admin calendar displays 1.10.5 and
  `20.10.2026, 23:58 МСК`. Its QR request appears in the receipt queue before
  expense confirmation, with enabled upload and explicit completion guidance.
- Read-only UI verification only: no production file uploaded or payment edited.
  Screenshot: `/tmp/mobo-qr-receipts-production-1.10.5.png` (private live data;
  not committed). Buyer production cabinet not independently switched into;
  both roles were verified on isolated local data before release.
- Root deployment output confirmed running image
  `sha256:ea5fb9a495c66fe9615c357f98ec1e7120427eaae7edcf631ec5c194f55158a1`.
  After independent public/UI checks, verified-image registration succeeded
  for that exact image; script reported `RELEASE_COMPLETE_1.10.5`.
  Separate unprivileged Docker inspection was denied; no health-status claim
  is based on it. Public admin route returned HTTP 200 and authenticated UI
  loaded successfully.

## Exact changed files

- `lib/procurement-receipt-policy.ts`
- `components/ProcurementReceipts.tsx`
- `app/(dashboard)/procurement/ProcurementPaymentCalendarClient.tsx`
- `app/(dashboard)/admin/procurement/AdminProcurementClient.tsx`
- `components/NotificationRecordDialog.tsx`
- `lib/notification-detail.ts`
- `lib/notification-detail-reader.ts`
- `tests/procurement-qr-receipts.test.ts`
- `tests/procurement-partial-receipts.test.ts`
- `tests/procurement-receipts.integration.test.ts`
- `tests/procurement-receipt-dispatch.test.ts`
- `tests/procurement-receipt-viewer.test.ts`
- `tests/notification-details.test.ts`
- `package.json` and `package-lock.json` (version 1.10.5).
- This note and `docs/codex-memory/project-index.md`.

Unrelated untracked `app/access-clarity-review/` and `node_modules` retained.
