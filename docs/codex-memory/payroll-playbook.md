# Payroll Playbook

## Production release 1.6.0 — 2026-10-18

- Owner explicitly approved commit and production deploy. Runtime commit
  96e5211bf3d8ec3c23580e5c2a616299ccdfe6a2 published to design-local-updates.
- Server commit independently read back; public metadata and authenticated ADMIN
  footer show 1.6.0, build 2026-10-18T16:57:22.120Z (19:57 Moscow).
  Deploy exited 0; portal-app running, uploads mount retained. No migrations,
  1C writes, or final-run rewrites. Auth-free settlement request returns 401.
- Previous image sha256:8dac64592d5ea3d10638523c84b73053c9444148320d80fd9b822c873c4f2e31
  preserved as portal-app:rollback-before-1.6.0. Replacement image
  sha256:6d87c39c6c24f916df32463091d5679a0c7028096ee983c84fcf261679b1c58c.
  No schema delta, so image rollback remains schema-compatible.
- Live October accrual shows Muhammad 24,000 and payments show his 7,500 advance.
  Known remaining issue: accrual advance parser still warns on mixed RKO 1802,
  while settlement allocation handles it. Do not claim all advance warnings fixed.
  Diana October inputs remain missing. Both are distinct from deployment success.
- Below local-only entries describe the historical preparation phase, superseded
  by this deployment status; further corrections require a new release version.

## Release audit — 2026-10-18, no commit/deployment

- Local candidate remains on deployment base 4730e96; refreshed deployment branch
  and public metadata both remain 1.5.10. No new release version allocated yet.
- Payroll checks: 199 client-compatible tests and 48 server-condition tests,
  TypeScript, production build and five release-info tests pass. Settlement GET
  without authentication returns 401. No Prisma/schema/env changes in candidate.
- September calculation XLSX reviewed: 13 employees, gross 1,032,621.91,
  advances 35,000, after advances 997,621.91; no Asad or all-period debt.
  Saved final's original 17,000 advances remain historical, not overwritten.
  Mobile 390px overview/payment/modal review completed; October fixture accruals
  are not a complete production reconciliation. November Muhammad rule is tested
  in calculation tests, not future live 1C data.
- Owner approved and production UI saved Hoco Китай in Astemir's supplier base
  and six exact disputed phone/Dyson products as retail accessory / wholesale
  included goods. Product review count became zero. No 1C documents or final
  payroll runs were changed. Muhammad rule and settlement UI remain local only.
- October Diana days/lateness/Finbox are unresolved source inputs, not silently
  zeroed. September Diana lateness remark was already explicitly approved on
  2026-10-16; do not present it as a new blocker.

## Muhammad agreed monthly days — local change, 2026-10-18

- Owner replaced attendance/manual-day entry for Muhammad Kumykov, Astemir's
  assistant: October 2026 has 16 agreed days × 1,500 = 24,000 RUB for the whole
  month; November onward has 20 × 1,500 = 30,000 until changed by the owner.
- This is a monthly agreed amount, not earned-to-date attendance. Existing
  advances remain separate (7,500 confirmed October advance); no duplicate
  deduction or additional procurement/discipline percentage. Stale browser day
  inputs do not override this rule. Historical saved runs retain their days.
- Server draft-day persistence is no longer needed for this employee. No schema
  migration, production data write or deployment is part of this local change.

## Main-route integration — local only, 2026-10-18

- Owner approved local integration, not commit/deployment. Worktree was fast-forwarded
  to deployment branch `4730e96` (1.5.10), retaining payroll WIP and other modules.
- `/admin/payroll` now enables the live workspace; settlement GET is admin-only
  without the preview feature gate. Preview routes remain gated. Test environment
  labels are separate from workspace enablement and retained in isolated QA.
- Isolated `payroll_approval_qa_20261016` schema was synchronized without data-loss
  acceptance to the current branch schema; production DB and 1C were untouched.
- Browser verified ordinary-route September final/October working calculations
  and October payment 7,500 for Muhammad. October accrual fixtures remain test data.
- 246 payroll tests, TypeScript and build pass; unauthenticated settlement GET
  returns 401. Browser download event timed out, but the page confirmed success
  and the new September XLSX was found in Downloads; ZIP integrity passed.
  Workbook contents, full production-data reconciliation and responsive review
  on the updated application base remain release prerequisites.

## Owner-approved Excel purpose — 2026-10-18, supersedes settlement export

- Owner explicitly replaced the earlier requirement that Excel mirror live unpaid
  balances. The workspace workbook is a calculation statement for the selected
  earning month: employee, calculated gross, month-attributed advances, after
  advances. Ordinary salary payouts and accumulated debt stay in the portal.
- Preserve accrual components, days, rates, bonuses and deductions in the detail
  sheet. If deductions exist, disclose that the after-advance amount also subtracts
  them. Never call this amount the current remaining debt or a payout instruction.
- Remove the all-period debt sheet from this workspace export. Keep department
  colors and compact employee rows. Existing approved salary snapshots are not
  rewritten. This change is local only; production release is not approved here.

## Owner-approved oldest-debt allocation — 2026-10-18, local only

