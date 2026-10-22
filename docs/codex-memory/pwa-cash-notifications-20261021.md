# PWA cash requests and notification centre — release 1.11.0

## Phase and authorization

Owner approved implementation and regression verification of the previewed PWA changes, including linkage to 1C expense requests. Owner separately approved provisional ADMIN classification when the counted gap equals pending requests. Owner conditionally approved production release on 2026-10-22 after final shift and integration checks. Released to production on 2026-10-22 as 1.11.0 / e94323a9da9074cc627a9904cfefb9297de7897c, from origin/design-local-updates. Previous runtime 35d6b51 / 1.10.6. Use current live/branch version again before a future release.

## Accepted behaviour

- Home groups receipts into one row and payable requests into another; the checklist retains its existing workflow. Receipt details and request details are separate.
- Bell opens a full-screen dated inbox. Reading changes unread status, never financial completion. Historical messages have no stale action buttons. New foreground banner lasts 10 seconds; deliberately opened inbox does not time out.
- Reuse existing ExpenseRequestAdminCase/evaluations and three-minute sync; employee polling does not write to 1C or initiate a full import. Route by explicit unique active cashbox mapping, never name similarity.
- Only cash/RUB requests with complete execution and direct posted RKO allocations qualify. Partial allocations use remaining amount; full posted execution removes the action even when 1C status is still payable. Missing/inconsistent/stale sources do not mean success.
- Preserve existing specific Astemir cash-issuance flow and exclude its request from generic payable detail/queue when identified.
- Ordinary cash recount preserves actual cash and the captured 1C balance. Only an exact gap equal to the whole pending request total can receive awaiting_documents evidence; no arbitrary subset matching, no surplus masking, no final cash-match claim.
- ADMIN shows “Ожидает оформления заявок”. Later complete linked posted RKO allocations after the count resolve this explanation; cancellation reopens it. Original balances are never rewritten. This confirms the captured difference, not the current cash balance after later sales.
- Handover/close exception, encashment, photos, schedules, existing receipt actions remain in their existing paths. No new handover bypass or new end-of-day expense gate was introduced.
- No schema/migration, 1C publication, payroll change, VPN change, or production data write.

## Verification evidence

- Read-only live 1C /expense-requests returned 5 complete rows on 2026-10-21. Liana’s 00OF-001120 (800 RUB) and 00OF-001121 (750 RUB) already had posted RKO and remaining zero. They must NOT be presented as unpaid examples.
- Production expense-sync timer is active every three minutes; last service result success/exit 0. Notification timer active; last result success/exit 0. This confirms timer execution, not each business mapping or completeness of its persisted snapshot.
- Production Prisma mapping/sync inspection was completed read-only on 2026-10-22 after the owner entered sudo in the visible Terminal; five unique employee cashbox mappings and complete persisted sync verified. No credential requested in chat.
- Isolated PostgreSQL database on 127.0.0.1:55449/pwa_cash_review_20261021, no live writes. Synthetic examples explicitly labelled; preview helpers/config remain ignored under .wip and are not runtime deliverables.
- Workday suite 153/153; surrounding cash issue, notification, closing, photo and visible-sync suite 42/42; expense-request suite 40/40 (test-only ADMIN_INBOX_TELEGRAM_ENABLED=1, mocked sender); final policy/recount/integration suite 13/13.
- Integration traverses actual persisted sync -> employee snapshot -> queue -> read -> partial RKO -> outage -> posted RKO -> reversal, including unchanged original counted values and evidence reopening.
- TypeScript and production build verified locally. Build uses a separate mirror to avoid disrupting the visible Next dev app.
- Interactive checks: receipt/request separation, cancellation/re-entry without task completion, factual count save, read-but-still-actionable request, historical message without action, admin-reply link to correct receipt, inbox remains open, automatic disappearance after posting, retained request plus warning during source outage. Mobile 390x844 reviewed. ADMIN pending explanation checked on real day card.

## Before release / practical limits

