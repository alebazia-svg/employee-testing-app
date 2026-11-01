# Final payroll correction candidate — 2026-11-01

Status: released and independently verified as **1.20.8**, runtime/server commit
`8c4bee8965d71f28e19252f42d11c582005eee4e`. The owner explicitly chose the
combined payroll and tax-limit-panel release. Built 2026-11-01T11:09:37.674Z
(14:09 Moscow).
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
The native Terminal started a detached server job; only portal-app was rebuilt.
Independent public/server/authenticated UI verification precedes registration.

## Verified production outcome

- Public release-info, authenticated payroll and taxes footers agree on 1.20.8,
  built 14:09 Moscow; exact server Git commit was read independently over SSH.
- Authenticated October remains 14 employees, gross 990974.12, advances 17000,
  after advances 973974.12. The final-save confirmation and remark acceptance
  are present. Inspection was cancelled without creating/approving a live run.
- The tax overview displays the approved `ФНС и запас до лимита` block with its
  two scenarios and existing planning reserve. No tax/source document was changed.
- Before/after hashes identical for nine saved runs with all employee calculation
  details and child records; 79 classification rules; 49 supplier rules; two
  Finbox revisions; zero day reviews; one draft revision; ten employee payroll
  settings. server.env hash and every mount field are identical. No migration
  was pending, no Prisma source changed and no 1C publication/write occurred.
- Initial release job stopped after app restart at a strict byte comparison of
  mount arrays. Independent root verification compared every mount field sorted
  by destination and proved the only difference was array order. It then passed
  the full payroll hash comparison, health and metadata checks. No rebuild,
  data repair, relaxed financial guard or rollback was needed for this recovery.
- Public health returned ok. Anonymous employee payroll and ADMIN draft requests
  both returned 401. Actual final correction remains verified in the isolated
  database; production historical finals were deliberately not changed.
- After independent authenticated UI verification the current image was registered.
  Verification job exit 0, service Result=success. Approximately 17 GiB free.
  Current and two verified reserves:
  - 1.20.8: sha256:cee5a79c1086b1c4c87826c58546d87ac9b26b909fde49c6bae75f5a8c39678d
  - 1.20.6: sha256:a7972b5150790124b63f054b69da5a643c89eda936ad7625a7d0dea72ef1ea2e
  - 1.20.5: sha256:c10538c221d9972e5648f58dbaeb77fada41be786b45daae85406037d51311de
- Evidence: /home/bela/payroll-release-1208-verify.log, paired
  /home/bela/payroll-release-1208-before.json and -after.json. Local screenshots:
  /tmp/payroll-final-correction-production-1.20.8.png and
  /tmp/tax-limit-production-1.20.8.png. Physical employee-phone testing was not done.