- Owner also confirmed August premiums in 1C movement 00OF-000123 dated
  2026-09-01: Astemir 42,500; Zalina 10,000; Liana 10,000 RUB. Local posted-accrual
  parsing binds only exact document/line, employee, organization, date, amount and
  unchanged comment. These premiums belong to August, never September. Changed
  facts or other unnamed premiums remain unresolved. No 1C document is rewritten.

- For Bela Keshtova only, cash issuances without a stated payroll month first
  settle the oldest outstanding salary. An explicit advance month takes priority.
- Preserve 1C documents and all-period balance. Opening debt is an unnamed older
  bucket, not invented individual months. Accrual months require document comments;
  unknown movements, missing cash evidence or balance mismatch fail closed.
- Shared monthly result feeds the employee card, payments and current Excel export.
  This local implementation is not a production release. September residual must
  remain separate from the full accumulated salary debt.

## Current Principle

Payroll formulas already exist and are covered by tests. Do not rewrite payroll
logic casually. Keep fixes targeted and run payroll tests.

## Owner requirement — payroll clarity and completeness (2026-10-18)

- Treat payroll as an operational control screen for the owner and a manager
  who visits only once a month. Both must understand who earned what, what was
  paid, what remains payable, when money was issued and why amounts arise.
- Never remove useful information to make a redesign look cleaner. Compare
  the actual production screen with the candidate before approval: inventory
  totals, employee-level advances/deductions, formulas, warnings, actions and
  history; explicitly account for anything moved, hidden or removed.
- Keep useful accrual and advance summaries visible in Accruals, with employee
  department grouping and original detailed calculation cards. Payments must
  clearly expose issued amounts, dates, advances and confirmed unpaid balances.
  Overview plus drill-down is purposeful, not unnecessary duplication.
- Show actual errors, missing data and unresolved allocations prominently,
  with the affected employee/document and a clear action or 1C correction.
  Do not hide them behind generic technical labels or convert unavailable
  evidence into zero. Distinguish unresolved issues from accepted remarks.
- Preserve month attribution and source meaning: issue date is not earning
  month; advances count once; rounded 1C settlement is authoritative. Never
  label an all-month debt as the selected-month balance or invent debt from
  the difference between unrounded portal calculation and 1C settlement.
- Keep details accessible without technical noise, tautologies or repeated
  month labels. Employee month cards show that month's assigned payments,
  including later issue dates, not unrelated months' document history.
- Release gate: verify calculations, source reconciliation, error/recovery
  states and UI information completeness against the previous real screen.
  Aesthetic ratings are not evidence of correctness. Report remaining gaps;
  do not claim an error-free or release-ready result while known gaps remain.


### Acceptance checkpoint — 2026-10-18

- Owner clarified that downloading the selected month's workbook must show
  current settlements, not historical payments frozen with the final run.
  The local workspace export now refreshes 1C before export, preserves approved
  accrual formulas, excludes inactive zero-result employees using the overview's
  period rule, and shows current paid/advances alongside zero only when 1C
  confirms a settled balance (no debt and no credit). Positive all-month debt
  remains separate; unknown monthly amounts are explicit, never inferred from
  unrounded accrual minus cash. Failed refresh blocks stale export. Original
  saved records are unchanged. This remains gated local functionality.

- Local build/typecheck and payroll regression checks passed. Historical settlement
  reads now extend through today, not merely the next month; attribution remains
  conservative. Planned first/sixteenth columns match exact dates in the month
  after the earning month, so late first-day payments use Other days.
- Reproduced an expired local session, distinguished authorization failure from
  unavailable 1C, and verified recovery after login. September Payments loaded
  807,800 assigned issuances including 35,000 advances, with 208,300 all-period
  balance shown separately. An unresolved Bela issuance is not silently assigned.
- Candidate is still local, not released. October accrual fixtures are not live
  salary; production branch reconciliation and a full workbook content audit
  remain release checks. Do not describe this checkpoint as complete acceptance.

### Local workspace integration — in progress, 2026-10-16

- Owner approved connecting the reviewed settlement UI to existing payroll reads,
  without releasing it yet. `workspace-preview` is ADMIN-only and gated by
  `PAYROLL_SETTLEMENT_PREVIEW=1`. Unlike `settlement-preview`, it does not receive
  the fixed September demonstration payment rows or local JSON evidence.
- Current Moscow month is the initial selection in this candidate, including
  days 1–7. Existing production default is unchanged until release approval.
- Existing automatic calculation stays active for unapproved available periods.
  An exact period/id/status-matched final run is displayed independently of 1C
  refresh; comparison is separate and never replaces saved final values.