- Production employee-to-cashbox mapping and persisted sync completeness verified. Authenticated post-deploy smoke passed; real-phone push delivery has not been independently tested.
- Actual browser history is bounded to 30 days (plus active unread) and 200 query rows / 100 displayed after thread grouping.
- Sources older than six minutes are not used to explain cash gaps. Old outstanding requests outside sync coverage remain unknown; do not silently discard them.
- A posted RKO with a document date at/before the captured recount is deliberately not accepted as new proof. Such ambiguous/backdated cases require review; no invented posting timestamp.
- The pending explanation is a correlation until documents confirm it, not proof that money was physically handed over.
- The local preview originally used base 1.10.6. Release package and lock versions are now consistently 1.11.0, rechecked against live 1.10.6 and origin/design-local-updates immediately before push.
- Original dirty repository and earlier gallery worktree were left untouched.

## Changed product/test files

- `app/(dashboard)/admin/workday/AdminShiftControlDetails.tsx`
- `app/(dashboard)/admin/workday/page.tsx`
- `app/(dashboard)/employee/EmployeeTodayClient.tsx`
- `app/(dashboard)/employee/WorkdayNotificationsClient.tsx`
- `app/api/employee/shift-control/tasks/[id]/route.ts`
- `app/api/employee/workday-notifications/route.ts`
- `app/globals.css`
- `components/workday/EmployeeAttentionPanel.tsx`
- `components/workday/EmployeeNotificationInbox.tsx`
- `lib/cash-expense-evidence.ts`
- `lib/cash-expense-reconciliation.ts`
- `lib/cash-recount-control.ts`
- `lib/employee-attention-snapshot.ts`
- `lib/employee-attention.ts`
- `lib/employee-expense-notifications.ts`
- `lib/employee-expense-policy.ts`
- `lib/employee-expense-snapshot.ts`
- `lib/employee-notification-snapshot.ts`
- `lib/workday-notification-thread.ts`
- `lib/workday-notifications.ts`
- `tests/cash-outbox-lifecycle.test.cjs`
- `tests/employee-expense-lifecycle.integration.test.ts`
- `tests/employee-expense-policy.test.ts`
- `tests/employee-handover-photo-flow.test.cjs`
- `tests/procurement-cash-issue.test.ts`
- `package.json`
- `package-lock.json`

## Release preparation — 2026-10-22

- Live and deployment branch independently checked at 1.10.6 / 35d6b51; candidate 1.11.0 is the approved feature release, with no schema or 1C changes.
- Production read-only Prisma preflight verified five unique active employee cashbox mappings, zero unmapped retail/wholesale employees, and complete three-minute expense sync.
- Preflight found five historical requests fully paid through other or multiple cashboxes. Fully allocated paid obligations now retire regardless of which cashbox paid; own-cashbox proof remains mandatory for pending/partial reconciliation and confirmation of a counted shortage. Replayed the captured live data through the corrected policy: all five employee snapshots ready. No production records rewritten.
- Request action shows the count of payable requests with outstanding allocation, excluding pending requests and the separately handled native cash-issuance request. Verified 2, 1 and no row at zero in actual PWA.
- Current checks: workday 153/153, surrounding lifecycle/photo/cash-issue/policy 31/31; expense policy including mixed-cashbox completion 6/6; isolated persisted expense lifecycle 1/1; isolated close-decision integration 10/10 (initial old test schema refreshed locally before rerun). Additional cash-input/recount/visible-sync/handover tests 21/21; release-info 5/5; final TypeScript and production build for 1.11.0 passed. Production post-deploy checks are recorded below.
- Rollback source before release: server commit 35d6b51ee018e8ddc60df6e7b3f7fc4255329421, running image sha256:b702f6d9d2c52ab179ee8091bb53515a9795b6e2d60b0643a6f6c7733bc4a84f. Preserve tagged image and all existing upload/runtime mounts.

## Production verification — 2026-10-22

