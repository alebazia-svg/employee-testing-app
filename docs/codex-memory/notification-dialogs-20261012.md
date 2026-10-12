# Notification record dialogs — local implementation, 2026-10-12

Owner approved checking which bell notifications can open without navigating
away. No deployment or financial/1C writes were authorized by this step.

## Opening policy

| Notification | Opening |
| --- | --- |
| One supplier payment, including approval/change/cancellation | Focused payment dialog |
| Payment revision needing review | Same dialog, before/after and existing guarded revision actions |
| Added payment receipt | Same dialog, existing receipt viewer/uploader inline |
| Admin notification for one expense request | Existing expense request dialog |
| Legacy multi-payment notification | Existing calendar destination, not just the first payment |
| Schedule, workday reviews/discussions, delivery top-up, cash/operational/system events | Existing destination; these need their surrounding workflow |

First approval of a submitted supplier plan still happens in the calendar after
its existing payment-verification gate. The notification opens its details,
not an unguarded alternative approval path. System push deep links are unchanged.

## Boundaries

- Shared `lib/notification-opening.ts` used by admin bell/history and employee
  notification surfaces.
- GET `/api/notification-details/[audience]/[id]` reads stored portal records,
  does not contact 1C, and checks active user, role, notification recipient and
  procurement ownership. The client cannot select an arbitrary record ID.
- Dialog appears immediately with notification text; only successful detail
  loading marks the notification read. Failed loading offers retry.
- Existing revision/edit/expense/receipt mutation endpoints retain their checks.
- Unsaved drafts survive the discard-confirmation screen. Approved-edit success
  updates the dialog summary without waiting for a full-page refresh.
- Desktop width 720px; mobile uses the existing full-screen dialog layout.

## Verification

TypeScript and 14 focused tests pass (notification routing/access, receipt
policy, revisions and approved-edit integration). Integration uses only
`procurement_receipts_current_test` on localhost:55439, with mocked 1C evidence.
Run server tests with `NODE_OPTIONS=--conditions=react-server` and the explicitly
guarded local test DATABASE_URL. Desktop and 390px mobile dialogs inspected;
dirty-close/continue retained entered text. No real approval was submitted.
Production build checked in an isolated copy, not the running dev checkout.

## Release handoff

Follow-up preparation: reconciled onto `a3a628e` (runtime release 1.4.3) in
`/tmp/mobo-notification-release.uk1yzq`. Exact candidate source files preserved
under `.wip/notification-release-20261012/` in this checkout. This is a source
bundle, not permission to overwrite newer changes: recheck deployment HEAD and
merge against that baseline before release. No production push/deploy performed;
no next version reserved. The old local checkout remains unchanged.

The latest admin bell/history now count unresolved attention items. Candidate
integration preserves that policy: viewing never decrements the task count.
Admin-only `plan:<id>:...` cards from the attention list are supported by the
detail reader (employee use rejected) and are not sent to receipt-mark-read.
Existing employee cash-issue modal handling is preserved. 36 focused tests and
full production build pass on the integrated candidate. Candidate has no
experimental currency-source diff.

Final integrated UI verification completed on localhost:3142 with the isolated
test database and its existing test admin, without production credentials.
From the actual admin home bell, the synthetic payment-revision card opens
without leaving `/admin`; viewing and closing it leaves the unresolved task
and task count intact. Receipt notifications display the existing file list,
author/date and upload control in the same dialog. Inline receipt content no
longer repeats the supplier and amount already shown by its parent dialog.
Desktop and 390x844 mobile views verified, including visible revision actions;
temporary viewport override reset afterward. No financial action or file upload
was submitted. Employee/expense access paths are covered by focused tests, not
claimed as newly manually verified UI flows. Downloaded file contents were not
checked. The final isolated production build also passes with
`NEXT_PUBLIC_PROCUREMENT_RECEIPTS_ENABLED=1`.