- Full payment history and outstanding salary balance are NOT integrated yet.
  A validated read adapter for the existing `/payroll-balance` endpoint is now
  prepared locally (`payroll-one-c-balances.ts` and the control-source reader).
  It checks complete/unfiltered scope, organization/person identity, duplicates,
  kopecks and totals. Only a confirmed identity may resolve an absent row in the
  complete balance register to zero; missing reads/identity remain unknown.
  Tested against read-only live responses for August 31, September 30 and October
  16. On October 17, added the gated ADMIN settlement read route and the employee
  Payments-tab binding in `workspace-preview`: validated cash documents, unique
  conservative identity matching, all-period balance with its date, and explicit
  unallocated payroll month. Partial/mixed advance comments never allocate the
  entire RKO. Five-minute in-process cache and in-flight deduplication avoid
  per-card source reads. No schema, production data or 1C writes.
  On October 18 the card header and payments tab share one read, with explicit
  cash-date window and all-period 1C balance. Refresh occurs on opening, focus and
  every five visible minutes. A local allowlist proxy permits GET only for the
  two payroll endpoints; other integration reads and all writes are denied.
  Live Milana card verified: October 1 payment 12,500 plus October 16 payment
  76,500 = 89,000; balance as of October 18 is zero. Accruals remain isolated QA
  values and are labeled as such. Employee rows show concrete missing-days or
  lateness reasons, while advance source uncertainty remains a shared message.
  Monthly payment attribution remains unfinished; this is not release-ready.
  Production advances alone cannot establish total payments or salary debt.
  Missing settlement values must remain unavailable, never zero. The owner's
  rounded accruals and zero balance in 1C are authoritative for settlement;
  differences from portal calculations must not generate a new debt or warning.
- Central employee modal, unchanged formulas, separate payments tab and stable
  dialog dimensions are approved visually. This candidate still needs live-data
  integration verification and payment reconciliation before release.

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

Owner decision 2026-10-16: the film trainee's 70% service-only rule continues
from September 2026 until the owner explicitly changes it, not September only.
The continuation updates directory, sales mapping, advance matching
and saved-detail validation together. The historical payroll identity with
`(09.2026)` is retained for compatibility; June's Magomed assignment and saved
final runs remain unchanged. Included in approved release 1.4.15 (`ce2d22d`);
deployment verification is recorded below.

### Compact payroll overview — release 1.4.15, 2026-10-16

- Owner approved compact month/year, status and export/save actions in one
  header; removed duplicate period title and employee search. Totals use smaller
  typography. Employee groups precede the review button and expandable checks.
  Review/open/back behavior remains available; approval restrictions unchanged.
- Advances are still labeled advances, not all salary payments. Full 1C
  settlement reconciliation and a date-based payout list remain analysis only.
  No saved runs, production day inputs, 1C documents or database schema changed.
- 75 payroll tests, five release metadata tests, TypeScript and production build
  passed. Local browser verified the approved overview and review/back flow.
  Isolated QA data were not included in the release.
- Production deploy exited 0. Exact server commit
  `ce2d22d76d8c5236ab113d6c7c1b521a639ea7d6`, both public domains and authenticated
  ADMIN footer confirm 1.4.15, built `2026-10-16T10:51:53.223Z` (13:51 MSK).
  Health returned ok. October overview and trainee card verified read-only:
  service-only 70%, 3,640 RUB on source coverage through October 5, not October 16.
  Muhammad still needs actual days entered in production; QA days not copied.
- Previous image `sha256:36ce2370402c5dd544bb761afd1e3f5886325e078f0520f7a20e912b76e24fb6`
  retained as `portal-app:rollback-before-1.4.15`; replacement
  `sha256:73fbca54e8daa4adee071582d53bfb8cb35fb5110557d3ef6ee9cce880a13f58`.
  Upload/planning/read-only bank mounts retained; no migration, schema-compatible
  rollback. No payroll save/finalization or 1C write during verification.

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

### Replacing a final payroll run — released, 2026-09-05

- An administrator can replace the final run for an open payroll period. The
  confirmation compares the current and proposed final payouts; it never
  recalculates employee results.
- Replacement is atomic: the selected run becomes `FINAL`, the previous final
  becomes `SUPERSEDED`, and the database keeps the acting administrator,
  timestamp and replacement-run link. A partial unique index guarantees no more
  than one `FINAL` run per period, including under concurrent requests.
- Closed periods remain protected and require their existing separate reopen
  workflow. A superseded run cannot be promoted through the ordinary status
  endpoint, so financial history stays immutable.
- Released as portal commit `ae3f2c3` with migration
  `20260905183000_add_payroll_run_final_replacement`. The 37 payroll tests,
  TypeScript, production build, migration rehearsal and isolated browser flow
  passed. Production routes are healthy and the authenticated payroll screen
  loads without browser errors.
- Production August state after release: run 3 / ID 7 is the sole final at RUB
  935,129.55; run 1 / ID 4 is retained as superseded by run 3. Payroll formulas,
  employee results and source data were not changed by this release.

### Management workbook and employee report rules — committed, not released, 2026-09-05

- Owner approved the management Excel layout and committed it as `f7d22ac` on
  `codex/payroll-ux-language`. It has not been deployed and its migration has not
  been applied to production.
- The main sheet shows gross pay beside each employee, then days, fixed/day pay,
  percentage components, discipline, awards/Finbox, already-paid advances and
  the remaining payout. Employees are grouped as Purchasing, Wholesale Sales,
  Retail Sales, Operations Management and Fixed Salary, with descending gross
  pay inside each group.
- The detail sheet is collapsed by employee by default. Excel outline level 1
  shows employee totals; level 2 expands every component. Expanded rows show the
  actual source base, rate, result and a final arithmetic tie to gross pay.
  Advances are informational and reduce only the remaining payout; they are not
  review errors.
