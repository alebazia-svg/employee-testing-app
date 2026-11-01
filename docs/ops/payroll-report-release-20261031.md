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
omitted because only Liana has the existing form/app cutover. No automatic
extension to other staff was authorized. Owner asked separately whether to
extend their unique-date union from October18; awaiting decision. Current
release does not silently change this policy or old approved/final statements.

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
