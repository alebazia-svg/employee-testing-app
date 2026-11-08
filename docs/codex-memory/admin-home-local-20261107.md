# Approved ADMIN Home — local implementation, 2026-11-07

## Owner approval and boundary

Bela approved the final source-backed desktop Home preview and explicitly asked
for implementation with section links and automatic updates, verified locally
before any production publication. Current project phase remains the general
employee pilot from 2026-10-24. This task does not authorize deployment, a
production migration, manual production data changes, financial operations,
messages or changes to the underlying payroll/tax/workday rules.

The approved layout prioritizes current actions and upcoming payments, then a
dated documentary tax reconciliation, team execution and financial results.
Role wording is administrator. Historical tax evidence is never labelled as
today's applicable regime limit. Unknown financial totals remain unknown.

## Implementation contract

- `/admin` uses the existing AdminShell, identity and inbox bell. Read-only Home
  sections are served by independently ADMIN-authorized `/api/admin/home` GETs.
- Workday uses the same attendance, schedule and timing policies as Control Day.
  Pending permissions on open days are actions; approved permissions themselves
  are not employee errors. Reading an inbox event does not close an operation.
  Active cash-posting failures and unsubmitted handovers use the existing pilot
  boundary and handover-review policy, including administrator acknowledgments
  and permitted closure exceptions. Pre-pilot test history is not promoted.
- Payments use persisted supplier plans, identity-checked payment evidence and
  the existing receipt policy. Expenses use the existing list projection.
- Tax evidence uses the same verified management-review loader and total
  calculation as Taxes; no independent cap or income arithmetic is introduced.
- Current payroll uses persisted sources and the shared daily calculation
  engine. Saved working runs are explicitly dated fallbacks. Unsaved browser
  changes are not an alternative source. Payment summary extraction is shared
  by Home and the existing payroll view without changing its formulas.
- Financial-source reads reuse the procurement source reader. Manager cash
  balances are accounting evidence, not a computed free cash budget.
- Financial results link to the selected final period. Source type, date,
  provisional amounts and unavailable totals remain distinct.
- Every response is private/no-store; a failed source returns 503, not a
  fabricated zero. Successful sections remain usable during another outage.
- Visible-page refresh: workday, payments, taxes, payroll, analytics and service
  every minute; funding every two minutes; settlements every five minutes.
  Focus, pageshow, online, visibility resume and remount trigger refreshes.
  Hidden pages pause reads; concurrent duplicate requests are suppressed.
  Last successful same-Moscow-day data survives a failed refresh with its date
  and an explicit warning. Auth loss clears all displayed financial data.
- Payment links use the existing focused calendar dialog; payroll links accept
  the requested period and payments tab. No parallel detail workflow is added.

## Local environment

Separate worktree `codex/admin-home-live-20261107`, based on maintained release
branch commit `dbf01fb`. Main checkout's unrelated WIP is not part of this task.
Loopback-only Next app: `127.0.0.1:3193`; isolated PostgreSQL on port 55491;
read-only fixture service on port 3194. Local launch/seed/check scripts are in
ignored `.wip/`, not release files. No production integration credentials are
inherited. The database contains a labelled local copy of selected November 7
sources and test-only login credentials; it is not a continuously updated
production replica. The second stage below supersedes the initially reconstructed
tax archive and observation-only November payroll run.

## Verification

- TypeScript and optimized build passed in the isolated worktree.
- Home route/policy tests: authorization before reads, strict source allowlist,
  private no-store responses, safe error handling, unknown amounts, rollover
  and bounded first-screen priority.
- Existing payroll suite: 79 tests passed after pure summary extraction.
- Real Next/PostgreSQL checks: ADMIN/EMPLOYEE/anonymous access, observed financial
  totals, completed-task state change, supplier approval change and unchanged
  workflow/notification/document counts across Home reads.
- Browser verification passed: a local checklist completion disappeared during
  periodic refresh without clicking Update; a funding outage retained 98,904 RUB
  with its last successful date and warning; restoring the source removed the
  warning. The checklist fixture was restored after the check.
- Glass 111 opened its existing focused procurement dialog. The payroll link
  opened November 2026 with Payments selected. Opening details did not approve
  a payment or mark an operational task completed.
- Desktop and 390px mobile layouts were inspected. The normal shared shell,
  account controls, navigation and notification bell are preserved. Temporary
  viewport overrides are reset for delivery.
- Home/policy and existing handover-review tests: 13 passed. Related team,
  receipt-policy and payment-summary/export tests: 9 passed. Payroll: 79 passed.

The first stage deliberately left settlements unavailable to test failure behavior.
The second stage uses captured real settlement evidence. Physical production
refresh latency for the new Home, a full live replica and a real Moscow midnight
transition remain untested. Local time can generate later shift-deadline questions
from copied attendance; local source copies are explicitly labelled.

## Second stage: approved source verification, November 7