- Saved runs export through the same workbook generator and retain their saved
  report group. New active employees without a configured salary rule remain
  visible under `Требует настройки` with zero gross pay instead of being omitted
  or assigned a formula by name inference.
- Employee salary rule, report group, fixed salary and effective period are
  administered from the employee record. Migration
  `20260905214500_add_payroll_employee_report_group` backfills current approved
  employees and snapshots the report group on payroll results.
- Verification before commit: 48 payroll tests, TypeScript, Prisma validation,
  production build, workbook formula scan and visual review of all four sheets
  passed. The approved August preview reconciled each employee's gross and net
  totals across Summary and Detail.
- The proposed retail accessory tier (5% normally, 7% when team accessory sales
  exceed RUB 1,000,000) is explicitly excluded from this commit. It requires a
  separate approved formula task, effective-date decision and historical-run
  handling.

### Retail accessory team tier — released, 2026-09-06

- Owner approved the separate formula change effective from `2026-08`: the
  retail accessory rate is 5% while the eligible team base is at or below RUB
  1,000,000 and 7% when the base is strictly above RUB 1,000,000. The selected
  rate applies to each eligible employee's entire personal accessory base, not
  only to the amount above the threshold. Returns remain in the calculation and
  reduce the team and personal bases.
- Eligibility follows the versioned employee salary rule
  `retail_sales_bonus`, not a hard-coded list of names. Diana is included while
  that rule applies to her: only her actual personal accessory sales accrue the
  bonus, her sales contribute to the retail team threshold and Finbox agency
  earnings stay a separate component. Portal account activity and payroll
  activity are separate: an inactive portal account with an explicit current
  salary rule participates only when the selected source report contains actual
  sales for that employee; without report activity it remains absent.
- The portal shows one team-level threshold/rate explanation and the employee
  detail shows personal base x actual rate. Current and saved workbook exports
  use the same actual-rate explanation; the management summary remains compact.
  Saved source metadata records the team base, threshold, selected rate and
  eligible employee set.
- New August-and-later snapshots fail validation if their accessory component
  uses a rate inconsistent with the team base. Existing final/superseded runs
  remain immutable and are not silently recalculated; a changed historical
  result must be saved through the existing versioned replacement workflow.
- The main formula was committed as `27c905c`. Production verification exposed
  that Diana's inactive portal login removed her otherwise-current salary rule
  from the calculation. The targeted correction `b299f3d` now separates portal
  login activity from source-backed payroll activity; its regression test keeps
  inactive/no-sales and expired-rule employees excluded.
- Final production checkout `4636530` includes the correction and its memory
  update. The additive employee/report-group migration applied successfully;
  health, payroll and workday routes return 200. All 53 payroll tests,
  TypeScript, production build and authenticated production browser QA passed
  with no browser errors. The owner's August upload selected 7% from the final
  eligible team base of RUB 1,186,055 and showed Diana's RUB 103,089 personal
  base as RUB 7,216.23. No payroll run or manual input was saved during QA.

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
- On 2026-09-09, after the owner reconfirmed the supplier scope, `Kuzoom Lucy`
  and `Техноуспех` were saved in production as active `admin-decision` rules
  with administrator audit. Future verified 1C snapshots include them in
  Astemir's purchase base; no other supplier decisions were changed.
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
  Before release, production had advanced to `b3ff042`, so the same isolated
  code was replayed without conflicts as `5617b34` and released with its
  documentation as production commit `09ffd77` on 2026-09-05. This preserved
  the intervening workday fixes instead of rolling production back.
- The release contains only the ADMIN control screen, read-only 1C readers,
  exact Astemir supplier/author scope, two payroll schema migrations and
  focused tests. All 34 payroll regressions, 53 focused source/snapshot tests,
  Prisma validation, TypeScript and production build passed. Both migrations
  applied successfully; production now records 52 migrations, `portal-app` is
  healthy, uploads remain mounted and payroll/workday/employee routes return
  200.
- Authenticated production QA created the first immutable August FINAL control
  snapshot and reproduced the accepted values: revenue RUB 16,025,679.68,
  gross profit RUB 4,056,611.76, Astemir purchase base RUB 5,446,712.52, 39
  exact Astemir documents and 45 other-employee documents excluded. Existing
  saved payroll runs remained unchanged and browser error logs were empty.
  The control source is still disconnected from payroll formulas, payroll run
  saves and 1C writes.

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

### Fixed accessory rate and concise payroll notes — approved, 2026-09-06

- After review with Aslan, the owner approved a fixed 5% accessory rate for all
  eligible retail employees, including Diana. The former 7% rate above a RUB
  1,000,000 team base remains dormant behind an explicit disabled switch; the
  portal and workbook still show the team base and threshold for context, but
  crossing it does not change the calculation.
- The new version applies only to newly calculated and saved payroll. Existing
  final runs remain immutable until the administrator deliberately recalculates
  and replaces one through the audited final-replacement workflow.
- The main workbook note now contains only exceptional management information:
  one-time premiums with amount and reason, positive lateness counts, actual
  deductions or manual corrections, and actionable review warnings. Routine
  formulas, zero lateness, advances and minimum-salary top-ups are shown in
  their dedicated columns or detail rows instead of being repeated as notes.
