# Automatic current-month employee estimate — released 1.21.16

Owner approved deployment after reviewing this candidate. Released and verified
as `17e115dc6852ce6c34e30d80bdf9afdcbc24efd6` / 1.21.16. Normal source service
updated November sales and attendance without a draft; private projections for
all five managers passed rounding checks and existing access conditions. Real
ADMIN/employee preview and October re-entry verified. Final evidence and the
additional PWA-only refresh guard repair:
`../ops/payroll-automatic-month-release-20261103.md`.

Owner explicitly approved showing and automatically updating November estimates
in the employee app, retaining established October rounding, formulas and UI.
This changes the old per-month first-draft confirmation prerequisite, rather
than rewriting any compensation rule or pretending an ADMIN confirmed inputs.

Exact runtime files:
- `lib/payroll-draft.ts`: current Moscow month may use transient blank inputs,
  revision 0. Existing saved payload/revision wins without mutation. Past/future
  months without saved inputs stay unavailable.
- `lib/payroll-current-store.ts`: supplies that current-month input to the same
  verified-source private calculator. Reads never create an ADMIN draft.
- `lib/payroll-source-sync-store.ts`: existing hourly sync includes the current
  month without a draft/period record; FINAL/CLOSED remain excluded. Previous
  month retains the old saved-input gate. No timer or scheduling change.

Exact test files:
- `tests/payroll-automatic-month.test.ts`
- `tests/payroll-current-read.test.ts`
- `tests/payroll-current-store.integration.test.ts`
- `tests/payroll-source-sync.integration.test.ts`

47 focused tests, 79 payroll regressions, two real PostgreSQL integration tests,
TypeScript, production build and whitespace checks passed. Tests cover Moscow
month/year rollover, blank-input provenance, source-refresh eligibility, real
store read without creating revisions, existing corrections and bonuses,
changed attendance reaching the private rounded response, missing/incomplete
sources, private identity and FINAL/CLOSED exclusion. No UI files were changed.
Physical phones remain untested. Production checks are recorded in the release
evidence above. The already configured schedule access condition still asks for
tomorrow's calendar when required.

QA used newly created local `payroll_automatic_month_20261103`, never production.
Older QA database schema lacked qrScanMode; fresh migration replay also hit the
pre-existing migration-order dependency at
`20260830143000_terminal_fiscal_review_responses`. No historical migrations were
edited. The new isolated QA database alone was synchronized to the current
Prisma schema for the passing integration runs. Existing data and production
schema were left intact. No production snapshot, payroll, draft, setting or 1C
document was changed by this task. Logs: `/tmp/payroll-automatic-month-*.log`.

The release followed owner operations approval, a fresh live/deployment version
check, new patch version and source/UI/retention verification per runbook.
