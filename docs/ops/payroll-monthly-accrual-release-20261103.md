# Employee monthly accrual — production 1.21.7, 2026-11-03

Owner approved full monthly accrual from the portal's active FINAL statement,
payments from 1C, without changing salary formulas or UI. She then explicitly
approved production release with preservation of existing settings.

## Released scope and exact files

- `lib/employee-payroll-read.ts`: bound FINAL grossPay is authoritative; a payment
  source outage retains the full monthly accrual with unknown payment fields.
- `lib/employee-payroll-history.ts`: the existing personal settlement projection
  can reconcile verified 1C payments/prior credit against the FINAL amount.
- `lib/employee-payroll-response.ts`: passes that exact FINAL amount to settlement.
- `tests/employee-payroll-read.test.ts`
- `tests/employee-payroll-history.test.ts`
- `package.json`, `package-lock.json`: aligned patch version 1.21.7.

No UI, compensation formula, employee self-selection, payroll snapshot, schema,
production data, 1C document or other business module was changed. Full accrual
no longer depends on whether 1C has posted days only or the complete month.
Existing strict identity, payment-month, prior-credit and overpayment guards
remain. No final statement retains the existing availability/estimate policy.

## Reconciliation and local checks

Started from payroll candidate based on 1.20.8; merged latest deployment branch
through `b97e3b3` (1.21.6), preserving all intervening modules. The only merge
conflict was the append-only decision log; both decisions were retained.
Version was chosen after a fresh origin fetch and live 1.21.6 metadata read.
Runtime diff against the live baseline changes only the three payroll helpers
and the version metadata; no workday change is included.

32 employee payroll/read/history/view tests, 79 payroll regressions and five
release metadata tests passed; TypeScript, production build and whitespace
checks passed after reconciliation.

## Production evidence

- Server commit: `fb96ab7ca8ba98a0277e89092420d9b402fb15d4`.
- Public release: 1.21.7; builtAt `2026-11-03T11:19:27.557Z` (14:19:27 MSK).
- Runtime image: `sha256:b500b9226497ce91492ee0fa5701a906f44efa420a04511854f180759d9096fe`.
- Root release job completed `RELEASE_EXIT=0`, healthy portal-app; current and
  two preceding verified images registered after independent verification.
- Independent SSH source, public release metadata, health and authenticated
  ADMIN visible footer verified. Unauthenticated personal payroll API: 401.
- SHA-256 before/after equality verified for all 10 saved runs including children,
  79 classifier rules, 49 supplier rules, two Finbox revisions, zero day reviews,
  one draft revision and 10 employee payroll settings. `server.env` and every
  mount field unchanged (mount array sorted by Destination for comparison).
- Production schema status was up to date before rebuild (79 migrations);
  no schema/migration delta was included or applied.
- Initial disk free 23 GiB, post-release 18 GiB. No storage cleanup performed.
- Native Terminal launched the reviewed script; owner entered sudo there.
  Logs: `/home/bela/payroll-release-1217.log`; paired protection evidence:
  `/home/bela/payroll-release-1217-before.json` and `-after.json`.

## Actual employee check and financial limitation

Sanctioned ADMIN preview of Zukhra and read-only FINAL run 13 verified:
portal FINAL grossPay 98,961.78883000002, displayed 98,961.79 RUB.
Before release the employee view displayed 99,000 RUB from 1C; after release it
correctly displays the FINAL amount with the existing UI/layout.

1C payments are 99,000 RUB, exceeding that FINAL by 38.21 RUB. The unchanged
overband/reconciliation guard therefore leaves paid/remaining as `Проверяется`;
no false zero, rounding adjustment or payroll rewrite was invented. This actual
source discrepancy was disclosed to Bela. Changing that guard or the approved
salary amount requires a separate owner decision. Physical phones were not tested.

The separately approved ADMIN shift correction is only a local candidate in
`codex/admin-shift-correction-20261103`, documented in
`admin-shift-repair-20261103.md`. No production shift was changed by this release.