- Code commit `b7bbd4c` and documentation commit `1df27fa` were released to
  production on 2026-09-06. No migration or database write was required; the
  health endpoint and payroll, workday and employee routes returned 200, and
  authenticated browser QA reported no console errors.
- Existing final August run 5 was created before this release and therefore
  still records its historical 7% accessory components. The release did not
  rewrite it; the administrator must deliberately recalculate and replace it
  to create a new final run with the fixed 5% rule.

### Aggregated 1C control view — released, 2026-09-09

- Production browser QA showed that the current client-side background refresh
  was insufficient: after a cold page open, September could remain empty for
  more than 69 seconds, and August also waited while the server rebuilt the
  detailed control response from source snapshots.
- Owner approved a server-side aggregate view. It uses the existing
  `PayrollOneCControlSnapshot` table with separate `AGGREGATE_DAILY` and
  `AGGREGATE_FINAL` kinds; no migration, formula change, payroll-run write or
  1C write is involved. Daily and final source snapshots remain the source of
  truth.
- A successful refresh writes the source snapshots and aggregate atomically.
  A failed refresh keeps the previous valid aggregate. The cache is scoped by
  payroll period and source kind, validates the full response shape and becomes
  invalid when supplier decisions change. Missing or invalid aggregates are
  rebuilt from the source snapshots without hiding an otherwise valid response
  if only cache warming fails.
- Code commit `2944410` and documentation commit `3a7c0ac` were released after
  rebasing on the newer procurement commit; production checkout and the four
  basic routes were verified. In the isolated authenticated
  ADMIN screen, the first rebuild from eight September daily snapshots showed
  employees in about 1.1 seconds and created one 277 KB aggregate row; a full
  repeat page open showed them in about 0.36 seconds. When the background 1C
  refresh failed, the last saved employee list remained visible.
- Verification: all 59 payroll regressions, 64 focused 1C/control tests, the
  aggregate-cache tests, TypeScript and the production build passed.
- Production validation found one September `AGGREGATE_DAILY` row with 2,332
  sales groups and 11 supplier rows. Its period, source kind, response shape and
  supplier-rule fingerprint are valid; the 1.39 MB JSON row was read and parsed
  inside the container in about 159 ms. The first production warm-up still took
  about 106 seconds, and later full screen opens remained slow even though the
  aggregate itself was valid. One additional wait was outside this aggregate:
  the current preliminary payroll calculation also waited for the separate live
  Google Sheets attendance/schedule preview. Do not misdiagnose either wait as
  repeated 1C source reads.
- The owner approved that next performance stage. Normalized attendance and
  schedule summaries are stored per payroll period in a dedicated
  `PayrollAttendanceSnapshot`. The payroll screen reads this last-good snapshot
  first and refreshes Google Sheets in a separate background request. A failed
  refresh never overwrites or clears saved days/lateness, and the screen shows
  when the source was last checked. Raw Google Sheets rows are not stored.
  This snapshot is an adapter boundary: the current Google Sheets reader can be
  replaced by PWA attendance later without changing payroll formulas or the
  normalized payload consumed by the calculation.
- This implementation adds a database migration, so its production release
  must run `prisma migrate deploy` before rebuilding `portal-app`. In isolated
  browser QA, a repeat September screen open showed the employee list from the
  saved attendance snapshot in about 0.4 seconds. With Google Sheets
  deliberately disabled, the saved list and calculation remained visible and
  were labeled as previous data.
- The attendance snapshot was released in production at portal commit
  `492cf39` after rebasing over the procurement calendar release. Migration
  `20260909170000_add_payroll_attendance_snapshots` was applied before the
  running container was replaced. Production returned the stored September
  attendance response (about 1 KB) in roughly 0.54 seconds and displayed its
  freshness. The complete employee screen can still take tens of seconds on a
  cold browser because the otherwise valid server-side 1C aggregate is sent as
  one roughly 1.2 MB JSON response. The next performance decision should split
  the compact employee payroll summary from detailed 1C rows and load details
  only when requested; this is independent of the attendance source and was not
  included in the approved attendance release.

### Compact payroll projection — local implementation, 2026-09-10

- The owner approved removing the remaining cold-screen bottleneck without
  changing formulas, 1C data, supplier rules, attendance, PWA or saved final
  runs. The stored full 1C aggregate remains the audit source of truth.
- The default daily-control response now derives a compact server-side payroll
  projection from the full stored aggregate with the same classification
  function used by the manual/client calculation. It contains manager component
  totals, wholesale totals, control counts and costing/review counts, but no
  detailed product rows. `view=full` remains available for authenticated audit
  detail and never performs another 1C source read.
- The main payroll screen calculates its employee rows from the compact
  projection. Detailed 1C rows are fetched only after an administrator opens an
  employee card; a detail failure does not hide the already calculated salary.
- On the isolated real September snapshot, the response fell from 1,392,797
  bytes and 2,332 sales rows to 8,347 bytes (99.4% smaller). The new and prior
  screens showed identical amounts for all 13 employees. A repeated compact
  screen open displayed the employee list in about 0.4 seconds.
