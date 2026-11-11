# Payroll follow-ups — local candidate, 11 November 2026

RELEASED with explicit owner operations approval: 1.24.8, runtime commit
81c801b46333b1dbc4f356d75923af1b91123597, built 2026-11-11T16:20:53.010Z.
Guarded prebuilt installation completed; public metadata, authenticated shared
version label and server commit independently verified.

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
Production verification is recorded below.
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

Code commit: ec04106. No migration or feature-flag change. Version/deployment completed as above. No unrelated dirty tracked files existed or were changed.

## Production verification completed

- Installed image sha256:55ea34ee056f5faf8060a190aaf6dc5b91b137eacabb7d4657b10a03d3dc5fa7.
- All 10 saved runs / 136 employee results and identity, classification and
  supplier-rule hashes matched before, after install and after normal source sync.
- Standard automatic source service completed: November sales and attendance
  updated through 10 November; October skipped. No FINAL was saved for testing.
- Real ADMIN: Astemir 6 × 600 = 3,600; purchase percentage 36,593.54;
  top-up 59,806.46; total 100,000. Busy status visibly disappeared automatically,
  leaving only the actual Diana Finbox warning. Diana remark and 8,720.51 retained.
- Actual Excel downloaded and parsed: Astemir days 6, gross 100,000;
  Timur presentation 16,464; manager days Zukhra8/Zalina9/Liana7/Milana6/Magomed6.
  Browser download-event listener timed out, but native download files were
  independently found and parsed successfully. No physical phone check performed.
- Screenshot: /tmp/payroll-1.24.8-verified.jpg. Source refresh and original
  payroll tests passed; no separate employee rounding change was included.
- Verified registry contains current 1.24.8 and preceding verified 1.24.7/1.24.6;
  all three images exist. Finish log reports RELEASE_FULLY_VERIFIED, free space19G.
- Capacity recovery archived only three unused old build node_modules folders
  before removal. Durable verified archives and manifest are retained at
  /Users/bela/Projects/portal-release-archives/20261111-server-build-dependencies/.
  Exact known unused 1.24.4 image was removed outside protected current+2.
  Containers, volumes, backups, uploads, environment and migrations untouched.
- Canonical merge 27f8051 was not deployed because it includes unrelated pending
  changes. Runtime is exact 81c801b. Unrelated work was preserved.
