# Funding/date workflow — released 1.13.4, 2026-10-22

Status: **released 1.13.4; server, public metadata and authenticated ADMIN UI verified**.
Code committed as `2e20f9b` after the owner's explicit commit-only approval.
Owner approved moving from the native local preview to persistence and safety
checks. This is not an approval for production fixture edits or test messages.
Base: `origin/design-local-updates` c0a7e90 (1.13.0), separate worktree
`/Users/bela/Projects/portal-funding-integration-20261022`, branch
`codex/payment-funding-actions-20261022`. The reviewed screen remains separately
in `/Users/bela/Projects/portal-funding-review-20261022` on port 3141.

## Implemented first increment

- Existing buyer edit form detects an exact date-only edit and uses a narrow
  authenticated schedule endpoint. Amount/basis/comment changes keep the
  existing revision/approval endpoint. Date comment is optional.
- Date-only persistence preserves approval, totals, FX, order/counterparty
  identity, comments and payment metadata. It records an audit event and an
  ADMIN inbox old/new-date notification atomically. Queued buyer approval
  messages containing the old date are retired; no self-notification is created.
- ADMIN DEFER/RESUME persistence is wired into the existing detail dialog.
  Optional funding date/comment live under `oneCCashEvidence.fundingDeferral`,
  separate from approval/payment state. All existing metadata is merged, never
  replaced. RESUME clears the annotation and requires an explicit current/future
  planned date; it never silently restores an expired date. Date changes are audited.
- Reuses existing advisory transaction lock and optimistic version check.
  Rejects finished/conflicting payment evidence, pending revisions, source
  failure and scheduled 1C collection. Uses freshEvidence: this increment does
  **not** remove the synchronous 1C verification delay or claim instant saves.
- No schema migration, 1C write, production record or actual message dispatch.
  Uses existing inbox/notification types and their normal delivery mechanisms.

## Verification

- `npx tsc --noEmit`, `npm run build`, `git diff --check`: passed.
- Final expanded verification: 210 tests passed (198 shared suite, 1 server-only
  paid-notification regression, 11 React payment-history cases). Covers schedule,
  QR matching/stages, continuity, revisions, partial receipts, order selection
  and closure, reserves, forecast, loading, financial completion and viewer.
  Initial combined invocation failed at test initialization for server-only and
  CSS imports, not assertions. Rerun the notification test with
  `node --conditions=react-server --import tsx --test tests/procurement-paid-notification-regression.test.ts`;
  run history with
  `node --import tsx -e 'require.extensions[".css"]=()=>{}; require("./tests/procurement-payment-history.test.ts");'`.
  No product code or assertions changed to bypass these runner requirements.
- New actual-PostgreSQL route test on dedicated local container
  `mobo-funding-schedule-test-20261022`, localhost:55451, database
  `funding_schedule_test`. Synthetic users/plans only, schema from db push;
  auth and 1C boundary injected; real Prisma transactions and real inbox writes.
  No dispatcher credentials or subscriptions. Fixture rows removed by tests.
- Includes roles/ownership, financial-field injection, stale-version rejection,
  simulated update during verification, source outage, finished/conflicting
  payment, scheduled collection, pending revision, metadata preservation,
  date notification, old-message cancellation, and transaction rollback if
  notification creation fails. Last rollback addition independently rerun.
- Browser acceptance passed on actual calendar components in isolated mirror
  `/tmp/mobo-funding-acceptance-jRwHZh`, localhost:3145/funding-acceptance.
  Synthetic records, injected 1C boundary, real schedule/receipt routes and DB;
  no production credentials or dispatcher. Desktop and 390px mobile checked.
  Admin deferral saves/reopens; buyer date-only save preserves approval; dirty
  cancel protects input; receipt validation rejects a bad file and accepts a
  valid image. QR stage becomes `Ожидает расходника`, counter decreases.
