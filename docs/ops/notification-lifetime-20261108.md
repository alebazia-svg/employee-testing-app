# Notification lifetime — owner-approved change, 8 November 2026

Status: implemented locally on `codex/notification-lifetime-20261108` from
`899fd16` (deployment branch after verified 1.22.2). Not deployed. No release
version reserved; determine the version again immediately before an approved release.

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
- Type checking and production build passed locally. No production installation.

Release gate: recheck current origin/live version; merge only this coherent scope,
increment patch version, then deploy only with release authorization. Verify public
release metadata/server commit and actual employee/ADMIN inbox after installation.
