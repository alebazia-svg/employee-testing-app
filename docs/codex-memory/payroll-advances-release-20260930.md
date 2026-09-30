# Payroll advances release candidate — 2026-09-30

Status: deployed on 2026-09-30 after explicit owner approval. Code commit:
`3415952`; deployed checkout with preparation documentation: `a4febed`.
Baseline: production `9c5356b8ec225e90a11dddbb49515954bd7e0845` observed during preparation.

Scope: explicit posted 1C advance comments in year-month and month-year forms;
current-month employee cards and preliminary Excel export. Gross salary is
unchanged. Ambiguous payments require review. Saved final calculations are not
modified. Attendance/PWA preparation commit `6989f1f` is deliberately excluded.
No database migration, 1C write or supplier-policy change is included.

Checks: 73 payroll tests passed, TypeScript check passed, production build
passed, diff whitespace check passed. PayrollClient and control-source baseline
are unchanged from the previously previewed candidate's base. Fresh assembled
release rehearsal used the isolated `payroll_auto_preview_20260915` database and
local cash fixture: both date formats appeared in list/card, gross unchanged,
advance subtracted exactly once. August still matched all 13 final employees.

Production build/restart exited 0, checkout is exactly `a4febed`, upload mount
preserved, compiled advances route present. Health, payroll, workday and employee
checks returned 200; unauthenticated advances returned 401. Authenticated live
payroll showed trainee 15,000 and Zukhra 2,000 advances, with document provenance
in the card. Source refreshed through September 30: trainee gross 64,050 and
remaining 49,050; Zukhra gross 67,866.76 and remaining 65,866.76. These remain
preliminary figures, not approved payouts. Live data warnings remain unresolved.
No production payroll save, final replacement, supplier decision or 1C write
was performed. Main-workspace WIP and production `.rollback/` were preserved.

Changed code files:
- `app/(dashboard)/admin/payroll/PayrollClient.tsx`
- `app/api/admin/payroll/advances/route.ts`
- `lib/payroll-one-c-advances.ts`
- `lib/payroll-one-c-control-source.ts`
- `package.json`
- `tests/payroll-advances-workbook.test.ts`
- `tests/payroll-one-c-advances.test.ts`

Supplier settings were verified in the live September page under
“Данные 1С и проверки → Поставщики закупок”. Five undecided suppliers:
MEMS Technology, Glass 111, SupGlass Bella, RST Xiaomi, SmartFolio Diliana.
No inclusion/exclusion decisions were made. September remains preliminary;
supplier, classification, attendance and cost-completion warnings must not be
treated as resolved by the advance release.