- This stage has no schema migration and is not yet released. Production remains
  on the earlier payroll runtime until a separate visual and deploy approval.

### Past working periods — production fix, 2026-10-01

- Owner approved isolated commit/deploy `f1ee421` for month-rollover visibility.
  Past months do not require a final payroll run to display the working result.
  The source GET prefers FINAL data and falls back to stored DAILY data only
  when FINAL is absent; actual coverage and non-final status are preserved.
- Historical attendance uses its stored period snapshot. Final payroll runs,
  formulas and 1C documents are unchanged; no migrations were deployed.
- Production deploy exited 0 and health returned `ok: true`. Browser verification
  showed September as `Не утверждён`, with source through September 30 and
  advances visible. August still matched all 13 employees, gross 940,129.55 RUB,
  with final run 6 payout 915,129.55 RUB. Existing September source warnings
  remain unresolved; this release does not certify its calculation as final.
- Verification: 94 payroll/source tests, TypeScript, local and server builds.
  The unfinished review-preview UI and unrelated dirty work were excluded.

### Compact overview and actionable product review — released, 2026-10-01

- Owner approved and production deployed `8d4d23b`, preserving the newer
  procurement release. The real automatic payroll overview shows compact team
  groups, gross amounts, nonzero advances/deductions and employee details, with
  one page scrollbar. Source settings, saved runs and actionable review remain
  available without displaying all technical information on entry.
- Product review loads stored full rows on demand, groups identical products
  by category and sale context, supports filtered bulk selection and confirms
  component changes before using the existing classification-rule API. Rules
  apply across working periods; saved runs are not rewritten. Conflicting exact
  rules stop writes; partial failures report confirmed progress and require a
  refreshed review. No production classification writes were made during QA.
- No formula change, migration, fixture deployment or 1C write. Local isolated
  demo rules were not copied. Dismissed-employee lifecycle remains a separate
  unfinished task; this release does not silently hide zero-pay employees.
- Final production checkout is `99eeba9`: a post-deploy narrow-panel check
  revealed summary amount overlap. The summary now uses three columns only
  from 1100px viewport width; narrow panels stack amounts. The corrective
  build/deploy exited 0, health passed and the actual narrow production screen
  was visually rechecked with no overlapping amounts.
- Verification: 73 payroll tests plus six review tests, TypeScript and local /
  server production builds passed. Deploy exit 0, health OK, uploads volume
  retained, expected bundle present. Authenticated production September shows
  14 employees, advances 17,000 RUB and 54 unresolved rows grouped into 22
  product/context entries; Diana's missing inputs remain visible.
- Overview totals sum displayed rounded employee amounts: September gross
  885,528.06 RUB, net 868,528.06 RUB. This can differ by one kopek from the old
  aggregate-before-rounding total. August overview likewise shows 940,129.56 /
  915,129.56; saved final run 6 remains unchanged at 915,129.55 RUB. Do not
  interpret this display-rounding difference as a changed saved payroll run.

### Server-backed Finbox input — released, 2026-10-01

- Owner approved persistent Finbox entry in Diana's automatic payroll card and
  the required schema change. The default period is the visible payroll month;
  month/year can be selected explicitly. Do not infer it from the latest final
  run. Existing Finbox paste validation rejects dates from another month.
- `PayrollFinboxRevision` stores append-only cents, period, revision, actor and
  timestamp. ADMIN-only GET/PUT uses expected-revision checks and period locks.
  No raw Finbox report or 1C write is stored/performed. Existing final/closed
  periods cannot be rewritten through this input; GET shows saved final input
  when available. Historical corrections use the existing replacement workflow.
- Automatic preliminary payroll consumes the saved server value, not the
  browser-only Finbox draft. Missing source reads remain visible and block its
  export. The old manually uploaded workbook editor remains unchanged in this
  scoped stage; its drafts are not automatically migrated to the new table.
- Additive migration `20261001160000_add_payroll_finbox_revisions` was rehearsed
  in local `payroll_auto_preview_20260915` using its exact SQL. Local QA saved
  100 RUB, verified exact
  employee/total increase and reload persistence, then saved 0 RUB; a stale
  second browser was refused. These local test revisions must never be copied
  to production. August final input remained protected; unauthenticated GET
  returned 401.
- Owner approved commit and deployment. Production is on `a1fdd97`; the above
  migration applied successfully, portal-app rebuilt/restarted and health passed.
  The production revision table was verified empty after release: no local test
  values were copied. Authenticated read-only browser QA confirmed September's
  editable empty input and August's saved final 85,373 RUB input, locked against
  replacement through this form. No production Finbox amounts were written.
- Verification: 73 payroll tests plus 12 Finbox/review tests, TypeScript, Prisma
  schema validation and local/server builds passed. Upload mounts were retained.
  Local preview configuration and unrelated dirty work were excluded.

## Before Changing Payroll

### Settlement integration — local candidate, 2026-10-18 (not released)

- Worktree: `payroll-approval-notes`. Dependencies are now an isolated local
  installation, not the main checkout's node_modules symlink. Prisma client was
  generated locally; no schema change or production migration occurred.
