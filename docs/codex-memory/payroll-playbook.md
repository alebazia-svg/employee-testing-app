# Payroll Playbook

## Current Principle

Payroll formulas already exist and are covered by tests. Do not rewrite payroll
logic casually. Keep fixes targeted and run payroll tests.

## Important Files

- `app/(dashboard)/admin/payroll/page.tsx`
- `tests/payroll-calculation.test.ts`
- `app/api/admin/payroll/*`
- `prisma/schema.prisma`

## Standard Checks

For payroll changes:

```powershell
npm run test:payroll
npx tsc --noEmit
npm run build
```

## Known Employee Rules

The following names should never be included in payroll calculations:

- Keshtova Aslan / Keshtov Aslan variants
- Keshtova Amir / Keshtov Amir variants
- Atabieva Muslim / Atabiev Muslim variants

Magomed Kosterenko and the historical trainee retail account are the same
person for payroll aggregation. Existing code/tests include multiple spelling
variants such as Kostorenko/Kosterenko/Kostenko/Kostanko/Kostarenko.

Future direction:

- the generic trainee account may be reused for future employees;
- permanent employee identity should not rely only on display name matching;
- a stable alias/identity mapping model would be safer than more string cases.

Before adding another name case, check whether it should be a temporary alias or
part of a future explicit identity mapping. Do not let the reusable trainee
account permanently merge with future unrelated trainees.

## UI Direction

### Production — August 2026 rules

- Bela keeps the existing 12% employee base, with a gross-pay floor of RUB
  100,000 starting in `2026-08`; advances are subtracted afterwards.
- One-time awards are added after regular calculations and minimum guarantees,
  excluded from Bela's base, and saved as existing `PayrollAdjustment` records.
  Saved history is immutable; no Prisma migration or 1C write is part of this work.
- Owner approved one entry point: `Дни, авансы и премии`. Each employee expands
  to show their manual inputs, bonus amounts/reasons and final payout. Do not
  reintroduce a separate bonus tab. Preserve nonzero legacy fixed-pay bonuses
  visibly in the same editor; do not silently migrate or double-count them.
- The initial August awards are drafts only (Astemir 20,000; Zalina 15,000;
  Liana 5,000). They must not recur automatically in later months.
- New snapshots from August require the current compensation contract. Validate
  detail components and premium reasons as well as totals; retain legacy July
  save compatibility and existing history reads.
- Owner approved the UI and release. Deployed on 2026-09-04 as `fc7f41c`
  on top of production `d5cd3d0`; only five payroll code/test files changed.
  The release also restores Bela's detail opening without personal sales rows.
- Verification: 32 isolated-release payroll tests, TypeScript and build passed;
  1,700 differential scenarios preserve other formulas and pre-August Bela.
  Live local detail open/close/re-entry passed. Production container is healthy,
  expected bundle markers are present, and no pending migrations were applied.
  Existing saved runs were not recalculated; production payroll saves were not
  performed for testing. 1C synchronization remains outside this release.

The audit/review block is meant for review workflows, not the final payroll
summary. Avoid mixing "quick product review" into the main summary if it makes
the pay result harder to understand.

## Data Caveats

### Finbox manual import — released, 2026-09-04

- Owner approved the real local Finbox form inside Diana's card under
  `Дни, авансы и премии`; no separate tab. API investigation is deferred.
- Pasted TSV/Markdown is checked against opening/closing balances and the
  selected payroll month. Only explicit confirmation replaces Diana's existing
  `agentCreditCommission` draft; repeat imports do not accumulate. Transfers
  and balances are not earnings or employee advances. Raw text is not stored;
  the existing payroll save flow persists the confirmed manual amount.
- Owner's August example reconciles to RUB 85,373.06 (14 nonzero accruals),
  with RUB 92,875 transferred. No production manual value was overwritten.
- Local live UI verified empty input, one-kopeck balance mismatch, cancel,
  re-entry, confirmation and repeated import. Other payouts stayed unchanged
  in this fixture; Bela's existing 12% base changed as expected while her floor
  kept the payout at RUB 100,000. Narrow-screen layout was visually reviewed.