- Server runtime commit independently read over SSH: `e94323a9da9074cc627a9904cfefb9297de7897c`. Deployment branch received the exact runtime commit by fast-forward push.
- Public release-info: 1.11.0, builtAt `2026-10-22T06:38:47.320Z` (09:38 MSK). Revision remains null/source unknown under the existing Docker build mechanism; commit checked independently, not inferred. Public health HTTP 200; container healthy.
- Replacement image: `sha256:61fcdb9ae8ed1743225a88f6e41dedeb8cc0e8bac7bd1cf71394338ddb7fc4d2`. Previous 1.10.6 image `sha256:b702f6d9d2c52ab179ee8091bb53515a9795b6e2d60b0643a6f6c7733bc4a84f` tagged `portal-app:rollback-before-1.11.0`. No migrations; prior runtime remains schema-compatible. Build/restart serialized with shared maintenance flock; only portal-app restarted.
- Authenticated production ADMIN footer shows 1.11.0. In administrator employee-preview, Liana retained active shift started 08:55 and checklist 1/3. Actual cash dialog opens and cancels without task completion. New bell inbox opens; historical handover message has no completion action. PWA About displays 1.11.0 / 22.10.2026 09:38 MSK. No employee shift/cash data or real payment was submitted for testing.
- Expense sync and workday notification service results success/exit 0 after deployment. Physical-phone push delivery remains untested; no synthetic production notification sent.
- Screenshot: `/Users/bela/.codex/visualizations/2026/10/06/01a1102c-dd8a-7d23-b958-f682a7781949/pwa-production-1.11.0.jpg`.
- Initial verified-image registration failed because the registry referenced missing 1.10.5 image `sha256:ea5fb9a495c66fe9615c357f98ec1e7120427eaae7edcf631ec5c194f55158a1`. Current and immediate rollback image exist and their package versions were independently checked by network-isolated containers. A follow-up read-only recovery check found the second older registered image 1.10.4 (`sha256:8ddcf13f22dcb35884bb37cdb0a9c2fd0a72fdf904fee01725ef5d19a277b95c`) missing too. Recovery stopped before any registry write. At that point verified-image registration remained pending and maintenance failed closed because current was not registered; resolved by the recovery below. No pruning or broad cleanup performed. Disk has 30 GiB free. Exact previous 1.10.6 rollback is available, but the policy of two preceding verified releases is not satisfied. Owner separately approved rebuilding 1.10.5 as a reserve without switching production on 2026-10-22 after explanation. Recovery completed successfully as recorded below.
- Original dirty checkout, older gallery worktree and server pre-existing untracked `.rollback/` left untouched.

## Approved reserve recovery — 2026-10-22, completed

- Owner explicitly approved recovery after the explanation of current 1.11.0, immediate rollback 1.10.6 and missing older reserve. No production rollback or new runtime release was authorized or performed.
- Rebuilt unchanged 1.10.5 source commit `138f1cf2bb60b07e8425dca662cfe9138bec4f3d` from `git archive` in a separate temporary build directory, with the original receipts build flag. Image is a **rebuilt reserve**, not the vanished byte-identical artifact; fresh build time `2026-10-22T06:53:59.866Z`. No application source or package version changed.
- Restored image: `sha256:515c30cdb0a1354ecec3d47c20952b8078569574c1d25867a8070824c2c23000`, tagged `portal-app:rollback-before-1.10.6`; source revision is also recorded in its OCI label.
- Build/type validation passed. Prisma schema/migrations have no diff between reserve source and current runtime. Reserve was started against disposable PostgreSQL on an internal-only Docker network, with generated temporary credentials and no production mounts, credentials or 1C access. Health, release-info 1.10.5, login HTML/client asset, employee/admin login redirects, and both employee/admin unauthenticated API 401 checks passed. The first smoke incorrectly expected an HTTP 3xx from streamed Next.js pages; corrected assertion verified explicit login redirect meta tags plus API denial. No application fix was needed.
- Temporary app, temporary PostgreSQL (tmpfs data), network and credential files removed after checks. No production migrations, real data writes or production container restart. Full business workflows were not replayed against production for a reserve restoration.
- Registry backup: `/var/lib/offonika-maintenance/verified-images.before-reserve-recovery-20261022.json`. Updated verified registry contains current 1.11.0, original 1.10.6 rollback and rebuilt 1.10.5 reserve. Normal `portal-storage-maintenance --register-verified` succeeded after releasing the build lock; a separate maintenance dry run passed with **24.26 GiB free**. No pruning/cleanup applied. Timer remains active. Cause of the earlier missing images is not established; do not attribute it to this release without evidence.
- Production container identity stayed `3e242d4694661d9bb0de62a53c23909982b60bee384a4b3de3dcfe05e8536fbb`; image, runtime commit `e94323a`, public version 1.11.0 and public build timestamp stayed unchanged. Independent public health returned `{ok:true}` and server tracked files remained clean, with pre-existing `.rollback/` untouched.
- Local operation evidence: `/tmp/mobo-restore-reserve-1.10.5.log` (build/first smoke), `/tmp/mobo-verify-reserve-1.10.5.log` (final smoke, registration, dry run, exit 0).
