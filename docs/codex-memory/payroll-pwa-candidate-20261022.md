# Employee payroll: production release 1.13.1, 2026-10-22

## Status and authority

Released 1.13.1 after the owner's explicit approval of commit, deployment,
additive draft storage and staged automatic refresh/employee activation.
Production runtime/server commit `a92c4fe05978941f8ca24b26c656cbe76769626c`;
main feature commit `f3e7bab`, preparation documentation `c0a7e90`.
Earlier local-only checkpoints below remain historical evidence. No 1C write
or historical final-run change was performed or authorized.

## Verified production outcome

- Version 1.13.0 was first deployed ADMIN-only. It exposed a first-save UX gap:
  an unchanged initial draft could not be explicitly confirmed. Patched in
  separately versioned 1.13.1 (`a92c4fe`), with a tested `Подтвердить данные`
  action; no invented manual corrections or financial annotations were added.
- Final public metadata and authenticated ADMIN footer show 1.13.1, built
  `2026-10-22T12:45:58.390Z` (15:45 Moscow). Public build identity is `unknown`
  / revision null because Git metadata is not in the Docker context; the exact
  server Git commit above was independently read over SSH, not inferred from it.
- Healthy current image is
  `sha256:a2166d495873644d3744ba442c4f59e2e1841d799420bc43823ec080138d61af`.
  Prior image 1.13.0 is `sha256:2da1a88da067678b1c983320ed02904391c7297c5ac1e2a7a5810054fa4523a8`;
  pre-feature 1.12.1 is `sha256:e5853f05cf2e88593058afefd6544789b49c2fa4aa3bd61e6d7b7659f6006ad7`.
  All were registered through the shared verified-image policy. Rollback must
  disable employee access/timer first; the additive table remains compatible.
- Fresh backup `/var/backups/offonika-portal/20261022T124406Z` passed manifest
  hashes, upload gzip and PostgreSQL dump TOC checks. A previous same-day release
  backup also exists at `20261022T123027Z`. No restoration was performed.
  The exact draft migration was the only pending SQL before 1.13.0; it applied
  successfully. The 1.13.1 preflight found no further pending migration/drift.
- Both persistent feature flags are enabled. The authenticated ADMIN explicitly
  confirmed October inputs via the real UI, creating draft revision 1. Total
  gross remains 595,552.84, advances 7,500, after advances 588,052.84; employee
  rows remain unchanged, including Magomed 28,401.19 from current attendance.
  No final payroll was created/replaced and no missing Diana inputs were guessed.
- `offonika-payroll-source-sync.service` ran successfully. Its parsed result
  confirmed an actual persisted October update, not merely a busy skip. The
  readiness reader verified all five active WORKDAY employees with complete
  estimates and verified advances before employee access was enabled.
  `offonika-payroll-source-sync.timer` is active; hourly 08:15–23:15 Moscow.
  First future timer trigger was scheduled for 16:15 Moscow; the completed
  first run was explicitly started through systemd, not a claimed observed tick.
- Astemir/PROCUREMENT remains excluded; no procurement salary page was shipped.
  Current estimates exclude discipline/one-time premiums and preserve retail/
  wholesale component grouping. Historical totals/payments use authoritative 1C.
  A new unapproved month needs one explicit ADMIN confirmation before background
  calculations are eligible; never silently seed empty owner decisions.
- Build, TypeScript, 78 payroll tests, first-confirmation tests, private-read/
  history/rounding and release-metadata checks passed. PostgreSQL integrations,
  source-failure preservation and five-employee local HTTP acceptance passed
  before release. Production health returned `{"ok":true}` in the browser;
  the signed ADMIN is denied the private employee salary API. A shell anonymous
  HTTP probe timed out, so no fresh live anonymous-status verification is claimed.
- Actual physical-phone/employee-login UI verification remains pending. Employee
  UI was verified in the isolated authenticated application, while production
  readiness used the exact private server reader for all five accounts without
  impersonating employees or weakening authentication.
- Approved maintenance removed unused cache and older eligible rollback images
  beyond the retained set; live containers, uploads, DB and backups were protected.
  Post-release SSH disk check reports about 19 GiB free. Deleted build artifacts
  can be rebuilt from source; do not claim they remain tagged in Docker.
- Operational logs are local `/tmp/mobo-payroll-deploy-1.13.0.log`,
  `/tmp/mobo-payroll-deploy-1.13.1.log`, `/tmp/mobo-payroll-activate-1.13.1.log`.
  Production evidence/config backups are under `.rollback/payroll-1.13.0` and
  `.rollback/payroll-1.13.1` on the VPS; never commit their server.env copies.