- Independent DB readback: QR still APPROVED/42200 with one receipt, partial
  still APPROVED/100000, buyer date saved 25 October. Zero push subscriptions
  and delivery rows. Test inbox notices are isolated only.

## Release gates and remaining verification limits

1. Completed: merged latest deployment branch through 1.13.3 / db1b94a,
   preserving notification inbox and employee inspection changes. No conflicts.
2. Completed: owner explicitly approved release; AGENTS/runbook and live/branch
   versions reread; package/lock updated together to 1.13.4. Final build and five
   release metadata checks passed. Combined code previously passed 220 tests
   plus actual PostgreSQL schedule transaction verification.
3. Live QR pairing and real schedule mutations were not exercised: authenticated
   ADMIN showed six pending requests, zero waiting for payment and 32 historical
   payments. No fake production request or real business mutation was created
   for QA. Physical iPhone/PWA remains untested; responsive local checks are not
   physical-device acceptance.

## Completed QR and presentation increment

- Both calendars and forecast use persisted effective dates; undated obligations
  and financial reserves remain. Original requested date remains in details.
- Follow-up review fixed combined reschedule/deferral: effective date is the later
  of supplier-requested date and known funding date. Unknown funding remains unknown;
  the buyer cannot revoke the admin funding decision. Isolated transaction tests
  cover earlier/later buyer moves, unchanged approval/amount/metadata and explicit
  resume dates, including missing/past-date rejection and correct notice/audit.
- Detail actions/form moved above secondary financial details; duplicate foreign
  remainder removed while RUB remainder remains. Browser resume to 27 October and
  new defer to 28 October saved successfully with 300 paid / 700 remaining intact.
- Browser buyer subsequently moved the deferred request to 29 October: both role
  lists show 29 October, funding remains 28 October, approval/amounts unchanged.
  Buyer form and saved notice explicitly explain that deferral remains. Admin
  form explains why the calendar uses the later date. Mobile 390px checked with
  form actions visible. No real recipients; local DB has zero subscriptions and
  deliveries. Last fixture state: approved, 1000 USDT total / 700 remaining.

### Exact follow-up files (date/deferral consistency and compact form)

- `lib/procurement-schedule.ts`
- `lib/procurement-schedule-server.ts`
- `components/ProcurementFundingSchedule.tsx`
- `components/ProcurementApprovedEdit.tsx`
- `app/(dashboard)/admin/procurement/AdminProcurementClient.tsx`
- `app/(dashboard)/procurement/ProcurementPaymentCalendarClient.tsx`
- `tests/procurement-schedule.test.ts`
- `tests/procurement-schedule.integration.test.ts`
- This status note; source copied mechanically to the isolated acceptance mirror
  with only its existing synthetic 1C boundary retained.
- Partial list shows known remainder in its currency, never derives USDT from
  RUB. Existing details/actions retained. QR stage is not false overdue.
- Source read runs parallel with existing background reads. Match incoming
  accountable cash movement to exact linked outgoing transfer expense, both
  cashbox directions and equal amounts. Comment is QR + exact supplier token
  or exact plan code. All plans compete including cancelled/closed/other methods;
  ambiguity, duplicates, bad dates, pending changes and incomplete reads fail
  closed. No amount-only, fuzzy-name or cash-balance inference.
- Read-only production 1C confirmed outgoing comment `qr usbmag`, paired incoming
  document and both cashbox directions. Expense has no reverse document link.
  Complete 31-calendar-day cash statement: 1438 movements, not truncated. This
  proves source availability, not a production portal match or deployment.
- Approved QR confirmed transfer -> `Ожидает чека`; receipt ->
  `Ожидает расходника`. Existing supplier expense matching closes the request.
  Transfer never changes paid/issued amounts, reserves or financial completion.
  Existing planned-day QR receipt fallback and other payment methods unchanged.
- Source window 31 calendar days, limit 3000, exact amount only. Partial/combined
  transfers intentionally not inferred. Incomplete/source-failure results can
  retain explicitly labelled last-confirmed annotation; old unmatched requests
  stay unknown. No new reminders or notification kinds/quiet-hour changes.