- ADMIN preview reads live cash, current balances and the new complete ledger
  through GET-only integration. It checks opening + movements = closing per
  organization/employee and fails closed on incomplete/duplicate evidence.
  Missing reads/identities must never become zero balances.
- Workspace has actual connected Accruals/Payments tabs and the original
  calculation modal. A copied September final is loaded only in the isolated
  QA database; October accrual fixtures are still synthetic. Do not describe
  the whole local screen as live production payroll. Saved amounts/formulas
  are not recomputed by payment refresh; empty departed rows are hidden in the
  overview, without rewriting saved history or the historical export.
- Owner's existing 1st/16th calendar assigns those ordinary cash payments to
  the previous month for established employees only. Explicit advance months
  take precedence. Other dates and unclear comments remain unresolved.
  Calendar assignment is a portal policy, NOT a native payroll-month field in
  the 1C register. All-month balance remains independently sourced from 1C.
- Confirmed historical split: Zalina, 00OF-001802, 2026-10-01, 23,000 RUB =
  10,000 days + 13,000 advance, both September. One payment is counted once;
  changed document facts require review. Muhammad's 7,500 RUB issuance on
  2026-10-16, 00OF-001901 is an October advance, not September salary.
- Confirmed directory labels `Татьяна` and `СтажерЗакупка` map conservatively to
  Daudova Tatyana and Kumykov Muhammad (the latter from October), retaining
  reference/ownership ambiguity checks. No general fuzzy name matching.
- Expanded live July 1–Oct 18 reconciliation on Oct 18 verified 173 ledger
  movements and all 88 cash rows, with opening/movement/closing equality and
  no recipient conflicts. Owner agreed to continue after reviewing the result.
  Three exact historical allocations are now local rules: Astemir Sep 3
  30,000 and Zalina Sep 13 3,000 belong to August; Marat Oct 7 10,000 belongs
  to September. Match exact source row/ref/recipient/date/amount and blank
  comments; changed evidence returns to review, explicit month takes priority.
  These are reviewed historical allocations, not native 1C month fields or a
  new automatic date heuristic. Bela Sep 2 80,000 remains unallocated across
  older debt. Her authoritative total debt is 208,300; do not force that whole
  debt into September or call the 80,000 an advance for the current month.
- Follow-up verification: 75 base + 36 settlement tests and build pass. Live
  cash read leaves only Bela's old-debt issuance and Asad's historical fine
  issuance unallocated in Sep–Oct. Rebuilt isolated UI verified Marat's
  September card: paid 10,000, zero remaining, Oct 7 document assigned to
  September with reconciliation explanation. Production remains unchanged.
- Production portal has advanced beyond this checkout's 1.4.15 baseline.
  Before release reconcile the latest deployment branch and version, preserve
  other modules and perform the ordinary release gate. No portal deploy or
  production data write was performed in this local integration stage.
- Verification: 75 base payroll tests + 31 settlement/ledger regressions,
  TypeScript, production build and diff whitespace checks passed. Local UI
  verified September/October switching, original saved formulas, payment-tab
  entry/re-entry, Zalina 13,000 advance / 129,000 monthly paid / zero 1C debt,
  Muhammad 7,500 October advance, and 390px modal bounds (no page overflow).
  September XLSX downloaded through the visible button and ZIP integrity
  passed; workbook contents were not re-audited in this stage. Unauthorized
  settlement API returned 401. A fresh interactive outage rehearsal now passed:
  read-only 1C proxy returned 503, the UI showed unavailable payments rather
  than zero balances, and refresh recovered after the proxy was restored.
- Final local UX pass: all 13 September employees visible in compact department
  columns; original formula card retained; selected-month payments first,
  other-month documents collapsed; payment table becomes labeled cards at 390px.
  75 base + 36 settlement tests, TypeScript, build and diff checks passed.
  September export downloaded again and ZIP integrity passed (not a full
  workbook re-audit). Preview warning remains because October accrual fixtures
  are synthetic. Current deployment-branch reconciliation remains a release
  prerequisite; this is not a production readiness or deployment claim.

### Procurement trainee and final export — released 1.4.14, 2026-10-16

- Owner approved adding Кумыков Мухаммед, procurement trainee starting
  2026-10-12, at 1,500 RUB per actually worked day. Owner confirmed work through
  October 16 (five days / 7,500 RUB); payment was planned, not confirmed paid.
- Candidate introduces `purchase_daily`, grouped with procurement, with no
  sales percentage, minimum guarantee or discipline bonus. It extends the
  existing payroll directory and manual day inputs, without creating a portal
  login or a 1C account. Day count is not hardcoded and future weekdays are not
  automatically paid. Manual drafts remain browser-local until a payroll run
  is saved through the existing workflow; this is NOT a server-persisted daily
  attendance ledger. Do not imply otherwise to the owner.
- No unverified `Стажёр закупки` 1C alias is configured. Future advance matching
  requires the actual confirmed recipient; a planned payment is not an advance.
- Asad's default rule ends with August 2026. Empty departed rows from saved
  comparison baselines no longer resurrect him; non-zero historical amounts
  remain visible. Saved/final payroll snapshots are not rewritten.