Candidate was prepared on `c6ee4a4` and subsequently fast-forwarded to the latest
deployment branch `9ab1671` (1.12.1), retaining all salary WIP. Production Git
was independently read as `b6992383`; public metadata confirmed 1.12.1 built
2026-10-22T08:26:58.788Z. The branch's later commit is documentation-only.
The local modified build is NOT a published replacement for 1.12.1. Recheck live
metadata and deployment branch before choosing a new version; none is reserved.

## Integrated scope

- Real employee payroll route and private API, shared ADMIN calculation engine,
  stored current inputs and immutable historical FINAL projection.
- Append-only server draft revisions, authenticated ADMIN save with optimistic
  concurrency and idempotency; additive draft migration remains local-only.
- Current amount is approximate; historical confirmed amounts come from 1C.
  Selected-month payments never become an all-month debt figure.
- Verified zero advances hide the card; positive advances show it. An unavailable
  check is not zero. Fresh reads use a bounded five-minute coalesced cache.
- Salary navigation is conditional. Latest 1.12.0 schedule implementation and
  unsaved bulk-edit protections are retained. Shared calendar CSS and dimensions
  were not changed; older calendar palette WIP was deliberately excluded.
- No new production account, salary rule, final calculation or automatic empty
  ADMIN draft was created. Existing browser-local owner inputs must be reviewed
  and explicitly saved before employee access is enabled.

## Controlled activation

### Release preparation recheck, 2026-10-22, read-only production

- Owner authorized preparation only. No commit, push, deployment, production
  migration/configuration change, timer installation or production snapshot
  write was performed. Current public version remains 1.12.1, built
  2026-10-22T08:26:58.788Z; remote branch `9ab1671`, runtime `b6992383`.
  Both new feature flags are absent/false in server.env; the payroll timer is
  not installed/inactive. These are expected before staged activation.
- Fresh host-side readers confirmed Google attendance (994 rows), schedule
  (319 rows), and 1C costing through October 17. Exact shared 1C adapters read
  9,740 facts over ten pages and 21 procurement documents. Applying the same
  classification rules reproduces all seven remuneration components for all
  eight manager summaries within half a kopeck; no component mismatches,
  unresolved classification or payroll-impacting pending cost rows.
  Full normalized-row fingerprints differ from captured snapshots; do not claim
  byte-identical source data. Acceptance here is independently recomputed
  remuneration parity, not an asserted explanation of the raw fingerprint delta.
- Re-ran 15 source-refresh/feature/cache checks, three actual PostgreSQL
  integrations and five release-metadata checks. Exact migration SQL passed
  again in an isolated transaction and was rolled back. The real-copy failure
  runner preserved all source snapshots/drafts/final runs and skipped September.
  Source-free CLI dry-run reports only October/September and persists nothing.
- Five-employee production-mode local HTTP acceptance was rerun. New employee
  grouping/bonus policy, September payments, private access boundaries and
  procurement exclusion remain covered. Astemir's future screen stays parked.
- Disk probe reports about 16 GiB free. This is not a fresh sudo image-registry,
  backup integrity or offsite restore check; repeat the release gates immediately
  before any authorized deployment. Actual-phone verification and the first
  successful installed timer run remain pending.
- Next operations approval must explicitly cover the additive draft migration,
  staged ADMIN storage enablement, review/save of real owner inputs, scheduled
  source-snapshot refresh and employee activation, not only a code restart.
  Require a successful first refresh and ADMIN/1C reconciliation before enabling
  employees; keep immutable finals and all 1C documents unchanged.

### Main-screen integration acceptance, 2026-10-22

- Approved policy is connected to the ordinary `/employee/payroll`, not a
  special example. Standard 78 payroll tests, 24 focused estimate/private-read/
  history tests, TypeScript and production build pass. Approximate component
  rounding, signed returns, missing/zero inputs, bonus exclusion, advance
  separation and confirmed partial/complete payment cases are covered.
- HTTP acceptance against the isolated copy of real data passed for all five
  PWA employees: current estimates 53,500 / 56,800 / 27,800 / 59,800 / 38,600
  for Zukhra / Zalina / Magomed / Liana / Milana. September posted accrual,
  payment and remainder are unchanged; Milana's actual 100-ruble remainder is
  preserved. Current advances are confirmed zero in these five fixtures.
  Source costing coverage remains October 17, not October 22. Positive/unknown
  advance and source failure cases are unit-tested, not new live issuances.