Screenshots: `/tmp/mobo-notification-integrated-desktop.png`,
`/tmp/mobo-notification-integrated-mobile.png`,
`/tmp/mobo-notification-receipt-integrated.png`.

Not released. This tree also contains prior approved-edit, revision and source
optimization work plus unrelated previews. Do not stage everything. Deployment
branch was already at `e250bb4` / portal 1.4.3 during this task; reconcile onto
the latest deployment branch and recheck live version before any future release.
The earlier currency-source optimization remains a separate unverified change:
its live equivalence probe timed out; do not claim it verified or ship blindly.

Changed notification files: `components/NotificationRecordDialog.tsx`,
`components/AdminInboxBell.tsx`, `components/ProcurementNotificationsButton.tsx`,
`components/ProcurementReceipts.tsx`, `components/ExpenseRequestDialogRow.tsx`,
`components/ProcurementAdminList.tsx`, `components/ProcurementApprovedEdit.tsx`,
`app/(dashboard)/admin/inbox/AdminInboxListClient.tsx`,
`app/(dashboard)/employee/WorkdayNotificationsClient.tsx`,
`app/(dashboard)/admin/expense-requests/page.tsx`,
`app/api/notification-details/[audience]/[id]/route.ts`,
`lib/notification-opening.ts`, `lib/notification-detail.ts`,
`lib/expense-request-list-item.ts`, notification tests and the isolated
`scripts/preview-approved-edit.ts` fixtures. Prior changes within shared files
must be preserved and reviewed separately.

## Responsiveness follow-up — approved implementation, not release authority

Owner reported slow creation/editing/opening and controls blocked by 1C refresh.
Release remains on hold. Changes are in the reconciled candidate and its `.wip`
source bundle, NOT in the old runtime checkout (apart from this handoff).

Findings from code: buyer SSR awaited all catalogue, debt, balances, rates and
payment evidence before rendering; full-calendar `freshEvidence()` runs on
writes; creation/batch had serial independent reads; minute/focus refreshes could
disable controls and refresh an open form. No production latency measurement is
claimed. Local development compilation is not a production timing benchmark.

Implemented using existing architecture, no schema/1C changes:

- Buyer first paint now uses stored own plans and existing last-confirmed
  evidence; live sources stream into the SAME client instance. Source generations
  and plan versions reject late results. No other manager's rows are serialized;
  other-manager reserves remain unknown until verified. Unknown payment rows are
  separate from unpaid rows; confirmed paid snapshots remain history-only.
- Existing request editing no longer depends on a complete background catalogue.
  Save still goes through live server guards. Buyer captures the version when
  editing starts; arriving props cannot silently rebase an in-progress draft.
- ADMIN approval now verifies payment and exact plan version at the endpoint,
  before its transaction/lock. UI buttons no longer depend on overall refresh;
  failed/partial/unsupported evidence cannot approve. RETURN/CANCEL remain
  portal-only actions and do not wait for financial reads. Notification first
  approval still links to the calendar (not changed in this follow-up).
- Independent creation checks run concurrently in BOTH individual and actual
  batch form routes. All must finish successfully before writes; duplicate
  guards, audit and notifications stay in the transaction. Monthly evidence
  reads use the existing bounded concurrency of two.
- Identical concurrent currency-source GETs share one in-flight read, keyed by
  source/credential/query/timeout hash. Results are cloned per consumer; neither
  results nor errors are cached after settlement. This is NOT the earlier
  unverified contract-first currency-source optimization; that remains excluded.
- Buyer and ADMIN automatic refresh pause while a dialog is open.

Verification: 63 focused tests pass, including new real isolated-PostgreSQL
approval/create tests (no real 1C calls). TypeScript passes. Actual authenticated
local ADMIN and buyer UI tested with 1C intentionally unconfigured: details and
editing stay accessible, forms close normally, financial values remain unknown.
No browser approval/save/upload was submitted. Two orphan test users from the
first failed fixture setup were removed by exact IDs/login in the isolated DB;
no production data was touched. Screenshots:
`/tmp/mobo-responsive-admin-actions.png`, `/tmp/mobo-responsive-buyer-edit.png`.

