# Final payroll correction candidate — 2026-11-01

Status: production release explicitly approved; 1.20.8 prepared at
`8c4bee8965d71f28e19252f42d11c582005eee4e`; native Terminal authorization pending.
The owner explicitly chose the combined payroll and tax-limit-panel release.
Owner approved final-save/correct/new-final with history, and explicitly required
no substantial interface change and no formula changes.

## Exact behavior difference

- Existing save confirmation now offers a final save as well as a draft.
- Existing final overview adds `Исправить ведомость`. Corrections use the current
  employee cards, stored inputs and existing calculation engine.
- A new final atomically replaces the previous final through the existing
  FINAL/SUPERSEDED mechanism; the prior amounts/details are never overwritten.
- Exact-final-ID checks protect draft/Finbox editing and final replacement.
  Stale edits are rejected; a lost final success response is safely retryable.
- Starting correction opens an explicitly closed month using the existing ADMIN
  period operation. Until replacement, the previous final remains authoritative.
- Original manual inputs, fixed deductions and premiums seed corrections.
  Advances identified by saved 1C receipt provenance are re-read once; genuine
  manual advances are preserved. No formula changes.
- Existing completeness checks and explicit acceptance of reviewable employee
  remarks remain. No production approvals or invented employee data were saved.
- 1C documents and the employee historical payment/accrual source stay unchanged.
  A portal correction does not post an accounting correction to 1C.

## Exact changed runtime files

- app/(dashboard)/admin/payroll/PayrollClient.tsx
- app/(dashboard)/admin/payroll/PayrollDraftSync.tsx
- app/(dashboard)/admin/payroll/PayrollFinalOverview.tsx
- app/(dashboard)/admin/payroll/PayrollFinboxEditor.tsx
- app/api/admin/payroll/draft/route.ts
- app/api/admin/payroll/finbox/route.ts
- app/api/admin/payroll/runs/[id]/status/route.ts
- lib/payroll-correction.ts
- lib/payroll-draft-store.ts

Tests: tests/payroll-correction.test.ts;
tests/payroll-final-correction.integration.ts. Decision recorded separately in
`docs/codex-memory/decision-log.md`.

## Verification

- Passed: 79 standard payroll tests; 40 focused correction/approval/draft/report/
  private-reader tests; TypeScript; production build; isolated HTTP integration.
  Two competing final replacements were tested: exactly one succeeds and one
  receives 409. Retrying a completed replacement is idempotent.
- Local HTTP integration targets only database
  `payroll_final_correction_20261101` on 127.0.0.1 and local port 3225. It verifies
  auth, final save, exact-final draft/Finbox access, stale-ID rejection, immutable
  old employee details and amounts, atomic replacement, retry and closed-month
  protection. Temporary fixture period 2097-10 is removed after the run.
- Real ADMIN UI on an isolated copy reproduced October gross 990974.12, advances
  17000 and after advances 973974.12 for all 14 employees. First final save
  succeeded. Opening correction preserved those same amounts and advances.
- A test-only Diana lateness correction from empty to zero raised gross by exactly
  the existing 3000 discipline bonus. New final #2: 993974.12 / 17000 / 976974.12;
  old #1 remained 990974.12 / 17000 / 973974.12 and became SUPERSEDED, linked to #2.
  An independent database assertion verified all other 13 employee amounts were
  unchanged and advances remained 17000.
  These are isolated fixtures, not an owner decision about Diana or live payroll.
- Returning to the final without saving left final #2 unchanged. Re-entry restored
  final #2 inputs and totals, including the test lateness correction. A month closed
  after the page loaded was successfully opened by the explicit correction action;
  the final remained unchanged. The final/correction controls were inspected in the
  visible in-app narrow layout. Physical-phone verification and production release
  are outside this local acceptance.
- Owner preview: authenticated local ADMIN at http://127.0.0.1:3225/admin/payroll,
  October selected. Isolated test administrator only. Final screenshot:
  /tmp/payroll-final-correction-owner-preview.png. The original desktop screenshot
  /tmp/payroll-final-correction-final.jpg shows initial final #1 and unchanged totals.

Preview uses a separate copy of the prior local review database, supplemented by
read-only audited October sources and current classification/supplier decisions.
The original review database and production database were not changed. Separate
unrelated changes already released in origin/design-local-updates were merged
before implementation; no unrelated working files were present or reverted.

## Release preparation

Re-read VPS/version rules. Live 1.20.6 / `4432efee` and deployment branch 1.20.7 /
`ace10bd` were independently checked. Integrated the already prepared tax-limit
scenario block after the owner explicitly chose both modules together. Version
1.20.8 is consistent in package.json and both lockfile entries. Passed 79 payroll
tests, 43 focused/tax-limit tests, five release metadata tests, TypeScript and
production build after integration. No Prisma source/migration delta.

Release uses the shared deployment flock, exact origin commit gate, 15-GiB free
space gate and three verified image checks. Before/after checks cover saved
payroll with full child details, classification/supplier rules, Finbox, day
reviews, draft revisions, employee payroll settings, server.env and mounts.
The native Terminal starts a detached server job; only portal-app is rebuilt.
Independent public/server/authenticated UI verification precedes registration.