- Authenticated local browser verified the ordinary current retail screen at
  mobile size, September posted 66,000 paid in full, unavailable August (not
  synthetic zero), retry and return to October. Actual physical-phone and fresh
  production source reconciliation remain release checks.
- Files in this integration: `lib/employee-payroll-estimate.ts`,
  `lib/payroll-current-read.ts`, `lib/employee-payroll-read.ts`,
  `app/(dashboard)/employee/payroll/page.tsx`,
  `app/(dashboard)/employee/payroll/PersonalPayrollClient.tsx`,
  `tests/employee-payroll-estimate.test.ts`,
  `tests/employee-payroll-read.test.ts`, `tests/payroll-current-read.test.ts`,
  and this note. The ignored five-employee QA helper was updated separately.
  Unrelated dirty files, ADMIN formulas, 1C documents and production state were
  left unchanged. No commit, deploy, production migration or activation.

### Owner decision — employee estimates and confirmed payments, 2026-10-22

- During the month, show only earned day pay and sales/service remuneration in
  the employee estimate. Exclude the discipline bonus; do not expose attendance
  penalties or a discipline breakdown until the owner separately approves that
  workflow. ADMIN calculations and salary rules remain unchanged.
- Keep the short label `Предварительный расчёт`, without additional explanations
  about omitted bonuses or rounding. Retail earnings are grouped by ordinary
  device sales, credit device sales, accessories, and film/application services;
  wholesale shows day pay and wholesale sales. Use actual components, not gross
  minus day pay, because that remainder may include bonuses.
- Final salary comes from the owner's posted 1C accrual for the earning month,
  including approved premiums and rounding. Cash expense documents establish
  issued payments, not final accrued salary. Show confirmed accrued, paid and
  remaining amounts separately; partial first-day payments must not replace the
  full month's salary, and October issuances for September belong to September.
- Implementation status: after explicit approval, the ordinary employee API now
  projects day pay and sales components without discipline/one-time premiums.
  The component sum is checked against ADMIN day pay plus sales remuneration;
  missing/unsupported inputs never fall back to gross with hidden bonuses.
  Display-only rounding distributes 100-ruble units so components add to the
  rounded estimate, including signed returns. The confirmed historical reader
  remains based on posted 1C accrual and month-attributed cash, gated by FINAL.
  The separate `?example=1` data injection was removed: all salary views now use
  the private API, normal month selection, refresh and error handling. The URL
  parameter no longer selects a different calculation. Local integration only;
  no production activation, migration, commit or deployment.
- Owner approved short labels `Смартфоны и техника` and `В кредит`, applied in
  the local example. The former is non-credit device remuneration (cash or card),
  the latter credit device remuneration; accessories retain their own bucket.
  Do not label a mixed device bucket as smartphones only or change the category
  composition to fit the wording.

`lib/payroll-features.ts` defaults both capabilities OFF in production.
`PAYROLL_SERVER_DRAFTS_ENABLED=1` enables ADMIN draft storage alone.
Employee access additionally requires `PAYROLL_EMPLOYEE_ENABLED=1`.
`PAYROLL_PWA_PREVIEW=1` applies only in development and cannot enable production.

Persistent deployment configuration and the production migration need explicit
operational approval. No `.env` or `server.env` was edited. Do not assume a shell
variable outside compose's environment reaches the application container.

## Verification evidence

- Prisma generation, TypeScript and production build passed.
- Standard payroll suite: 78 passed; focused private-read/draft/cache/feature
  suite: 30 passed; release metadata suite: 5 passed.
- Surrounding schedule/workday suites: 19 passed.
- Two guarded local PostgreSQL integration tests passed: draft concurrency,
  retry/history and FINAL/CLOSED locks; exact private current projection.
- Production-mode HTTP tests passed in three stages: OFF, ADMIN drafts only,
  employee enabled. Tested login, anonymous rejection, own salary, rejected
  identity override/ADMIN draft access, save/re-entry, retry, conflict and final
  lock. Tests used an isolated local database and captured 1C read fixtures,
  never production writes.
- Real rendered employee UI checked at 390x844 and 320x740: no horizontal
  overflow, October approximate current amount, September confirmed amount and
  zero remainder; navigation into latest schedule succeeds.
- `git diff --check` passed. Old dirty preview worktree left untouched.

## Independent refresh implementation completed locally