- Additional files: calendar live loaders, ProcurementHome, ProcurementAdminList,
  ProcurementApprovedEdit, ProcurementCompletionAction, ProcurementFundingPlan,
  ProcurementFundingSchedule, ProcurementReceipts; forecast/funding-view,
  qr-funding matcher/source, list-amount, evidence type/continuity and receipt
  policy helpers; QR, continuity and funding tests.
- Root procurement evidence progress 54.8 -> 54.8, no stage IDs changed.
  Autonomous procurement/spending and 1C writes remain unauthorized.

## Original persistence files (additional groups listed above)

- `app/(dashboard)/procurement/ProcurementPaymentCalendarClient.tsx`
- `app/api/procurement/payment-plans/[id]/schedule/route.ts`
- `lib/procurement-schedule.ts`
- `lib/procurement-schedule-server.ts`
- `lib/procurement-payment-notifications.ts`
- `tests/procurement-schedule.test.ts`
- `tests/procurement-schedule.integration.test.ts`
- This note and the project-index pointer.

Unrelated worktrees and dirty files were not modified. Code commit `2e20f9b`;
documentation recorded separately. Subsequent approved deployment is below;
no manual production business-data mutations.
Main 1C bootstrap reported production435 vs Yandex436; no 1C release preparation
was performed. This mismatch does not establish a portal regression.

## Production release record

- Owner instruction: «Выпускай» (OPERATIONS APPROVAL), calendar scope only.
- Runtime/version commit: `803a0f7799e1a05c3b79dce921521aff38238790`;
  merged branch commit `b1c8dd1`; pushed normally to `design-local-updates`.
- Public version **1.13.4**, build **2026-10-22T17:33:20.297Z** (20:33 Moscow).
  Metadata revision remains null/source unknown in the existing Docker pipeline;
  exact source identity independently checked via server Git HEAD.
- Running image `sha256:e72975b706c981a7df73b78e2aa1c1d8a44bdc60b00cb6a06d8bad35e7094320`;
  state running/healthy, `/api/health` returned ok.
- Authenticated production ADMIN calendar loaded six pending requests, zero
  waiting, 32 history; existing Tural detail and approval/edit workflow controls
  remained available. Visible footer confirmed 1.13.4 / 22.10.2026 20:33 MSK.
  No real financial/date/status/receipt action submitted. The deployed QR and
  deferral transitions are covered locally, not asserted as live mutations.
- Native macOS Terminal deployed only portal-app. No migration, 1C publication,
  env edit, upload edit, test notification or other service restart requested.
- Disk preflight found 13.59 GiB free. Existing owner-approved maintenance
  verified current plus two protected rollback images, removed three eligible
  old rollback images (pre-1.13.1, pre-1.13.0, pre-1.12.1) and 8.239 GB unused
  build cache; free space reached 24.97 GiB, about 20 GiB after release.
  Removed build artifacts can be rebuilt, not restored byte-for-byte from trash.
  Containers, volumes, uploads and protected rollback images were not deleted.
- Prior image `sha256:e176e66d1aa56791db775c181d52a7d978e629502ef67466706f491c1acd0d52`
  tagged `portal-app:rollback-before-1.13.4`. Original deploy script did not reach
  its final verification marker after replacement; independent follow-up verified
  health, commit, public version, all protected image IDs, all three named volumes
  and the read-only T-bank bind mount. No second deploy was needed.
- After authenticated UI verification, the independent verification script ran
  `portal-storage-maintenance --register-verified` successfully; log marker
  `RELEASE_VERIFIED_AND_REGISTERED`. Current and two preceding images retained.
- Local-only evidence: `/tmp/mobo-funding-deploy-1.13.4.log`,
  `/tmp/mobo-funding-verify-1.13.4.log`,
  `/tmp/mobo-funding-release-1.13.4.png`; not committed.
