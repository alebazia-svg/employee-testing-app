# Payroll advances release candidate — 2026-09-30

Status: prepared locally, not pushed or deployed. Code commit: `3415952`.
Baseline: production `9c5356b8ec225e90a11dddbb49515954bd7e0845` observed during preparation.

Scope: explicit posted 1C advance comments in year-month and month-year forms;
current-month employee cards and preliminary Excel export. Gross salary is
unchanged. Ambiguous payments require review. Saved final calculations are not
modified. Attendance/PWA preparation commit `6989f1f` is deliberately excluded.
No database migration, 1C write or supplier-policy change is included.

Checks: 73 payroll tests passed, TypeScript check passed, production build
passed, diff whitespace check passed. PayrollClient and control-source baseline
are unchanged from the previously previewed candidate's base. A fresh end-to-end
visual rehearsal of this assembled release has not been repeated; production
post-deploy checks remain outstanding. Recheck production HEAD before release.

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
