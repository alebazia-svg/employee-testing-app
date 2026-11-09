# Notification lifetime — owner-approved change, 8 November 2026

Status: released and verified **1.22.5**, 9 November 2026. Server/runtime source
`875ac8c27ca7ba2d3fc5406acbc4d439f645fdfa`; public build time
`2026-11-09T10:08:12.818Z` (13:08 MSK). Implemented originally from `899fd16`, then
rebased without conflicts onto the live 1.22.4 source `d72fc57`. The notification
implementation files had no intervening changes. Owner explicitly authorised
installation on 9 November after the local acceptance report.

Owner decision: informational messages move to History after 24 hours; actionable
notifications remain current until completion or withdrawal of the requirement.

## Exact informational inventory

The following employee messages receive a maximum 24-hour New lifetime from
`sentAt` (publication in the portal, not proof that push was received):

| Kind | Message / event |
| --- | --- |
| `procurement_payment_approved` | Payment / amended payment approved; related date/funding decision |
| `procurement_payment_cancelled` | Payment cancelled |
| `procurement_payment_updated` | ADMIN changed a payment, funding date or deferral |
| `procurement_receipt_added` | ADMIN added a payment receipt for the employee |
| `workday_closed_by_admin` | Shift completed by ADMIN |
| `workday_shift_extension` | ADMIN confirmed shift extension |
| `payroll_days_decision`, fingerprint ending `:approved` | Payroll days confirmed |

Existing reading and business-state closure can move information to History
earlier. They are not delayed to 24 hours. Retry timestamps do not extend lifetime.
An unsent queued message has no publication lifetime yet. Unknown/malformed/future
publication times are protected from guessed expiry. No title-text classification.

## Actions protected from age and reading

Primary tasks linked by `taskId`, `issueId` or `reviewId`, plus:

- `procurement_payment_needs_changes` — correct the payment request;
- `procurement_qr_check` — supply/check payment requisites;
- `procurement_cash_issue`, `procurement_collection_ready`,
  `procurement_delivery_ready`, `employee_expense_payable` — current cash/expense work;
- `schedule_fill_request`, `schedule_replacement_request`,
  `schedule_replacement_digest`, `schedule_week_fill_request`,
  `schedule_near_fill_request` — current schedule requirements;
- `workday_end_reminder`, `workday_close_exception_decision` — current shift action.

The existing source-backed lifecycle remains authoritative. Completed, cancelled,
superseded or no-longer-applicable requirements still close under its current
rules. A source outage must not be treated as completion. Reading is still recorded
but no longer removes an unfinished primary task from New or the badge. Its unread
dot disappears after reading. Discussion replies retain individual read behavior;
they do not multiply the primary task indefinitely. Active actions bypass the
recent-history query/output limits, preserving chronological order.

## Preserved baseline / exclusions

- ADMIN inbox business-attention lifecycles, decisions, messages from employees,
  receipt-processing events, system incidents and push policies are unchanged.
  They are not indiscriminately classified as 24-hour information.
- Unknown types, rejected payroll decisions and discussion replies receive no new
  time-based expiry. Their existing handling remains in place.
- Financial matching, 1C, payment/cash documents, receipt/requisites files and
  their bindings are unchanged. No schema migration or business-data backfill.
- History keeps the existing last-30-days view. No notifications are deleted.
- Expiry uses existing inactive-notification storage (`cancelled`, push cancelled,
  retry cleared), preserving `readAt`, `sentAt`, body, fingerprint and source IDs.
  Read-only employee preview projects the same lists without writing these states.
- Existing quiet hours, retries, repeat/daily policies and subscription settings
  remain. Expired information cannot start another retry. Badge calculation includes
  opened unfinished actions while duplicate-push suppression still uses unread state.
- No new UI layout, buttons, notification texts, test pushes to real people or
  production changes. The unread marker now follows actual reading independently
  of action relevance.

## Verification

- 117 focused/neighboring tests passed: notification lifecycle, inbox, thread,
  paid-plan, push and ADMIN policy; requisites, receipts, cash morning,
  workday/schedule. Two PostgreSQL integration scenarios also passed (119 total).