- After explicit owner release approval, deployed isolated code commit
  `25091b6` from `2e3250d`: only five Finbox code/test files. The local 1C
  adapter compatibility fix and unrelated WIP were excluded. All 53 release
  tests, TypeScript and build passed; formulas/classification are byte-identical
  to production `fc7f41c`. Schema, migrations and payroll APIs are unchanged.
- Deploy exit 0, server commit, upload mount and new bundle confirmed. Preflight
  found all 50 migrations applied. Health and payroll/workday/employee route
  smoke checks returned 200. Production UI verified preview RUB 85,373.06 and
  cancel without changing the agency draft; browser console had no errors.
  Saved August run 6 remains CHECKED / RUB 915,129.55. No production payroll
  save, approval or Finbox application was performed for testing.
- Finbox API, daily 1C payroll refresh, supplier selection and 1C writes remain
  separate phases; this release does not activate them.

### Daily payroll — read-only preflight started, 2026-09-04

- After Finbox deployment, owner asked to start the next step. Current scope
  is the previously described ADMIN-only control stage, not activation of a
  daily production payroll job, a schema change or a new 1C write workflow.
  PWA pilot priorities and attendance-source policy are unchanged.
- Existing `one-c-preview` route now has 27 local regression tests covering
  authentication refusal before source I/O, invalid/future periods, Moscow
  midnight, leap/year boundaries, quality flags and failed reads without
  partial totals. Even clean data remains `readyForPayroll: false` and
  `affectsPayroll: false`. No runtime code changed in this preflight.
- Live read for September 1-4 at approximately 20:13 Moscow: 2,082 movements,
  3 pages, contract `payroll-sales-facts-v2`, `periodComplete: false`.
  Adapter output: 1,107 groups / 7 sales managers. Duplicate source keys,
  invalid monetary identities, out-of-period rows and missing required
  manager/customer/product/product-kind fields were all zero.
- There are 363 movements needing cost review (17.4%) and 3 with pending cost
  (0.14%); these flags can overlap. 46 cost-review movements are services, so
  zero cost is not itself proof of error. 179 are cases/covers and 4 are
  smartphones. Inspect salary-component dependence on cost before clearing
  warnings or claiming the daily pay is complete. Do not drop service earnings
  or accept all zero-cost goods automatically.
- Read-only source evidence, reproducible JS/SQL profile and packaged report:
  `/tmp/offonika-payroll-daily-preflight.7U1mQ2/`. These are local temporary
  artifacts, not production records. HTML packaging passed structural checks;
  browser verification was unavailable in the report builder.
- Remaining gates: cost-dependent component review; fixed approved supplier
  scope and individual purchase-document exceptions for Astemir; identical
  existing formulas/rules in a control calculation; explicit distinction
  between month-to-date earnings and full-month fixed/minimum guarantees;
  separate last-good snapshots with stale/error handling and repeat-run safety.
  No scheduler, employee earnings screen, production payroll save or approval
  was added. Finbox remains a manually refreshed input.
- Checks: 127 local payroll/source/preview/Finbox tests and TypeScript passed.
  This tests-only step did not rerun the production build or deploy anything.

### Daily payroll — local 1C control screen, 2026-09-04

- Owner approved the next safe local stage: a real ADMIN payroll control block,
  read-only 1C data after successful evening month-close/cost calculation, and
  an explicit supplier scope for Astemir. Production activation, payroll saves,
  formula changes, 1C writes, commit and deploy remain excluded pending visual
  approval and supplier decisions.
- The local screen reads the most recently verified closed day automatically on
  page open. Before today's close it may use only yesterday's verified close;
  it never includes the currently unclosed day. Failed refreshes retain only a
  last-good result for the same payroll period and label it as previous data.
  Late responses from another selected month are ignored.
- August supplier reconciliation is exact: 21 approved suppliers produce RUB
  5,446,712.52 from `/supplier-settlements`, matching the accepted purchase
  Excel to the kopeck. The 19 other August suppliers intentionally absent from
  that workbook are seeded as excluded. Supplier matching normalizes only case
  and whitespace; it does not use fuzzy matching.
- New supplier movements are never included automatically. On 2026-09-04 the
  owner approved both new September suppliers for Astemir: `Kuzoom Lucy`
  (RUB 85,052.80) and `Техноуспех` (RUB 84,160.00). Both rules were saved only
  in the isolated local demo database; production was not changed. The local
  September 1-4 purchase base is now RUB 814,225.83 (RUB 14,248.95 at 1.75%)
  and the screen reports `Список проверен`.