Owner explicitly requested resolving the release prerequisites, not another list.
Shared refresh services were extracted verbatim from the existing ADMIN source
routes; route authentication remains in the HTTP boundary. A one-shot runner now
reuses them without an ADMIN browser or a public internal endpoint. It refreshes
current/previous Moscow months only when saved drafts exist and there is no FINAL
run or CLOSED period. Shared PostgreSQL advisory locking serializes ADMIN and job
writers; failed source reads retain previous snapshots. The job has an eight-minute
process deadline. Adjacent systemd templates check hourly during Moscow working
hours, but are NOT installed/enabled on the VPS.

No new schema is needed for this refresh mechanism. No shared calendar CSS,
salary formula, 1C write contract or production environment was changed.

Additional verification: standard payroll suite 78 passed; all non-integration
payroll suites passed when run with the appropriate client/server React conditions.
Source orchestration/route tests passed; a real local PostgreSQL test confirmed
writer exclusion, lock release on failure and saved-draft/FINAL/CLOSED gates.
An actual CLI failure rehearsal on copied real financial data preserved hashes
of ALL runs/results, drafts, attendance and sales snapshots; September was skipped.
Production-mode HTTP OFF/drafts-only/employee-enabled acceptance passed again.
TypeScript and production build passed after service extraction.

Files changed in this prerequisite-completion phase:

- `app/api/admin/payroll/daily-control/route.ts`
- `app/api/admin/payroll/attendance-preview/route.ts`
- `lib/payroll-one-c-refresh.ts`
- `lib/payroll-attendance-refresh.ts`
- `lib/payroll-source-lock.ts`
- `lib/payroll-source-sync.ts`
- `lib/payroll-source-sync-store.ts`
- `scripts/payroll-source-sync.ts`
- `tests/payroll-period-source-fallback.test.ts`
- `tests/payroll-attendance-route.test.ts`
- `tests/payroll-main-route.test.ts`
- `tests/payroll-source-sync.test.ts`
- `tests/payroll-source-sync.integration.test.ts`
- `tests/payroll-source-routes.test.ts`
- `docs/ops/payroll/README.md` and adjacent service/timer templates
- this candidate note and its project-index status pointer

## Remaining release gates

Owner scope clarification: the current release enables salary only in the ordinary
WORKDAY PWA, not Astemir's separate PROCUREMENT cabinet. The latter is deferred.
The development-only procurement visual proposal was physically removed from
the app source before rebuilding. Its three exact source files and optional
client coverage caption are preserved in the ignored local apply_patch archive
`.wip/future-procurement-payroll/restore.patch`, with a README. Nothing was lost;
none of these preview routes or caption changes enter the current build.
Restoring it later requires separate approval and a review of the WORKDAY-only
API access policy, not silently extending that policy.

ProcurementShell, procurement layout and transaction logic remain unchanged.
The future preview used fixture login of the real mapped user 10, not a bypass.
Verified current estimate 100,000 and September confirmed 128,000 / paid 128,000 /
remaining 0 in the actual UI, month switching, tab return and no horizontal
overflow in mobile/extra-narrow modes. TypeScript and diff checks passed; no
physical-device test or production release was performed for this future idea.
Full mobile screenshot: `.wip/artifacts/astemir-future-october.png`.

Current-scope hardening: `lib/employee-payroll-read.ts` now requires an active
EMPLOYEE with explicit `portalArea === 'WORKDAY'` before any salary read.
PROCUREMENT and unknown/missing areas fail closed; the matching regression is in
`tests/employee-payroll-read.test.ts`. Production-mode HTTP acceptance passed for
all five actual WORKDAY fixture accounts (IDs 3,4,5,7,8): October estimates,
September confirmed accrual/payment/remainder, private no-store responses,
identity-override denial and ADMIN draft denial. Account 10 receives API 403 and
the removed future route returns 404. Real September remainder 100 for Milana is
preserved, never normalized to zero. Full build, 78 payroll tests, 15 focused
boundary/feature/sync tests and diff checks passed. No production data writes.

1. Independent refresh code is implemented and tested locally, not activated on
   production. Follow `docs/ops/payroll/README.md`: install/run the job only under
   approved release operations, verify real-source coverage and unchanged FINAL
   runs, then enable the timer and employee access. The successful VPS/Google/1C
   job path has NOT been claimed verified by the isolated failure rehearsal.
2. Physical-phone / installed PWA checks remain outstanding; viewport testing
   is not equivalent to them.
3. Review/save real owner drafts, approve production migration/configuration,
   verify backup/rollback compatibility, then follow the VPS runbook with a
   freshly determined application version. Do not call this candidate deployed.

Financial QA fixtures, credentials and screenshots remain in ignored `.wip/`,
not release files. Documentation should be committed separately from code.

