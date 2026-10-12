# ADMIN attention: shift deadlines and delayed accountable issue

Status: committed locally as `edd1ca3`, isolated verification complete; not released.
Owner approved the next stage on 2026-10-12 after the notification-control review.
Production remains 1.4.1. No deployment, 1C command, migration or production-data
change was performed in this stage.

## Rules

- Reuse the shared attention list and existing durable per-device push digest.
- For current expense approvals, use the cashbox reference from the evaluation
  matching the case's current source hash. Use exactly one active WORKDAY employee
  mapping; never guess by surname. Missing/ambiguous mapping retains the usual
  unresolved task and 15/60-minute reminders, without an invented shift deadline.
- Read today's actual workday, selected end time, recorded early-finish time and
  pending cash-category tasks. Completed cash tasks and previous-day shifts are
  excluded. A cash task earlier than the request cycle is not its deadline.
- For the fixed accountable recipient, the owner-confirmed 18:00 MSK deadline
  applies on the request day. This is an operational deadline, not an assertion
  about attendance. The assigned cashier's current cash/shift deadlines also apply.
- Within 30 minutes of a deadline, raise the task and show the reason/time in the
  page and bell. Trigger one shared-summary escalation on entering the window,
  another at the deadline. Every relevant deadline has its own key; an overdue
  cash task cannot suppress a subsequent shift-end escalation.
- All escalations retain 09:00–22:00 MSK and minimum five-minute coalescing. Existing
  first repeat after 15 minutes / subsequent hourly repeats remain. No repeated
  inbox receipts; one OS notification tag. Old persisted digest states still work.
- A fresh payable/partial accountable document returns to owner attention near
  these deadlines, or after 60 minutes from the cashier task's scheduled time
  (not before today's actual shift start). The hour rule requires an existing
  non-cancelled cashier task for the current document/cashbox/employee fingerprint.
  Without that evidence the known shift/recipient deadlines still apply; no
  guessed approval timestamp is used.
- Copy asks to check issue/RKO and says full issue is not confirmed in 1C. It never
  asserts cash was physically withheld. Fresh full issue or rejection removes the
  task; reversal restores control. Unavailable source does not masquerade as delay.
- Financial states, schedules, checklists and employee push producer are unchanged.
- Deferred scope: dedicated source-freshness control and device/subscription-health
  UI. Physical delivery of the new cashier notification remains unverified.

## Concrete push content (owner approved in the same stage)

- One actionable expense: current requester, amount, document number and short
  current comment/operation; repeat is marked as a reminder and includes the
  known deadline. Read fields from the current case/source hash, not the frozen
  original event text. Missing data stays explicitly unknown.
- Buyer request: Astemir, requested amount and purpose; delayed issue uses the
  remaining amount and asks to check issue. Payment plans identify the supplier.
- Several tasks: name the newest not-yet-announced item and the highest-priority
  other item; show at most two rows and the count of the rest. A real document
  number distinguishes otherwise identical expense requests. No extra OS cards.
- A single expense opens the existing request modal via the existing detail
  redirect. A single accountable request uses its exact portal event ID to open
  the existing modal. An old link cannot open a different current request; closing
  removes the deep-link parameter. Multiple tasks open the shared attention list.
- Existing stable notification ID, leases, retries, hours and coalescing unchanged.
  Physical display of this new wording is not yet tested; no production push sent.

## Verification

- 60 focused policy/lifecycle/source-sync/native tests passed.
- Three isolated PostgreSQL integrations passed: pre-existing real producer/
  transport scenarios plus current-source cashbox mapping, task completion,
  60-minute issue delay, partial/full issue, reversal and unavailable source.
- Real producer/two mocked-device integration additionally verifies exact content,
  direct target and updated amount/comment on repeat.
- TypeScript check and isolated production build passed.
- Actual local ADMIN page: urgent issue and upcoming cash-count deadline above
  future payment; compact deadline accent; 1280px and narrow/mobile inspection.
  Verified navigation into the existing accountable modal and removal from the
  attention list on fixture-confirmed full issue (3 -> 2), then restored the open
  example for review. Fixture database only, no production subscriptions or real push sends.
- Existing two-device ADMIN physical push replacement was verified by the owner
  in an earlier stage; this change has not been physically delivered yet.

Browser verification also covered direct expense-modal opening, exact accountable
request opening, close back to the list, and an old/mismatched request link leaving
the current request unopened.

## Exact changed files

Runtime:
- lib/admin-inbox-attention-policy.ts
- lib/admin-inbox-data.ts
- lib/admin-inbox-attention-push.ts
- lib/procurement-delivery-reminders.ts
- lib/admin-inbox-deadlines.ts
- lib/admin-inbox-deadline-source.ts
- components/AdminInboxBell.tsx
- components/ProcurementDeliveryAdmin.tsx
- app/(dashboard)/admin/inbox/AdminInboxListClient.tsx

Tests:
- tests/admin-inbox-deadlines.test.ts
- tests/admin-inbox-push-detail.test.ts
- tests/admin-inbox-attention.test.ts
- tests/admin-inbox-relevance.integration.test.ts
- tests/admin-inbox-deadlines.integration.test.ts

Memory:
- docs/codex-memory/admin-attention-deadlines-20261012.md
- docs/codex-memory/decision-log.md
- docs/codex-memory/project-index.md

Unrelated primary-checkout WIP was untouched. Before release, recheck the live
version and deployment branch and allocate the appropriate new version; no
future release number has been reserved here.