- Important attribution limit: `/supplier-settlements` is an aggregated debt
  movement register by supplier. It does not prove that Astemir created each
  underlying purchase document. Supplier approval reproduces the accepted
  August workbook scope, but document-level author/responsible attribution must
  be added and reconciled before this source can affect the payroll formula.
- Owner approved the isolated read-only 1C attribution-source implementation
  and its publication. Package
  `AIAgentAPI-v0.15.374-payroll-purchase-attribution-2026-09-05` is published on
  Yandex Disk and defines `/payroll-purchase-attribution`: posted non-deleted
  purchase receipts joined exactly to supplier-settlement movements by
  registrar, with author, manager, supplier, organization, currencies,
  document amount and debt increase. The owner installed the package and the
  production `/version` exactly matches Yandex Disk. A focused August read
  returned 39 Astemir-authored documents across all 21 approved suppliers;
  author and manager matched in every row, there were no ambiguous or
  non-approved-supplier rows, and both debt increase and document amount
  reconciled exactly to RUB 5,446,712.52. The endpoint still declares
  `affects_payroll=false` and has not changed the portal formula. Connecting it
  to payroll remains a separate approved change.
- Owner approved connecting the attribution endpoint to the local ADMIN control
  screen. The local daily-control route now accepts only documents whose exact
  1C author and manager refs both match Astemir; identity mismatches are excluded
  and surfaced as blocking review, other employees' documents are ignored, and
  incomplete/write-capable/payroll-affecting source responses fail closed. A
  focused live September 1-4 read selected seven Astemir documents, ignored six
  other documents, found zero identity-review documents and reproduced the
  already approved RUB 814,225.83 base with zero new suppliers. This remains
  control-only: no payroll formula/save or production portal
  deploy was performed. The current default local database has a long unrelated
  migration backlog, so no migrations were applied merely for browser QA.
- The screen exposes source sales totals and the approved purchase base only;
  it does not yet replace Excel in the payroll formula or save a payroll run.
  Cost flags are kept visible. Formula-dependent warnings must be cleared in
  the next control-calculation stage before any result can be called a verified
  salary amount.
- Local validation: current close at 04.09.2026 21:34:46, 2,436 sales facts,
  seven managers; August 19,901 facts, eight managers. Supplier safety tests,
  the 45 payroll regression tests, TypeScript and production build passed. The
  actual authenticated local screen was checked on a narrow viewport. No
  production migration, payroll save, 1C write or deploy was performed.
- Final authenticated browser QA used an isolated database
  `employee_testing_payroll_preview_20260905` and the real local ADMIN screen.
  August rendered the verified close through 31.08.2026, RUB 16,025,679.68
  revenue, RUB 4,056,611.76 gross profit and Astemir's exact RUB 5,446,712.52
  purchase base (39 matching documents; 45 other-employee documents ignored).
  Two browser-only failures were corrected: incompatible old local cache data
  is rejected through a versioned key/contract check, and storage-quota failure
  no longer hides a successful live response because only a compact sales
  summary is cached. Payroll formula/save behavior remains disconnected.
- The empty demo database could not replay the repository's full migration
  chain: migration `20260830143000_terminal_fiscal_review_responses` expects a
  missing `TerminalFiscalReviewParticipant` table. Demo setup therefore used
  `prisma db push`; this is not a production migration method. Repairing and
  rehearsing a fresh-database bootstrap is separate from the payroll release:
  do not rename or edit these already-applied historical migrations. Before a
  production snapshot release, verify through `prisma migrate status` that both
  the 14:30 and 17:30 migrations are successfully recorded; if they are, only
  the new supplier-rule and snapshot migrations are pending. A clean-install
  baseline can be designed later without rewriting production history.
- Owner approved and local-only implementation now stores ADMIN control data in
  `PayrollOneCControlSnapshot`; it remains disconnected from payroll formulas,
  runs and 1C writes. The page first reads the stored server result, then
  automatically refreshes missing days plus the latest three closed days. A
  manual refresh rereads the selected range. Once a month is past, the first
  read stores one full `FINAL` reconciliation and later automatic page opens do
  not reread that month. Malformed JSON, mixed source contracts and any partial
  source response fail closed; writes are atomic and content hashes/revisions
  distinguish actual source changes from a new check time.
