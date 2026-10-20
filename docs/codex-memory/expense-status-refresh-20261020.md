# Expense approval status refresh — local candidate, 2026-10-20

## Scope and status

Owner approved speeding up removal of expense approval tasks after approval in
1C, without increasing notification noise or materially increasing source load.
Implemented and verified locally on `979cd8c` (deployment branch documentation
head following production runtime `574ff73`, version 1.10.1). **Not deployed.**
Local code commit: `921d101` on `codex/expense-status-refresh`.
Release/version must be reconciled with the current deployment branch and live
release metadata immediately before an approved production release.

No Prisma schema/migration, 1C extension, account/credential, reminder interval,
business priority, employee issuance workflow or unrelated System UI changes.
Existing unrelated dirty worktrees were left untouched.

## Mechanism

- Full 31-day synchronization stays every three minutes. New requests still
  arrive through that full synchronization; this change accelerates retirement
  of existing pending approval tasks, not discovery of new requests.
- Read existing live pending cases through the existing native-card GET.
  All devices/processes share one PostgreSQL advisory lock and a persisted
  60-second cooldown. No pending cases means no 1C calls or new sync-run rows.
- Each background batch has at most ten reads, six seconds of network-loop
  budget and a two-second timeout per read. Larger queues rotate. Slow/failed
  reads leave tasks active; full synchronization remains the fallback.
- Run from live ADMIN inbox reads and existing notification runners before
  Telegram claim / web-push dispatch. No extra scheduler or service. Calls to
  loadAdminInbox with an explicit historical/test `now` skip source refresh;
  production dispatch runners explicitly refresh before their snapshot.
- Status-only runs use `status_refresh`, sourceComplete=false. They must never
  masquerade as successful full-source health checks. Pending reads do not
  update lastSeenAt, so normal bulk metadata updates are not starved.
- After portal commit (including idempotent committed preview), independently
  reread that exact 1C document, then refresh mounted bell/inbox via an event.
  Refresh failure must not turn a successful financial command into a failure.
- Only known, validated statuses and matching refs retire a task. CAS protects
  concurrent changes/reopened cycles. Bulk snapshots carry their fetch start
  time and lock each existing row before comparison, so an older bulk response
  cannot resurrect a newly resolved task. History is preserved.

## Expected timing and cost

Healthy small queues: background retirement is normally around a minute; an
already open screen can add its existing 60-second refresh interval. This is
not a hard deadline. Slow 1C, contention or larger queues use subsequent ticks
or the three-minute full-sync fallback. Focus/visibility refresh is retained.
Approval through the portal triggers the exact-case refresh immediately.

Read-only production sampling before implementation: 119 full-period rows,
two pages, about 5.19 seconds / 1.81 MB; one native-card read about 0.18 seconds /
17.4 KB. These are individual samples, not a load test or an availability SLA.
At the cap, there are at most ten additional native reads per shared background
minute, not ten per open device. Explicit owner commands may add exact reads.

## Verification

- 53 unit tests passed across sync/lifecycle/attention/visible refresh and native
  command/transport/source timeout coverage.
- Eight integration scenarios (nine TAP results including parent) passed on
  disposable local PostgreSQL: no pending work; independent-client locking and
  cooldown; unchanged pending reads; offline/unknown/mismatched responses;
  inbox retirement/history/stale bulk/reopened cycle; concurrent newer update;
  explicit-command refresh; bounded rotating queue.
- `npx tsc --noEmit`, `npm run build`, `git diff --check` passed. Final typecheck
  includes the Telegram claim hook added after the app build.
- Authenticated actual app at localhost:3160, isolated DB and mock 1C: pending
  item and bell count 1 automatically became 0 after source status changed to
  payable, without manual reload. History retained the item. No production
  write or real push sent. Screenshots are under
  `/Users/bela/.codex/visualizations/2026/10/20/expense-status/` (before, after,
  history). No layout changes were made.
- Empty local migration replay hit an existing TerminalFiscalReviewParticipant
  migration dependency/order issue. Only the disposable test DB was initialized
  with `prisma db push`; production DB and migration files were untouched.
- Integration test requires EXPENSE_STATUS_INTEGRATION=1 and guards the exact
  isolated DB host/port/name (127.0.0.1:55456/expense_status_test). Normal suites
  skip it. Run with Node `--conditions=react-server --import tsx --test`.

## Changed runtime and test files

- `lib/expense-request-status-refresh.ts` (new)
- `lib/expense-request-source.ts`
- `lib/expense-request-admin-sync.ts`
- `lib/expense-request-admin-client.ts`
- `lib/admin-inbox-data.ts`
- `scripts/admin-inbox-web-push-delivery.ts`
- `scripts/admin-inbox-telegram-delivery.ts`
- `app/api/admin/expense-requests/[id]/native/route.ts`
- `app/(dashboard)/admin/expense-requests/[id]/native/ExpenseNativeClient.tsx`
- `components/AdminInboxBell.tsx`
- `app/(dashboard)/admin/inbox/AdminInboxListClient.tsx`
- `tests/expense-request-admin-sync.test.ts`
- `tests/expense-request-status-refresh.integration.test.ts` (new)

## Release / rollback

Production approval and verification remain pending. Before release, recheck
live source/version, follow AGENTS.md and VPS runbook, increment the appropriate
patch version and preserve the previous image. No schema rollback is needed.
Restoring the prior runtime restores the previous refresh behavior; targeted
sync-run rows are not successful full syncs and are safe to retain.
