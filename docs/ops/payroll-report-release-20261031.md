# Payroll report release 2026-10-31

## Approved scope and baseline

Owner approved release of the reviewed ADMIN payroll report, clearer cutoff/cost
status, actionable checks, review download, Muhamed inclusion/October advance and
single-M display spelling. Runtime version 1.20.2; code 5b4ad795a92899461af3ebd6ccff91e78f7beb7a.
Deployment target 66a0180ba21711ba252793b67610e09b75461224 adds only the preceding
release verification documentation. Server/public/authenticated UI independently verified; verified-image
registration completed November1 after the overnight SSH connection closed.
Finalize exit0; runtime healthy;19GiB free. Current image
`sha256:e833e60dcc671fa6490571fe065586b55dab9de2d3657d3dc524662db025aacf`;
verified reserves `sha256:c7d7973afaea87792eb72d1980e195ff53a86ccd6b4fc8878102f598db0052cf`
and `sha256:d2ce08b61a64d6352bdaf86458ab93a12e6655a4fe5fe472f48b24df0f0246bc`.

Preserved: accruals/payments tabs, saved statements/history, manual settings,
reserve upload, Finbox, existing financial gates, actual-debt warning, source
error details under “Подробнее”, day-review accounting/access-only safeguards,
and the separately released 1.20.1 compact reminders. No 9% formula change,
Workday/OFD change, schema migration, production manual DB write or 1C write.
Only the approved Muhamed legacy procurement selection is resolved to his
existing daily rule, respecting activation/period constraints. Canonical historical
identity stays unchanged; presentation/Excel use Кумыков Мухамед.

## Local verification

- Payroll suite:79 passed.
- Report/name/presentation/approval/day-review focused suite:34 passed.
- Attendance/Diana/day-review sources suite:27 passed (overlaps other suites).
- Release metadata:5 passed; TypeScript, production build and diff check passed.
- Actual isolated local build1.20.2: cutoff/cost/stale status, ordinary framed
  check button, inline cause/action, review download and Muhamed24000 visible.
- Prior isolated workbook evidence:24000 accrued,7500 October advance,16500 net;
  exact existing RKO00OF-001901,2026-10-16. Name render tests preserve identities.
- Server commit66a0180; public version1.20.2, build2026-10-31T18:09:27.241Z;
  authenticated ADMIN label/cutoff31October/Muhamed24000+7500+16500 verified.
- Real production Excel downloaded and inspected on November1: single-M name,
  24000/7500/16500 on totals/detail and exact RKO00OF-001901 provenance.
- November1 re-entry defaults to November honestly unavailable before source
  import; switching back to October restores the report. No zero salary fallback.
- A transient concurrent attendance-refresh notice cleared on re-entry; the
  remaining issue is Diana's missing lateness input. Normal download/save actions
  enabled. No real FINAL approval, payout or manual financial save used for QA.
- Public health OK;19GiB free; all env/config hashes and mounts unchanged.
- Actual source data can change totals between readbacks; no snapshot was frozen
  or approved as part of this release verification.
- Physical phone usability was not rechecked for this ADMIN-only release.

## Read-only attendance audit

Checked 2026-10-31T18:07:36.740Z, October1–31, employee plus Moscow calendar date.
Both Google readers confirmed live Google Sheets, no demo substitute. Stored
snapshot checked17:16:19.559Z; zero approved financial day-review overlays and no
manual day overrides for the following staff. Fresh independent unique-date
counts agree with the existing calculation/source summaries. App status/date
validation passed. Ordinary repeated arrival/departure marks are not double pay.

| Employee | Google days | Valid app dates | Current payroll days | App-only dates currently omitted |
| --- | ---: | ---: | ---: | --- |
| Чеченова Милана | 16 | 6 | 16 | 26, 27, 28, 29 |
| Кумахова Диана | 0 | 0 | 0 | none |
| Абшаева Зухра | 12 | 8 | 12 | 24, 25, 26, 27, 30, 31 |
| Ахобекова Залина | 11 | 4 | 11 | 26, 27, 28, 31 |
| Костеренко Магомед | 18 | 7 | 18 | 28, 29, 30, 31 |
| Хурзокова Лиана | 13 | 14 | 25 | none |

Liana: Google fallback plus app from the agreed October18 cutoff, unique date
union=25. Her app October16 remains before cutoff and is already in Google.
Diana: no October app starts or working Google schedule cells; source result0,
not an assertion that she did not actually work. PWA editable plan is not pay
attendance. Muhamed remains16 agreed days; Astemir/other fixed or special staff
do not acquire day-based pay from app marks.

Finding:18 app-only dates for Milana(4), Zukhra(6), Zalina(4), Magomed(4) are
omitted because only Liana has the existing form/app cutover. Owner approved their unique-date union from October18 on November1.
The extension was tested locally and subsequently released as1.20.3 below. Version1.20.2 retains its original policy and approved/final statements.
Regression counts on the audited dates: Milana20,Zukhra18,Zalina15,Magomed22.
Tests cover exact identities/Google aliases, duplicate dates, pre-cutover scope,
provenance, payroll inputs and retained manual corrections;29 targeted tests,
79 payroll tests, TypeScript and production build pass. No UI/formula/schema
change is included in this follow-up.