- Isolated authenticated browser QA stored August as one final reconciliation
  and September 1-4 as four daily snapshots. August repeated GET/POST completed
  in about 20 ms instead of the original roughly one-minute 19,901-row read.
  September repeated refresh reread only 2-4 September in about 6.5 seconds;
  1 September stayed untouched. Aggregates remained exact: August revenue RUB
  16,025,679.68, gross profit RUB 4,056,611.76 and Astemir purchase base RUB
  5,446,712.52; September revenue RUB 2,072,381.27, gross profit RUB 507,594.56
  and purchase base RUB 814,225.83. The screen labels server storage, stored
  through date and final reconciliation clearly. No scheduler independent of
  page opening, production migration or deploy has been performed.
- After owner approval, clean code commit `9ce22a4` was created on
  `codex/payroll-one-c-snapshots` directly from production base `eebd6f1`.
  It contains only the ADMIN control screen, read-only 1C readers, exact
  Astemir supplier/author scope, two payroll schema migrations and focused
  tests. The clean candidate passed 53 focused source/snapshot tests, all 34
  production payroll regressions, TypeScript, build and authenticated browser
  QA against the isolated demo database. It has not been pushed or deployed.

### Direct 1C source — local shadow only, 2026-09-04

- Owner approved adapting the unfinished portal reader and comparing August
  Excel with live 1C, not deployment, formula changes, 1C writes or PVA work.
- Live release was `v0.15.373`; `/payroll-sales-report` returns 404 and
  `/payroll-sales-facts` returns `payroll-sales-facts-v2`. The report wrapper
  now uses that reader with `report_cost` / `report_gross_profit`, strict
  incomplete-read/duplicate/cursor guards and propagated costing flags.
- Preview remains ADMIN-only, `affectsPayroll: false`, `readyForPayroll: false`.
  It is not connected to the normal calculation UI or saved payroll runs.
- August read: 19,901 facts / 20 pages. Revenue agrees with Excel for every
  manager; cost differs by RUB 225,612.84. 74 facts carry pending-cost flags.
  Do not infer that the Excel or the API is wrong until report semantics and
  accounting revision timing are reconciled.
- The accepted sales workbook groups by `Номенклатура.Вид номенклатуры`, not
  `Товарная категория`. Preserve this distinction in any new source contract.
- Purchase Excel F10 is RUB 5,446,712.52; the full August supplier-settlements
  read returns RUB 14,051,139.24 debt increase (97 rows, not limited). They are
  not approved interchangeable salary inputs. Do not substitute purchase
  document totals or all supplier debt movements without a defined scope.
- Offline comparison reuses actual parser/formulas via
  `scripts/payroll-shadow-compare.ts`. It compares source-driven components,
  not final payouts: manual inputs, saved rule overrides and approved snapshots
  are not loaded. Bela's final salary is not validated by this comparison.
- Checks: 36 payroll regressions, 15 dedicated v2 source tests, TypeScript,
  build and diff checks passed. Test 1C `/version` returned 401.
- Owner's subsequent architecture question is analysis only: recommend
  source-independent salary inputs and server-side calculation as a future
  approved step, not a mandate to rewrite formulas or migrate payroll now.
- Dedicated report packaging could not validate the non-SQL comparison-code
  provenance; do not invent a SQL query. Evidence remains in the local
  `/tmp/offonika-payroll-reconcile-sep04/` comparison and source files.

- Payroll source reports can contain manager names that do not match portal user
  names exactly.
- Attendance/month period bugs can appear around month boundaries; make sure the
  selected payroll period drives day counting, not today's month.
- Keep salary formulas and manual adjustments separate from 1C data-source work.

## Before Changing Payroll

Ask:

- Is this formula logic, identity/name matching, source parsing, UI/audit, or
  period selection?
- Does it affect historical runs or only the current import?
- Is the payroll period driving the attendance days, not today's calendar month?
- Are excluded employees still excluded in all summary/audit views?
- Do tests cover the behavior?