- Two real PostgreSQL integration scenarios, isolated container
  `mobo-notification-lifetime-tests-20261108`, loopback port 55519, test DB only:
  exact New/History projection; read-only no-write comparison; expired information;
  preserved read/identity evidence; opened 40-day-old task; actual completion;
  205 newer history rows cannot displace an unfinished action; real dispatcher
  cancels an expired retry and includes opened work in the badge. Push provider
  replaced by a capture stub; unrelated producers isolated, no external sends.
- Two old morning-test failures reproduced on clean `899fd16`: stale fixtures lacked
  the end-reminder producer isolation, sent status/date and current source import.
  Fixtures updated to the existing production contract; assertions retained,
  including one morning delivery / one badge and exact read cutoff.
- Type checking and production build passed locally and in the server image.
  Rebased candidate: 117 focused tests, two PostgreSQL integration scenarios and
  five release-metadata/version tests passed.

## Installation and independent readback — 9 November

- Native macOS Terminal launched the reviewed narrow transient systemd worker;
  owner entered the server password there. Detached worker/log monitoring continued
  through installation and final registration. `RELEASE_EXIT=0`, service result
  success; running app healthy. No other chat was messaged.
- Existing release/storage flock, exact source/file allowlist, migration identity,
  available disk and all three prior verified images checked. Previous 1.22.4
  image independently booted with no network, production mounts or production env.
  Only `portal-app` built/recreated. No source service interruption, migrations,
  environment changes, notification timer changes or cleanup commands.
- Public metadata, exact server SHA and authenticated ADMIN footer confirmed
  1.22.5 / 9 November 13:08 MSK. Protected ADMIN/employee/procurement routes returned
  200; this was supplemented by authenticated UI checks, not treated as sufficient
  business evidence alone.
- Before/after/final preservation checks retained all 51 payment-plan business
  projections, all 31 receipt/requisites rows, original notification identity/copy
  for 1,634 rows and all 1,634 existing read markers unchanged. All 328 mature upload
  contents retained identical SHA-256 hashes and sizes. Tax-warning text/dates
  retained for four existing events. Source evidence/cache fields were not used
  to claim whole-row immutability of payment plans.
- Configuration/payroll hashes unchanged: users10, templates9, cashbox mappings5,
  payroll runs10, manual inputs79, classification rules79, supplier rules49,
  adjustments15, saved employee results136. Workdays164 and cash operations107
  before/after. Applied migrations, server.env and mount parameters unchanged.
- ADMIN retained four unresolved FNS document requests. Astemir's authenticated
  read-only preview retained New0 and the existing last-30-days History (including
  approval and receipt-added messages). No employee notification was acknowledged,
  business task completed, or synthetic push sent during production verification.
  Physical iPhone PWA was not operated for this release.
- The System section still reports pre-existing Platforma OFD timeout (9 November
  13:04, before this install at13:14) and AUSN update warning (8 November13:06).
  This notification-only release does not claim those sources recovered or hide
  their warnings. App startup diagnostics contained zero uncaught/Prisma/network/
  server500 signals in the captured post-start window.
- Verified-image registration completed after independent UI/public checks and
  release of the parent lock. Current plus two verified reserves exist. Current
  image `sha256:9e505019325f1da68727a1413c3b5eff20dfb77cf5428bf3765dbf28797ea048`.
  Free disk15.32GiB at completion. No unfinished installation/registration step.

Private verification scripts/logs and hash-only facts are under
`/tmp/mobo-notification-1.22.5` locally and `/home/bela/mobo-notification-1.22.5`
on the server; not committed. Root preservation directory:
`/root/mobo-notification-1.22.5-20261109`.

## Exact changed files versus live 1.22.4

- `components/workday/EmployeeNotificationInbox.tsx`
- `lib/employee-inbox-view.ts`
- `lib/employee-notification-snapshot.ts`
- `lib/notification-lifetime.ts`
- `lib/workday-notifications.ts`
- `package.json`, `package-lock.json`
- `tests/notification-lifetime.integration.test.ts`
- `tests/notification-lifetime.test.ts`
- `tests/procurement-morning-notifications.test.ts`
- `tests/procurement-paid-notification-regression.test.ts`
- `tests/workday-notification-lifecycle.test.ts`
- This scoped operations record (subsequent installation notes are docs-only).
