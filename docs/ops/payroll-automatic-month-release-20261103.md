# Automatic preliminary employee payroll — verified 1.21.16

Owner explicitly approved automatic November preliminary estimates with the
existing rounding, formulas, interface and configured behavior preserved, and
then approved deployment after verification. This supersedes the per-month
first-draft confirmation prerequisite for current estimates/source refresh only.

## Exact changed files

- `lib/payroll-draft.ts`: transient blank current-month inputs, revision 0;
  saved ADMIN inputs retain authority; no invented persisted confirmation.
- `lib/payroll-current-store.ts`: current private estimate may use those inputs;
  strict source/identity/FINAL/CLOSED checks and calculation engine retained.
- `lib/payroll-source-sync-store.ts`: existing hourly source sync includes the
  current month without a draft/period record; historical gate retained.
- `lib/payroll-attendance-snapshot.ts`: identifies actual prior Google evidence
  separately from app/owner-only attendance, including cutover/overlap/lateness.
- `lib/payroll-attendance-refresh.ts`: empty Google form month is a disappearance
  error only when saved evidence proves Google attendance previously existed.
  App-only months refresh repeatedly; real outages still retain last-good data.
- `tests/payroll-automatic-month.test.ts`,
  `tests/payroll-current-read.test.ts`,
  `tests/payroll-current-store.integration.test.ts`,
  `tests/payroll-source-sync.integration.test.ts`,
  `tests/payroll-attendance-route.test.ts`,
  `tests/payroll-attendance-snapshot.test.ts`.
- `package.json`, `package-lock.json`: both/root version fields aligned.

No UI component, compensation formula, employee rounding helper, workday rule,
schedule access rule, database schema or 1C document changed. Existing 1.21.14
handover review release was merged and preserved before choosing the version.

## Validation and production evidence

88 focused payroll/attendance/access/source/workday tests, 79 payroll regressions,
five release metadata tests and two real PostgreSQL integration tests passed
(174 total). TypeScript, production build and whitespace checks passed. Local
QA database/setup limitations are recorded in the candidate notes; no production
migration or schema synchronization was performed.

- Runtime commit: `17e115dc6852ce6c34e30d80bdf9afdcbc24efd6`.
- Version: 1.21.16; builtAt `2026-11-03T16:44:40.797Z` (19:44 MSK).
- Image: `sha256:a4353e429002604180bbe9032ae9c49bdb2074d76a0eb2fdca65a6c06e9684da`.
- Exact SSH commit, public metadata/health and authenticated ADMIN version label
  verified independently; unauthenticated private payroll remained 401.
- Normal `offonika-payroll-source-sync.service` completed at 16:52:18 UTC,
  Result=success / ExecMainStatus=0. Its actual result was persisted=true,
  completed, November updated with sales=true, attendance=true, verifiedThrough
  November 2; October skipped. This was not a busy skip or a custom DB write.
- November attendance GET independently confirmed refreshed sourceCheckedAt
  `2026-11-03T16:52:18.494Z`. Current-month draft count stayed zero.
- Actual private reader checks for IDs 3/4/5/7/8 confirmed complete underlying
  estimates, rounding to hundreds, component-total equality, November 2 cutoff
  and revision 0. Three current_estimate responses; two existing requires_action
  responses for missing tomorrow schedule. No schedule was filled on their behalf.
- Real authenticated employee preview rendered the existing rounded November
  card/components. October still showed confirmed monthly amount and verified
  payment/zero balance; switching back retained the November estimate. Screenshot:
  `/tmp/payroll-12116-manager-preview.png`. No physical employee phone session.
- Full saved-payroll/configuration hashes matched both after deployment and
  after normal automatic source sync. Env/mount fields and current workday IDs
  retained. No payroll run/draft/setting or real attendance was manually edited.
- Final worker ended RELEASE_EXIT=0; healthy container, verified registry with
  current 1.21.16 and preceding 1.21.15/1.21.14 artifacts; 20 GiB free.
  Existing server `.rollback/` was preserved, as were unrelated files.

## Intermediate 1.21.15 verification failure

1.21.15 / `4c77e27` introduced current-month draft-free estimates and correctly
rendered rounded employee payroll, but normal source-service verification
exposed an older guard: the persisted November summary contained PWA days while
Google form rows were empty. The guard mistook that for disappearance of Google
data. Service returned incomplete (sales=true, attendance=false), and the release
worker ended 1. Completion/automatic-refresh success was not claimed.

Read-only production replay verified all five estimates, access conditions and
unchanged saved hashes. Runtime/public/UI/identity were independently verified;
the intermediate healthy 1.21.15 artifact was recorded for provenance/retention
before building the new 1.21.16 patch. Its known refresh limitation was explicitly
pending repair, not described as successful business verification. 1.21.14 was
retained as the preceding known rollback. The 1.21.16 guard repair and repeated
app-only refresh/source-outage tests completed the approved task.

Logs: `/home/bela/payroll-release-12115.log`,
`/home/bela/payroll-12115-diagnose.log`,
`/home/bela/payroll-release-12116.log`; local test logs
`/tmp/payroll-12116-*.log`. Private inputs/screenshots remain outside Git.
Evidence documentation is committed separately from runtime/version changes.