## Live read-only preflight after 1.12.1 integration

- Independently read production Git/public metadata and confirmed the latest
  schedule release. Its shared CSS was fast-forwarded intact; payroll adds no
  CSS diff against the new deployment base. Rebuilt successfully; 19 surrounding
  schedule/workday tests and five metadata tests passed again.
- Executed the existing Google readers transiently on the VPS using server-local
  credentials (not exported or logged): attendance returned 994 rows and schedule
  319 rows, both real `google-sheets` mode.
- Live 1C close-state read returned HTTP 200, eight operations, with cost
  calculation dated 17.10.2026. Do not relabel these data as verified through
  October 21/22; the newer 1C costing run is absent in this evidence.
- Full candidate read adapters passed against live 1C without persistence:
  9,740 sales facts on ten pages (`payroll-sales-facts-v2`) and 21 attributed
  purchase documents (`payroll-purchase-attribution-v1`); the exact close-state
  parser confirmed October 17 ready. Remote probe code was supplied via stdin,
  not installed as an application release or saved on the VPS.
- Read-only host checks: about 16 GiB available and maintenance timer active.
  This is not a fresh image-registry/backup/migration verification: Docker access
  needs sudo and noninteractive sudo was unavailable. No terminal/password
  operation or privilege change was initiated without explicit approval.
- No source refresh POST, source snapshot write, config edit, task installation,
  migration or deployment was performed on the VPS by these checks.

## Owner-authorized sudo read-only preflight, 2026-10-22 12:00 MSK

After the owner entered sudo only in the visible Terminal, the narrowly scoped
inspection finished with `CHECK_EXIT=0`. Running 1.12.1 image is healthy and is
the first verified registry entry; both registry rollback images exist:
current `e5853f05...`, prior `4741ac83...` (1.11.1), preceding `61fcdb9a...`
(1.11.0). No image/tag/registry was modified.

Production migration history has 71 finished, non-rolled-back migrations,
no unfinished entry and no checksum drift against this checkout. Exactly one
candidate migration is pending: `20261021200000_add_payroll_draft_revisions`.
`PayrollDraftRevision` is absent, as expected before release. No migration ran.
The exact candidate SQL also passed in a temporary transaction-local schema on
the guarded local PostgreSQL, including positive revision and uniqueness checks;
the entire schema test rolled back successfully.

Backup and offsite timers are scheduled. Latest located DB/uploads backup is
`/var/backups/offonika-portal/20261021T232757Z` (October 22 02:27 Moscow).
Presence/freshness alone are not an integrity or restore test. A separate
owner-authorized Terminal check of manifest hashes, gzip integrity and dump TOC
was opened; results must be recorded before claiming it passed. No restore,
cleanup, deployment or production data write is part of these checks.

The second connection remained at its sudo password prompt without input during
extended monitoring. Only that owned pending SSH process was terminated to avoid
an unattended authentication request; terminal result `CHECK_EXIT=255` confirms
it did NOT run the integrity check. Do not mark backup checksums/dump TOC verified
from this attempt. Independent public health remained HTTP 200 afterward.

Local evidence: `/tmp/mobo-payroll-readonly-preflight-20261022.log` and
`/tmp/mobo-payroll-backup-integrity-20261022.log`; these are not release files.

### Backup integrity check completed after reopening the Terminal

The owner reported that the second window was not visible. A new Terminal
instance was opened; the owner confirmed seeing it and entered sudo there.
The guarded check selected the same latest backup directory. Manifest validation,
`sha256sum -c SHA256SUMS` and `gzip -t uploads.tar.gz` all completed before the
dump listing step (each synchronous failure would have stopped execution).

`pg_restore --list` returned process status 0 with a valid PostgreSQL 16.14
custom-format dump header, 657 TOC entries and payroll tables, with no pg_restore
error. Node's synchronous stdin writer reported EPIPE because the reader exited
after consuming its TOC instead of the entire 22 MB stream. The wrapper therefore
reported `CHECK_EXIT=1`; do NOT call the wrapper exit successful. The reader's
status/output and preceding hash/gzip checks establish the individual checks;
this is not an archive corruption signal. For future streamed TOC probes, handle
the expected early stdin closure only when reader status is 0 and its TOC is valid.

Independent read-only systemd checks confirmed local backup success at
2026-10-21 23:28:27 UTC and offsite job success at 2026-10-22 00:05:53 UTC.
The fresh offsite artifact itself was not downloaded/decrypted/restored during
this check. No restore, migration or production data write occurred. Public
health independently remained HTTP 200 after the checks.