Final isolated production build passed after all responsiveness changes.
Before release: measure realistic 1C read/save
latency and review the remaining full-history critical path. Do not claim that
live saves are now instant, or silently replace financial guards with cached
display evidence. A narrower verified evidence scope / existing background
snapshot workflow needs an explicit safety design and equivalence tests before
removing full reconciliation. No deployment was made or version reserved.

Additional exact files in the candidate/bundle:
`app/(dashboard)/procurement/page.tsx`,
`app/(dashboard)/procurement/ProcurementCalendarStream.tsx`,
`app/(dashboard)/procurement/ProcurementPaymentCalendarClient.tsx`,
`app/(dashboard)/admin/procurement/AdminProcurementClient.tsx`,
`app/api/admin/procurement/payment-plans/[id]/route.ts`,
`app/api/procurement/payment-plans/route.ts`,
`app/api/procurement/payment-plans/batch/route.ts`,
`lib/procurement-buyer-initial-view.ts`, `lib/procurement-inflight-read.ts`,
`lib/procurement-currency-payment-source.ts`,
`lib/procurement-plan-revision-server.ts`,
`tests/procurement-buyer-loading.test.ts`,
`tests/procurement-inflight-read.test.ts`,
`tests/procurement-approval-verification.test.ts`,
`tests/procurement-create-verification.test.ts`.

Procurement evidence progress remains 54.8/100; no stage/item IDs changed.
Autonomous purchasing, spending and 1C write authority remain disabled.

## Follow-up: bounded live timing and revision approval concurrency

2026-10-12: owner approved the next performance step, not deployment or history
retention changes. Production AIAgentAPI/Yandex still match v0.15.430. History,
1C documents, production portal data and payment links were not changed.

Read-only local-to-production API probe, 2026-09-13 through 2026-10-12 (exclusive
upper boundary 2026-10-13 Moscow): five GETs, 4,465 ms total. Currency payments
126 ms, conversions 208 ms, RUB costing 578 ms; expense requests two sequential
pages, 3,525 + 885 ms, 1,883,483 response bytes. Complete responses contained 96
payment rows, one conversion and 124 expense requests. This excludes portal
plan-specific order/register expansion and is NOT full save latency, server-side
latency or a census of production storage. Today's smaller three source reads
were approximately 524–526 ms each. No payloads were persisted or printed.

Replaying the exact captured currency-source payloads in memory through baseline
a3a628e and the candidate yielded identical results (excluding checkedAt). This
checks basic source parsing only, NOT global allocation equivalence with all
production plans. Do not promote it to broader validation.

Candidate `decideApprovedRevision` now runs new-basis validation, fresh global
evidence and USDT balance reads concurrently against the same captured revision.
All finish before transaction entry. Candidate version is checked under lock even
when the basis is unchanged; rejection does not contact 1C. New regression test
covers successful same/changed basis, each read failure, incomplete evidence,
paid state, concurrent edits before/after evidence capture and rejection.
64 focused tests passed; TypeScript and the final isolated production build passed.

Additional files: `tests/procurement-revision-parallel.test.ts` and local GET-only
`scripts/probe-procurement-read-latency.ts`. Runtime edit is confined to
`lib/procurement-plan-revision-server.ts` in the reconciled candidate. Probe is a
local diagnostic with explicit paths/window, not a deployed scheduled job.
No production release or application version increment performed. Broad fresh
evidence remains a write guard: replacing it with a narrower or persisted
authoritative snapshot still requires allocation safety/equivalence work.

## Full production-plan replay and contract-first verification