Owner said to proceed after the assessment that working-source validation was
the remaining stage. Scope remains the approved Home and local verification;
publication and financial/source-system writes are excluded. Existing authorized
ADMIN browser reads verified production 1.21.45 / build 12:41 MSK. SSH closed the
connection before commands ran; normal authenticated portal reads supplied the
evidence. No new credentials, security exemptions, deploy or source refresh POST
was used. Normal portal viewing retains its usual access telemetry/cache behavior.

Evidence is private and ignored in `.wip/home-source-audit-20261107/`:

- Workday: 2 working, 4 completed, 1 off. Zalina's 14:30 task completed at 16:53;
  it must disappear from active actions. Zukhra has the open credit receipt issue
  107654 / sale 00OF-013354 / 135,000 RUB. Old permitted closures remain excluded.
  A subsequent read observed Zalina's 19:00 closure: the latest local copy has
  1 working, 5 completed and 1 off, matching that later observation.
- Calendar: Glass 111 on November 11, 19,325 CNY / 262,820 RUB; Tural on
  November 12, 8,000 USDT / 716,000 RUB. Combined RUB guideline 978,820. Zero
  missing-receipt queue and zero new expense requests were observed.
  At 19:00 the full live expense list contained a new request 00OF-001208,
  Kosterenko / 1,500 RUB / 18:54 / awaiting decision. Its actual case and latest
  evaluation were copied locally; Home count became one. This is newer evidence,
  not a conflict with the earlier zero. No approval was applied.
- Current payroll: captured full saved 1C source through November 6, its compact
  projection, employee rules, classification, supplier decisions, attendance,
  draft and Finbox GETs. There is no saved November draft or final run. Replaying
  the persisted input policy yields 422,950.20 RUB. Recomputed compact summaries
  match the canonical compact source exactly. Raw employee amounts were summed
  independently and rounded once, matching Payroll's total convention.
- Settlements: real normalized 1C balance/cash/ledger evidence was captured via
  the existing authorized GET. Monthly paid and remaining stay unknown for the
  whole roster; five employee projections need reconciliation. Their names now
  appear in the detail with a direct link to November Payments. A healthy source
  with unresolved month/identity is distinct from an unavailable source.
- Taxes: the original November 5 management archive and all seven named source
  archives were copied locally. Shared SHA validation/loader is exercised with
  actual files. Income 65,283,832.64 RUB, threshold 60m, excess 5,283,832.64;
  crossing October 22; owner-reported accountant agreement November 4; review
  November 5; regime certificate checked November 5. These dates are separate.
  Current regime income/limit and ENS payable remain unconfirmed. The original
  November 6 canonical report confirms last loaded assessment 355,634 RUB for
  September; this is not a current payment instruction.
- October FINAL run 13 and rendered Analytics agree: revenue 18,467,114.45,
  gross profit 3,945,991.14, margin 21.3677% (21.4% shown). The production
  analytics source contains 7,786 rows and 225 negative-GP rows, not automatic
  errors. The local copy has employee result totals, not those raw analytics
  rows; its unavailable row-review count stays unknown, never zero.
- Funding: the working forecast itself reports that a fresh calculation is
  unavailable. Its last shown manager cash is 19,554 RUB: 72,700 + 45,022 +
  8,802 + 2,080 - 109,050. These accounting balances are not free funds. The
  outdated copied transport is deliberately rejected; a healthy salary source
  cannot erase a previously successful cash value during a cash-source outage.
- Workday payment matching changed from 6/7 to 8/9 while observed; one match
  remained pending. Home retains existing shared source failures/discrepancies in
  the full current-action list, with no employee-error inference. Normal pending
  matching is information in team details, not an invented administrator task.
  Raw match records were not copied to the isolated database.
- Employee access view confirms one connection without notifications. Service
  browsers/old checks stay in the service view; not all old browser entries are
  promoted into administrator actions.

Local replay uses the portal's existing `AGGREGATE_DAILY` source envelope; no
fabricated daily partitions or saved payroll run are created. The read-only Home
reader accepts the same validated aggregate and reclassifies with current rules.
When raw slices exist, their fingerprint must match. Stale supplier decisions,
wrong/future/impossible coverage and malformed amounts fail closed. Reconstructed
1C transport is local-only and explicitly distinct from the captured normalized
evidence; it is not an original production endpoint response.

Local Next/PostgreSQL replay passes for all available sections. Funding returns
503 for its unavailable cash source, while all seven other sections return 200.
Observed values, original tax dates, current payroll label and five unresolved
settlements reconcile; workflow, notification, plan, run and document counts are
unchanged across Home reads. TypeScript, 17 Home/handover/source tests, 79 payroll
tests and 9 related tests pass. Final build and rendered screen are checked after
the final edits. Remaining business-source limitations above prevent claiming a
fully reconciled current financial position.

Final optimized build passed after all code/text edits. Nine existing terminal
fiscal-summary checks also pass (114 tests in the combined relevant suites).
The restarted local app returns the expected seven successful section reads and
one explicit funding failure. No production release/version was prepared.

