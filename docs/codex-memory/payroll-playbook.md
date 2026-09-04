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
