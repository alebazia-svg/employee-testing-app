# ADMIN attention relevance — candidate, 2026-10-12

Status: implemented and verified locally; code commit `983a188`; NOT released. Production remains 1.4.0
(runtime 68e374b). No new release version allocated. Deployment requires owner
approval and a fresh version/branch/live check. No schema, 1C, environment or
production business-data changes.

## Approved owner intent

Urgent expense/accountable decisions must reach the owner without being buried
under technical incidents, past-shift encashment requests or future payment plans.
Read is not resolved. Extend the existing shared inbox/digest, not a new mechanism.

- Expense/accountable/cash-operation decisions first; newest first within priority.
  Old unresolved money decisions remain available.
- Pending supplier-plan approvals and proposed changes enter attention one Moscow
  calendar day before planned payment, and remain overdue until decided. All plans
  remain in procurement. The earlier existing/proposed date applies to revisions
  until the proposed postponement is approved. Missing dates remain actionable.
  This is the approval queue, not a new reconciliation of already approved payments.
- Approved encashment exceptions leave attention immediately; pending encashment
  exceptions from past shift dates remain in history, without inventing approval,
  changing financial carryover or claiming actual encashment. Other closing blockers
  retain their existing behavior.
- A fresh linked accountable request ready for collection leaves owner reminders:
  cashier issue remains in expense requests until native RKO evidence closes it.
  Waiting, review or unavailable native evidence stays visible to the owner.
- Same queue powers bell, page, badge and push. Technical incidents stay in System.
- Existing 09:00–22:00 MSK shared summary: new work on next dispatch, at least five
  minutes between summaries; first repeat after 15 minutes, then hourly. One OS
  notification tag and durable per-device delivery record, no repeated inbox rows.
- With only unchanged planned approvals remaining, repeat once next Moscow day,
  not hourly. A newly actionable item can trigger the normal five-minute rule.
- The existing 22:00–23:00 closing channel now checks encashment relevance too.

## Evidence

- 53 focused policy/lifecycle/source-sync/native tests passed. The source-sync
  Telegram fake-DB tests require ADMIN_INBOX_TELEGRAM_ENABLED=1; without that test
  flag two queue assertions fail as expected, with the flag all pass.
- Two real isolated PostgreSQL integration scenarios passed: actual expense-sync
  and buyer-request producers, two mocked push endpoints, first send, read without
  resolution, 15/60-minute repeats, stopped repeats, native payable/full issue and
  revoked/unavailable approval, delayed planned reminders, postponed revision,
  past/approved encashment, retained history, 210 technical events, batch plans,
  transient failure on one device, retry and concurrent lease recovery.
- npx tsc --noEmit and isolated npm run build passed.
- Actual local UI on isolated cash_issue_demo_20261012: 390px mobile and 1280px
  desktop, 3 matching attention items in page and bell; future plan and old/approved
  encashment absent from attention but retained in history. Reading history keeps
  3 active tasks. Resolving the demo tasks leaves zero, with System still separate.
- Read-only VPS verification 2026-10-12: expense-request-sync every 3 minutes;
  admin-inbox-telegram timer every minute invokes the web-push sender after its
  Telegram queue. Both latest services Result=success / ExecMainStatus=0.
- Real iPhone/computer receipt and single-card replacement were confirmed by the
  owner for the preceding ADMIN push release. This candidate uses mocked provider
  transport in isolation; no new physical-device send was performed in this task.
  Healthy timers do not prove delivery of every individual push.

## Changed runtime files

- app/(dashboard)/admin/inbox/AdminInboxListClient.tsx
- app/(dashboard)/admin/inbox/page.tsx
- app/(dashboard)/admin/workday/close-exceptions/[id]/page.tsx
- components/AdminInboxBell.tsx
- lib/admin-inbox-attention-policy.ts
- lib/admin-inbox-attention-push.ts
- lib/admin-inbox-data.ts
- lib/admin-inbox-web-push.ts
- lib/admin-operations-view.ts

Tests:
- tests/admin-inbox-attention.test.ts
- tests/admin-operations-view.test.ts
- tests/admin-inbox-relevance.integration.test.ts

No unrelated dirty files were changed. The primary project checkout is untouched.