Audit evidence locally: `/tmp/payroll-attendance-production-audit-20261031.json`;
read-only bundled source in the release worktree's ignored `.wip/` directory.
Initial audit exact-name lookup failed on Milana's full Google name; corrected
the audit to the existing alias semantics, reran successfully before deployment.
That failed audit stopped before product checkout/restart and did not mutate DB.

## Exact runtime/test files

- `app/(dashboard)/admin/employees/EmployeesClient.tsx`
- `app/(dashboard)/admin/payroll/PayrollClient.tsx`
- `app/(dashboard)/admin/payroll/PayrollDailyOneCControl.tsx`
- `app/(dashboard)/admin/payroll/PayrollFinalOverview.tsx`
- `app/(dashboard)/admin/payroll/PayrollOverviewPreview.tsx`
- `lib/payroll-calculation-engine.ts`
- `lib/payroll-control-request.ts`
- `lib/payroll-display-name.ts`
- `lib/payroll-employee-rules.ts`
- `lib/payroll-review-presentation.ts`
- `package-lock.json`
- `package.json`
- `tests/payroll-advances-workbook.test.ts`
- `tests/payroll-calculation.test.ts`
- `tests/payroll-display-name.test.ts`
- `tests/payroll-one-c-advances.test.ts`
- `tests/payroll-report-review.test.tsx`
- `tests/payroll-review-presentation.test.ts`

Original preview worktree and its pre-existing/other dirty files were left intact.
Documentation records an actual production release and source-policy audit;
the release note and index are committed separately from runtime code.

## November1 approved union follow-up — pre-release verification

Exact changed code/test files:
- `lib/payroll-attendance-source.ts`: four additional owner-approved exact ID/name
  cutovers from2026-10-18, retaining Google canonical/legacy aliases.
- `tests/payroll-attendance-source.test.ts`: isolated original pilot tests plus
  all-five-employee October date regression, provenance/calculation/manual-input
  safeguards, identity rejection and pre-cutover/lateness preservation.

Only release/audit memory was updated in this note and project-index.md.
At the local verification stage no production deployment, production DB write,
migration, 1C write, saved FINAL approval or financial save was performed. Physical phone/UI
was not retested because the interface is unchanged. Earlier preview worktree's
pre-existing dirty files remain untouched. Subsequently explicitly approved and released as1.20.3; see below.

## Attendance union release1.20.3 — November1, verified complete

Owner explicitly authorized production release and regression verification.
Commit928daa2b4529bf598f5801b302e0f39224c781f1, public version1.20.3,
build2026-11-01T06:23:21.306Z. Running image
`sha256:3e6434ef0fa649a8928389fb527b63458b19b5f89e63c79e7930c4d4bbaad8d7`,
healthy;21GiB free. Code/test files are the two listed above plus package.json
and package-lock.json for synchronized version fields.

All79 payroll,29 attendance/provenance/day-review,56 draft/Finbox/settlement and
5 release tests pass; TypeScript/build/diff checks pass. Before/after hashes
match for all9 saved runs including details/manual inputs/source files/adjustments,
79 classification rules,49 supplier rules,2 Finbox revisions,0 day reviews and
10 employee payroll settings. Entire container env/server.env hashes and mounts
match. No migration, schema change,1C write, financial save/approval or manual DB
edit. October fresh source, stored snapshot and effective payroll inputs agree on
20/18/15/22 after normal source refresh at2026-11-01T09:03:39.445Z.

Past-month UI intentionally serves saved attendance without auto-refresh. The
October cache therefore needs the existing `refreshPayrollAttendance` action
under `withPayrollSourceLock`, preserving FINAL history. The narrow finalization
script completed this refresh and rechecked protected-data hashes: unchanged.
Source-cache persistence used existing application code under its advisory lock,
not manual day/snapshot database edits. Native Terminal exit0; independent public
metadata/server commit/authenticated footer/card and real workbook verified,
then registered the current image and two preceding verified images.

Scheduled storage maintenance's earlier November1 failure was the fail-closed
unregistered1.20.2 guard before morning verification. Registry and all three
reserves were validated, and the approved retention command succeeded before
this build. No broadened cleanup or security changes were made.

Final evidence:
- Actual downloaded `Зарплата_Октябрь_2026 (2).xlsx`: Milana20, Zukhra18,
  Zalina15, Magomed22; Liana25 retained, Muhamed16/24000/7500/16500 retained.
- Working gross990974.12; advances17000; after advances973974.12. Increase10400
  comes only from the18 newly included dates at existing500/600 daily rates.
  Other employee accruals and percentage components remain unchanged.
- ADMIN card shows Milana20×600, dated app/Google provenance and existing advance;
  source cutoff31October and ordinary export/save actions retained. Diana's
  existing missing-lateness question remains. No QA financial approval/save used.
- Protected nine saved runs and settings still byte-equivalent after refresh.
- Verified registry: current3e6434ef, previous e833e60d(1.20.2), c7d7973a(1.20.1),
  full IDs in native log `/tmp/mobo-payroll-union-finalize-1.20.3.log`.
- Screenshot `/tmp/payroll-union-production-1.20.3.jpg`; final read-only audit
  `/tmp/payroll-union-production-final-audit.json`. Physical phone was not retested;
  the existing ADMIN layout and PWA code were not modified. Other worktree dirty
  files remain untouched. Documentation committed separately from runtime.

Documentation commit retained locally while the parallel1.20.4 release script
expects exact origin8cd33dd. Runtime928daa2 is pushed, running and verified; do
not advance that deployment branch with docs until its exact-origin guard passes.
