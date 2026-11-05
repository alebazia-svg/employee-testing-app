# Daily FX approval — local candidate, 2026-11-05

Not released. Production remains independent of this checkout. Owner approved:
show recalculation, then confirm updates to existing unpaid requests for the
selected payment-preparation day, both SUBMITTED and APPROVED. Keep their
approval states. Saved terms do not expire or change automatically at midnight.
Paid/partially paid requests retain their terms.

## Implementation

- Immutable ProcurementDailyRate revisions, actor, timestamp and reviewed
  snapshot. Additive migration 20261105193000_procurement_daily_rates. No old
  row/backfill/receipt/file/RKO relation is changed by the migration.
- ADMIN preview and confirmation use independent complete read-only 1C evidence,
  the existing shared financial advisory lock, exact plan versions, quote revision
  and the exact reviewed-set fingerprint. New payments, edits, competing course
  approval and newly matching requests invalidate the preview. One transaction
  saves the quote, reviewed request amounts/rates, binding, audit and existing
  notification records. No 1C writes or immediate external message sends.
- Foreign-authoritative request: existing plannedFxRubles rounding. RUB-only
  request: retain RUB and foreignAmount=null; save the new rate for its estimate.
- Keep incomplete/ambiguous evidence, pending buyer revisions, assigned issuance,
  existing payment documents, wallet funding and individually negotiated USDT
  budgets out of automatic recalculation. Preview lists the exclusions.
- Binding identifies exact quote + preparation day + saved rate + foreign/RUB
  amounts. Changed dates/terms do not retain a false approval indicator.
- Compact shared quote buttons in existing day headers. Colored currency logo
  means confirmed quote; gray means unconfirmed. ADMIN edits through one dialog,
  mobile bottom sheet. One shared DB-only read per day, focus/visibility and
  bounded visible polling; no financial recalculation on reads.
- Buyer list uses aligned foreign/method and RUB columns. Saved and independently
  observed actual rate remain in request details. Separate requisites/receipts,
  direct form, file viewer and owner-inspection mutation guard are retained.

## Verification / remaining release gate

Local TypeScript and focused financial/document checks; isolated PostgreSQL
persistence/race/rollback tests use daily_rates_test on port55467. Exact new SQL
was separately tested in a rolled-back isolated schema preserving prior rows.
Full historical migrate-deploy on a fresh database encounters the pre-existing
20260830143000 missing TerminalFiscalReviewParticipant dependency. The owned test
DB was rebuilt from the current schema; this does not prove the whole historical
migration chain. Do not repair unrelated historical migrations in this task.

Interactive /daily-rate-review is local-only, untracked, development-only and
requires the exact disposable daily_rates_preview database. Its 1C evidence is
explicitly synthetic. Actual ADMIN/buyer components and real new DB transaction
are used; all other actions are blocked. Never stage this review route or local
node_modules. Real production approval and paid-history safeguards still require
release review, exact pending migration check, build, visual approval and a new
version immediately before any authorized deployment.

Rollback: revert application commit; retain the additive rate table and existing
request audit. Do not bulk revert saved amounts, financial history or quote
records. A financial correction is a new explicit reviewed operation.

## Local verification result

Candidate runtime commit: `f856c7d`. TypeScript and production build passed.
87 focused checks passed across financial preparation, planned FX, scheduling,
small-remainder closure, documents, sharing, request rendering, daily-rate rules
and isolated PostgreSQL persistence. One planned-FX invocation initially lacked
`--conditions=react-server`; its six checks passed with the correct server runner.
No production connection/write/deployment or real employee message was performed.

Changed source files in this candidate:

- `app/(dashboard)/admin/procurement/AdminProcurementClient.tsx`
- `app/(dashboard)/procurement/ProcurementPaymentCalendarClient.tsx`
- `app/api/admin/procurement/daily-rates/route.ts`
- `app/api/procurement/daily-rates/route.ts`
- `components/ProcurementAdminList.tsx`
- `components/ProcurementChangeHistory.tsx`
- `components/ProcurementDailyRates.tsx`
- `components/ProcurementPreparationList.tsx`
- `components/ProcurementReceiptViewer.tsx`
- `components/ProcurementReceipts.tsx`
- `components/ProcurementRequestEquivalent.tsx`
- `components/ProcurementRequestMoney.tsx`
- `components/ProcurementRequestRate.tsx`
- `components/ProcurementSavedRate.tsx`
- `components/ProcurementVisualPreview.tsx`
- `components/procurement-daily-rates.css`
- `components/procurement-receipts.css`
- `components/useProcurementDailyQuotes.ts`
- `lib/procurement-daily-rate-server.ts`
- `lib/procurement-daily-rate.ts`
- `prisma/migrations/20261105193000_procurement_daily_rates/migration.sql`
- `prisma/schema.prisma`
- `tests/procurement-buyer-hardening.test.ts`
- `tests/procurement-daily-rate.integration.test.ts`
- `tests/procurement-daily-rate.test.ts`