- Main overview export uses the matching final snapshot when one exists,
  independently of current-source warnings. Preliminary export retains its
  prior validation. Local QA verified the final download, September exclusion
  and October day-entry calculation. 75 payroll tests, TypeScript and build pass.
- Owner approved release. Runtime commit
  `632e5fcdf94e217be6587693ebb72c01297a9ee0` deployed with exit 0;
  public metadata and authenticated UI show 1.4.14, built
  `2026-10-16T09:57:28.582Z` (12:57 MSK). Server commit independently verified.
  Five release metadata tests, 75 payroll tests, TypeScript and build passed.
- Authenticated production QA: Muhammad appears in October with days awaiting
  entry (local five-day draft was not copied); Asad absent from September main
  overview; top final export returns successful download of saved run 1.
  Download contents were not independently re-audited. Existing saved finals
  retain their historical rows. Production employee/day/payment data unchanged.
- Previous image `sha256:0facb076296e41a206e8fc0911ffdf1a0e6459f17f5cba5d999780b4a22a340d`
  retained as `portal-app:rollback-before-1.4.14`; replacement
  `sha256:36ce2370402c5dd544bb761afd1e3f5886325e078f0520f7a20e912b76e24fb6`.
  No migrations or 1C writes; schema-compatible rollback. Upload, planning and
  read-only bank-cabinet mounts retained. Public payroll route returns 200.

### Approval with accepted employee remarks — released, 2026-10-16

- Owner approved an administrator decision for missing lateness: Diana's
  September discipline bonus remains zero, without inventing a lateness count.
- Local candidate permits explicitly selected missing-lateness remarks with a
  required reason during first FINAL approval. It stores issue text, reason,
  administrator ID and timestamp in sourceSummary.approvalAcceptance atomically
  with the status change. It preserves original issues and all amounts.
- This is an explicit allow-list, not a generic bypass. Unknown issues,
  incomplete coverage and cost/source errors remain blocking. Replacement of
  an existing final with accepted remarks is not enabled by this UI change.
- Owner approved the shown interface and production release 1.4.13. Runtime
  commit c3b09338eb0adfa01af402e52a95a5b352b11cd2 was deployed successfully;
  server HEAD, public metadata (2026-10-16T08:15:47.755Z), authenticated footer
  and the production confirmation dialog were verified. Dialog was cancelled;
  no production payroll run was saved or finalized. Production September run 1 has
  trainee advance 15,000 RUB; the current working calculation has 20,000 RUB.
  Gross totals match. Do not silently finalize the older payout amount.
- Verification: 73 payroll regressions and 8 approval tests passed; TypeScript
  and build passed. Isolated localhost QA with synthetic period 2091-09 verified
  server refusal without acceptance, required checkbox/comment, successful
  FINAL and readback of the unchanged amount plus persisted decision audit.
- Previous image: sha256:8a3f025ef52c30d8b260fab09ad66978c0857790b13813b10df88ce7409c3406,
  retained as portal-app:rollback-before-1.4.13. Replacement image:
  sha256:0facb076296e41a206e8fc0911ffdf1a0e6459f17f5cba5d999780b4a22a340d.
  Upload/runtime mounts preserved; no schema or migration change, so rollback
  remains schema-compatible. Docker metadata omits revision (existing build
  behavior); exact commit verified separately over SSH.

### Automatic run save/approval — released, 2026-10-03

- Owner approved saving the automatic 1C result through existing versioned runs
  and then explicitly approving a final version. Code commit `1872c08` is based
  on `a592db7`, preserving the intervening procurement release. No migration,
  formula change, 1C write or production payroll save is part of this release.
- New `automatic-1c-v1` snapshots preserve full detail, employee inputs, Finbox
  revision and applied advances. Incomplete month coverage, source warnings and
  employee review items block FINAL. Legacy runs keep their existing workflow.
  New automatic header totals sum displayed employee cents; underlying raw
  component validation and historical saved sums are unchanged.
- Local verification: 73 payroll regressions, six approval/rounding tests,
  TypeScript and clean release build passed. Actual browser save/read captured
  14 employees and 66 detail rows; cancel/re-entry and reload did not duplicate
  advances. UI final approval passed only on synthetic QA period 2091-09.
  Incomplete local September was correctly refused. Atomic replacement has
  isolated API coverage. Local data/account/fixture configuration are excluded.
- Owner returned and entered sudo in Terminal on the restarted deployment.
  Production is now `1872c08`: DEPLOY_EXIT=0, portal-app started, upload and
  planning mounts retained, health `ok: true`. Payroll/workday/employee route
  probes returned 200; unauthenticated periods API returned 401.
- Authenticated production UI preparation/cancel passed without saving or
  approving a payroll run. September source covers 30.09.2026, 14 employees,
  gross 1,032,621.91 RUB, advances 17,000 RUB and net 1,015,621.91 RUB. The same
  amounts appeared in the confirmation. Diana's missing lateness remains an
  explicit approval blocker; no value was invented or entered during QA.

Ask:

- Is this formula logic, identity/name matching, source parsing, UI/audit, or
  period selection?
- Does it affect historical runs or only the current import?
- Is the payroll period driving the attendance days, not today's calendar month?
- Are excluded employees still excluded in all summary/audit views?
- Do tests cover the behavior?
