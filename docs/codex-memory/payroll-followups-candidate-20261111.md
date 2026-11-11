# Payroll follow-ups — local candidate, 11 November 2026

NOT RELEASED. Runtime base remains verified production 1.24.7 / 74e6539.
Owner approved implementation of the following defined changes. No operations
approval for this separate release has yet been given; allocate the next version
only after approval and a fresh live/canonical/concurrent-release check.

## Approved behavior

- Astemir: from November 2026, replace assumed 20 daily payments with actual
  accepted QR starts at 600 RUB/day. The owner explicitly retained Google as a
  reserve when the app has no mark; a date counts once. Reuse the existing union
  reader with exact user 10 / canonical payroll name. Active/completed/missing-
  checkout starts require a same-date accepted QR. Non-QR/cancelled starts do not
  establish an app day. Existing five-manager behavior remains unchanged.
- Preserve purchase percentage 1.75%, minimum 100,000, advances and deductions.
  Missing evidence remains unknown/reviewable, never assumed 20 or confirmed zero.
  All pre-November calculations and saved records retain existing values.
  ADMIN, private calculation assembly and the home summary share the same day
  evidence, so they cannot disagree because one retained the fixed 20.
- Display the exact film-trainee canonical identity as “Тимур · поклейка”.
  “09.2026” is the start of the continuing service rule, not proof of employment
  start. Canonical identity, source/advance matching, saved records and 70% service
  rule remain unchanged. June's Magomed attribution is untouched. Existing shared
  presentation formatting also covers the actual Excel writer.
- The observed working-days warning was a source-lock HTTP409, with exact detail:
  “Данные уже обновляются. Попробуйте чуть позже.” Owner separately approved
  waiting/re-reading rather than reporting that as failure. Show the existing
  saved result plus a compact update status. Retry every five seconds, accept a
  newer complete snapshot, and cancel on period change/unmount/replaced manual
  request. Actual HTTP/source errors and last-good-source warnings stay visible.

## Evidence and verification

Read-only live-source audit: Astemir has six valid QR dates, November 3–7 and 11,
with no Google reserve dates. Candidate day pay is 3,600 instead of 12,000.
At the current purchase base, unchanged 100,000 minimum still determines his gross
pay; the top-up increases accordingly. Audit prohibited all Prisma writes and
made no payroll/source snapshot, settings, 1C or employee-day change.

Passed: 34 focused source/current-read/individual-note/new-rule/retry tests,
80 standard payroll tests including the real workbook generator, TypeScript,
production build and diff whitespace check. Historical engine composition,
identity, cancellation, actual failures, exact fallback union, unknown/zero days,
minimum/percentage/deductions and workbook advance provenance are covered.
Existing component SSR visual check confirmed the short busy status, new name,
preserved Diana remark and original row/amount layout in the local preview.
That preview is explicitly static; it does not demonstrate live API transitions.
Production refresh/rounding/Excel/saved-run verification remains a release gate.
No production payroll save/FINAL or source refresh was performed by the audit.

## Changed files

- `app/(dashboard)/admin/payroll/PayrollClient.tsx`
- `app/(dashboard)/admin/payroll/PayrollOverviewPreview.tsx`
- `lib/admin-home-payroll.ts`
- `lib/payroll-attendance-refresh.ts`
- `lib/payroll-attendance-source.ts`
- `lib/payroll-attendance-refresh-client.ts`
- `lib/payroll-calculation-engine.ts`
- `lib/payroll-current-read.ts`
- `lib/payroll-daily-calculation.ts`
- `lib/payroll-display-name.ts`
- `lib/payroll-purchase-attendance.ts`
- `tests/payroll-advances-workbook.test.ts`
- `tests/payroll-attendance-source.test.ts`
- `tests/payroll-attendance-refresh-client.test.ts`
- `tests/payroll-purchase-attendance.test.ts`

Code commit: ec04106. No migration, feature-flag change, version allocation or
production deployment. No unrelated dirty tracked files existed or were changed.