Browser checks on the updated copy confirm the five named settlement gaps and
the new expense link opening request 00OF-001208 / 1,500 RUB in the existing
focused dialog. No decision button was used. Desktop content fits the normal
1158×857 viewport; the 390px view uses one column without horizontal overflow
(351px Home content). Temporary viewport overrides are reset. The latest screen
retains the one unavailable funding source and explicitly unknown monthly debt.

## Changed files and behavioral differences

The approved Home layout replaces only the root content of `/admin`. All active
items remain accessible through the counted full list. Source sections retain
their existing workflows; new entry parameters open their existing details.
Payroll arithmetic is unchanged; its pure payment summary is now shared.

- `app/(dashboard)/admin/page.tsx`
- `app/(dashboard)/admin/home/AdminHome.tsx`
- `app/(dashboard)/admin/home/useHomeData.ts`
- `app/(dashboard)/admin/home/admin-home.css`
- `app/api/admin/home/route.ts`
- `lib/admin-home.ts`
- `lib/admin-home-data.ts`
- `lib/admin-home-payroll.ts`
- `lib/admin-home-payroll-source.ts`
- `lib/payroll-payment-summary.ts`
- `app/(dashboard)/admin/payroll/page.tsx`
- `app/(dashboard)/admin/payroll/PayrollClient.tsx`
- `app/(dashboard)/admin/payroll/PayrollLivePayments.tsx`
- `app/(dashboard)/admin/payroll/PayrollPaymentEvidence.tsx`
- `app/(dashboard)/admin/procurement/AdminProcurementClient.tsx`
- `components/ProcurementPaymentHistory.tsx`
- `tests/admin-home.test.ts`
- `tests/admin-home-payroll-source.test.ts`
- `docs/codex-memory/project-index.md`
- `docs/codex-memory/admin-home-local-20261107.md`

Production publication remains unapproved. Read-only source verification was
approved and performed in the second stage; the new Home has not run in production.
No release version is allocated by local testing; recheck the live release and
maintained branch and apply the ordinary version gate when release is approved.


## Stage 3 — release preparation, 8 November 2026

Owner explicitly approved preparation only, no production installation.
Fresh worktree `/Users/bela/Projects/portal-home-release-20261108`, branch
`codex/admin-home-release-20261108`, based on latest maintained bcc11e4 /1.21.48.
All18 approved runtime/test files copied byte-for-byte; package/lock candidate
1.22.0. Runtime commit `2fe001c6a20fe2aa3ad287c9eb62e6e39737709d`. TypeScript, production build,124 tests
and4 component states pass. Production-mode isolated runtime auth/read-only/
Moscow date checks and actual browser/version verified. Nov7 captured 1C data
remains dated; on Nov8 stale funding/settlement correctly unavailable.
Earlier “no release prepared” statements describe the Nov7 preview phase;
this section supersedes that preparation status, not the source evidence.

Release evidence and exact manifest: `../ops/admin-home-release-candidate-20261108.md`.
Candidate remains local, unpushed and undeployed. No schema/env/1C/financial
write; unrelated dirty worktrees preserved. Existing lockfile audit warnings
include critical Next.js; not silently fixed in Home scope, must be addressed
before installation. No new design iteration is required by this preparation.


## Stage 4 — security blocker closed, 8 November 2026

Owner approved correcting the dependency vulnerability and local release checks;
production installation is still excluded. Earlier Stage3 critical Next.js warning
is superseded: Next15.5.29 +sharp0.35.5/librsvg2.63.2; all four inherited npm
audit warnings eliminated with compatible patches. Full and production-only
audit0. TypeScript, production build,150 tests and4 component states pass.
Local native Linux x64 and image optimizer behavior verified; no SVG allowance
or other security configuration weakened. Existing PWA boundary test updated
only for the already-released AboutApp logo, reproduced stale on production
source first. No app/UI/business/schema/integration behavior changed.

Candidate reconciled with latest production1.21.49 /origin4b20300, preserving
Procurement mobile placement. Branch remains `codex/admin-home-release-20261108`;
rebased Home implementation97a2530, security runtime83ed7a0. App version1.22.0
remains unpublished, so no edit-only version bump. New exact source identity
and checks are in `../ops/admin-home-release-candidate-20261108.md`.
Old bundle built before security correction is superseded by the security-fixed
bundle; no push/deployment or production DB writes. Candidate is ready for
owner-authorized installation subject to routine live version/source/rollback
gates, without another Home design cycle.


Final stage4 verification: full stock Dockerfile Linux amd64 build and isolated
container startup pass; authenticated8 ADMIN routes, image optimizer200/400,
all8 Home sources and readonly model counts verified on both macOS and Linux.
Linux image/OCI source identity and exact logs are recorded in the release note.
No migration entrypoint, production connection, push or deployment was invoked.