Later on 2026-10-12, read-only server probe completed using all 31 production
portal plans with PostgreSQL `default_transaction_read_only=on`. Source bodies
remained in process memory only. Baseline took 8,928 ms / 97 GETs (second run:
13,340 ms / 97 GETs). 83 reads were supplier order document-evidence; three
expense-request pages totaled approximately 2.1 MB. Candidate allocation on
identical payloads matched all 31 plans exactly, including evidence fields and
versions. Live server is now 12563e8 / 1.4.4; relevant procurement evidence modules
and expense-request source have no diff against a3a628e. Reconcile other latest
release files before any future release, do not overwrite 1.4.4 expense changes.

The previously excluded contract-first optimization was separately replayed:
46 logical reads instead of 97, three additional exact-payment-basis GETs, zero
allocation or state differences across 31 plans. Independent final DB read
confirmed all plan versions remained unchanged. This validates equivalence on
the current real dataset, not every possible future payment. No live write/save
latency or optimized cold wall-clock latency is claimed.

After this evidence, the contract-first source diff was merged into the local
candidate, preserving in-flight request coalescing. It verifies native full-RKO
contract movements before discovering historical order anchors; explicit portal
orders and legacy manually linked suppliers retain their original proof path.
New `tests/procurement-contract-first-source.test.ts` covers exact contract-only
payment, explicit competing order/no double allocation, manual fingerprint,
old endpoint fallback, incomplete/mismatched/unposted document, and fresh reads
after prior success. 90 focused tests, TypeScript and final isolated build pass.

This section supersedes earlier notes excluding that optimization. It remains
LOCAL, not deployed. Latest owner additionally asked to diagnose a newly issued
Tural payment that has not closed its request; investigation is in progress.
Diagnostic scripts and aggregate outputs are at `/tmp/mobo-full-evidence.Nqzqv8`;
remote temporary script `/tmp/mobo-full-evidence-20261012.cjs` contains code only,
no credentials/payloads, and does not change application files or services.

## Tural RUB cash funding for a USDT supplier transfer

Owner confirmed cash was handed to an exchanger, with a RUB supplier RKO,
while the supplier received USDT. Payment method must not exclude a linked RUB
RKO. Owner explicitly approved the existing dual residual threshold (<=500 RUB
AND <=1%) for this funding flow; actual USDT must not be inferred from RUB.

Read-only production diagnosis found request PAY-20261012-727873, RUB budget
500032.80, and posted supplier RKO 00OF-001884 for 500000 RUB dated 12 October.
Its contract is present. An older completed USDT Tural request must retain its
native foreign payment and not compete for the new cash funding.

Local candidate adds USDT to verified RUB evidence allocation and applies the
approved residual rule only to pure RUB-funded requests. Native USDT payments
are preserved, mixed RUB/native-USDT evidence requires review rather than
being summed twice. Missing/ambiguous basis, unposted/deleted RKO, wrong supplier,
old payments and pending revisions retain safeguards. Receipt requirement stays
independent. No 1C document, existing manual link or production row is changed.

95 focused tests passed, TypeScript passed after correcting a test tuple type,
and the isolated production build passed. Changed files are
lib/procurement-small-remainder.ts, lib/procurement-ruble-payment-evidence.ts,
lib/procurement-currency-payment-evidence.ts and
tests/procurement-usdt-ruble-funding.test.ts. Candidate and durable WIP only;
not committed or deployed. Final real-data replay is awaiting sudo in Mac
Terminal; do not claim its result until tural-result.log completes successfully.

Project evidence progress remains 54.8/100 before/after this step, no stage IDs
changed. Local bugfix checks do not grant 1C writes, orders, contacts, schedules
or spending authority. Next step: finish the read-only all-plan replay; reconcile
with live 1.4.4 and recheck the current deployment branch only if release is
authorized later.

### Diagnostic baseline correction — do not rely on earlier equivalence claims

The first post-fix live probe succeeded: Tural now derives
SMALL_REMAINDER_COMPLETED, issued 500000 RUB, remaining 32.80, no review flag;
the old Tural native-USDT payment remains PAID_BY_ONE_C. Candidate read took
4602 ms / 46 GETs. No production plan versions changed.

