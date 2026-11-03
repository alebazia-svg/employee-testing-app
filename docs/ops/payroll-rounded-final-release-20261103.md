# Employee FINAL rounding restoration — production 1.21.10, 2026-11-03

Bela reminded that employee salary display must preserve the previously agreed
nearest-100 rounding. Changing the authority from posted 1C accrual to the portal
FINAL had omitted that display precision. Restoring the same approved behavior
is separate from the active-shift repair released as 1.21.9. No new salary
formula or source-authority policy was introduced.

## Exact files and behavior

- `lib/employee-payroll-estimate.ts`: names the existing display rounding in a
  shared pure helper; current-estimate rounding is mathematically unchanged.
- `lib/employee-payroll-read.ts`: uses that helper for the bound FINAL amount and
  passes the rounded display amount into the existing payment reconciliation.
- `tests/employee-payroll-read.test.ts`: covers rounded confirmed payroll,
  verified 1C cash, zero balance, missing evidence and immutable saved amounts.
- `package.json`, `package-lock.json`: aligned 1.21.10 version fields.

Saved FINAL rows, raw compensation calculations, exports, draft/Finbox data,
1C documents, UI layout, employee access and existing payment/identity/month/
overband guards are unchanged. The 1.21.8 arrival-comment UI and 1.21.9 active
ADMIN shift correction are preserved. No production shift or payroll record was
manually changed for verification.

## Verification

36 focused employee-payroll/read/history/view/rounding tests, 79 payroll
regressions, five release metadata tests, TypeScript, production build and diff
whitespace checks passed. Existing workday checks were passed for 1.21.9;
workday runtime files are unchanged by this patch.

Read-only replay of the current source records through the actual private
reader and view validator matched the five live private employee responses after
release. Actual authenticated ADMIN employee preview rendered the rounded total,
verified issued amount and zero remaining balance for a fully matching case.
The partial-payment case also matched its expected rounded remaining amount.
No physical-phone session was exercised.

## Deployment evidence

- Server commit: `e2e91a294810b2b5aabd78dbaebb0247bfff3d9b`.
- Version 1.21.10; builtAt `2026-11-03T14:38:03.684Z` (17:38:03 MSK).
- Image `sha256:ad5fc6ff43faefa769e1171992dc2ada39afe6dd940a8499422ac12a8d781261`.
- Native Terminal launched the reviewed helper; owner entered sudo there.
  Agent monitored continuously and continued without requiring a `готово` reply.
- Exact SSH source, public release/health and authenticated visible UI version
  independently verified before the marker allowed verified-image registration.
- Root job ended `RELEASE_EXIT=0`; portal-app healthy, current image and preceding
  verified 1.21.9/1.21.8 images registered. Final free space approximately20GiB.
- All saved-payroll/configuration hashes, env and mount fields matched before/
  after. Existing current-day record IDs retained. No schema delta/migration.
- Existing approved storage maintenance ran before the build lock, preserving
  current/two verified reserves, containers, volumes and uploads.
- Server log `/home/bela/payroll-release-12110.log`; paired payroll protection
  `payroll-release-12110-before/after.json`; paired day-record evidence
  `workday-release-12110-before/after.json`.

## Remaining data review

Rounding does not assign undocumented payment months or settle discrepancies
between a saved FINAL and the owner's posted 1C total. Those remain explicit
unknown payment/balance states under the unchanged guard. Do not replace a full
month with a day-only 1C accrual, invent zero balances or rewrite immutable FINAL
amounts. Owner questions about already paid 1C amounts require a concrete
source-policy decision before implementing any additional behavior.

Private source snapshots, actual before/after private responses and reproducible
read-only checks remain in ignored `.wip/payroll-display-audit-20261103/` and the
two `.wip/payroll-display-*-20261103.ts` working scripts; not published in Git.