However its comparison reported zero changed plans, which exposed a diagnostic
bug: macOS resolves /tmp to /private/tmp, so the esbuild baseline onLoad prefix
check failed and read candidate modules instead of Git a3a628e. Earlier claims
of baseline-versus-candidate equivalence are therefore NOT reliable evidence.
Source-read counts remain observations of the executed variant, not proof of
historical baseline behavior. Fixed build-probe.mjs to canonicalize the source
directory with realpathSync and use callback string replacement when embedding
bundles. Verified baseline now excludes smallUsdtRubleFundingRemainder and the
candidate includes it. Reuploaded the GET-only probe. Corrected independent
comparison is pending a new sudo prompt in Mac Terminal. Do not release until
it succeeds; record any differences explicitly.

Corrected independent comparison subsequently completed with exit 0. The only
changed plan is PAY-20261012-727873: NO_EVIDENCE -> SMALL_REMAINDER_COMPLETED.
Unexpected changes: 0; independent DB reread confirms production plan versions
unchanged. Thus the other 30 plans retain identical evidence under the actual
Git-baseline/candidate replay. This corrected run supersedes the invalid
equivalence claims above. Tural closure is a derived candidate result only;
the production application has not been released or mutated. Tests/build and
source bundle are ready for release preparation upon owner authorization.

## Approved release 1.4.5 — 2026-10-12

Owner explicitly requested release. Candidate reconciled onto deployment branch
b490bd3, preserving production 1.4.4 expense-breakdown fields/tests unchanged.
Release commit: 2d9215f1291914885ca5b712245848d325edc5c9. Runtime/test changes only
were committed; old dirty checkout, unrelated previews and local diagnostics
were not included. Package and both lockfile version fields are 1.4.5.

Pre-release verification: 109 focused tests (including the newer expense command
tests), five release-info tests and a complete production build passed. Corrected
read-only live comparison on all 31 plans changes only current Tural closure;
other 30 plans remain equivalent. No migration or 1C publication is included.
Deploy is scoped to portal-app with existing server.env and upload volume.
Previous production commit for an explicit rollback is 12563e8 (1.4.4).

Release checkout: /tmp/mobo-portal-release.CxwIKo. Source commit pushed; Mac
Terminal deploy completed successfully (DEPLOY_EXIT=0). Independently verified
server HEAD 2d9215f1291914885ca5b712245848d325edc5c9 and public release-info on both
portal.alebazia.xyz and team.mobo-opt.ru: 1.4.5, builtAt
2026-10-12T14:39:33.428Z. Docker metadata correctly reports unknown revision,
so exact commit verification uses server Git rather than inventing metadata.
Upload volume remains offonika-portal_portal-uploads mounted at /app/uploads.
Health and ADMIN/buyer HTTP routes return 200 after startup; transient startup
404 responses resolved. No migration, env change, 1C write or manual link edit.

Authenticated production Edge ADMIN UI verified after reload:
- Footer shows 1.4.5 / 12 October 17:39 Moscow.
- Waiting count decreases to 1 and history increases to 27. Tural is in history
  with actual 500000 RUB, residual 32.80, automatic completion explanation and
  unchanged 1C debt. The older native-USDT Tural row stays intact.
- Tural already has a receipt uploaded by the administrator at 16:40; its link
  remains visible. It must NOT be reported as a missing receipt. The remaining
  Needs receipts count of 2 refers to other requests. File contents not opened.
- Luxo has an Edit button, correctly disabled because Astemir's pending revision
  is awaiting approval. The bell opens that revision in the focused dialog with
  before/after date, reason and approve/reject controls; closing keeps attention
  count 1. No real approval, edit/save, upload or financial action submitted.
- Production buyer authentication was not separately exercised in this release;
  buyer behavior was verified locally with isolated test data before release.

Unrelated dirty checkout changes remain untouched. Project progress stays
54.8/100; no stage/item IDs or autonomous/1C-write permissions changed.
