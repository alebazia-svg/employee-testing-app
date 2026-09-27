# Delivery accountable cash — production release, 27 September 2026

## Current state

Owner explicitly approved commit/deploy of stage 1. Production code commit:
`7877d2e4a4e1267675b4eb3b09d8390234d7c1a6`, pushed to
`origin/design-local-updates` and deployed to `/docker/employee-testing-app`.
The visible Terminal sudo workflow completed with `DEPLOY_EXIT=0`.

- Real read-only accountable balance, exact Astemir / OFFONIKA / RUB identity.
- Buyer card remains below the complete summary / QR / USDT block.
- No owner's name or manual refresh button. Buyer text: `Запрос на пополнение отправлен`.
- Buyer data refreshes every minute while visible and on resume/network recovery.
  Overlapping reads are blocked, requests throttled, unmounted requests aborted.
  A failed read is not shown as zero and never confirms successful submission.
- One portal reminder, manual or automatic, in the existing ADMIN inbox.
  Warning at <=20,000 RUB; reserve target35,000 RUB. Partial replenishment keeps
  the existing reminder; reaching target closes the reserve reminder, not a 1C request.
- `offonika-procurement-delivery.timer` installed, enabled and active, every5min.
- ADMIN `Заявки` includes the fresh balance and amount below the reserve target.

This is NOT automatic creation/approval/payment of a 1C document. No 1C write,
cashbox selection, spending authorization, migration, environment edit or upload
change was made. Reminder persistence in the portal was part of this approved rollout.

## Verification

- Local:63 source/inbox/expense tests +27 buyer/card/preview/visible-sync tests
  +1 real isolated-PostgreSQL integration scenario passed; the additional3
  deployable panel tests also passed. TypeScript and diff checks passed.
- Exact committed production source built successfully on VPS, including type checks.
  Only `portal-app` rebuilt/restarted; prior image retained as
  `offonika-portal-rollback:before-delivery-7877d2e`.
- Post-deploy GET-only source smoke: `sourceComplete:true,persisted:false`.
  Exact unique buyer mapping verified independently before enabling the timer.
- First service execution: success, exit0. Independent DB readback: one reminder
  event and one ADMIN receipt. No Telegram queue (existing opt-in policy unchanged).
- Independent SSH readback confirmed exact deployed commit and enabled timer.
  Public login200; unauthenticated delivery API401.
- Authenticated production ADMIN UI: fresh balance2,259 RUB, gap32,741 RUB;
  one notification. Opening it navigated to the correct section and reduced the
  unread count by one. Real screenshot inspected. No unrelated notices were cleared.
- Production browser currently has an ADMIN session. Buyer interactions and
  minute-by-minute refresh were verified locally using the real read-only source;
  production buyer UI under Astemir's own login still needs that login.
- Device receipt of a PWA push is not confirmed. The existing ADMIN sender/timer
  is reused, not replaced. Inbox creation and navigation are confirmed.

Local deploy log/screenshot directory (not committed):
`/tmp/procurement-delivery-deploy-20260927.AiO2l1`.

## Next stage and safety

Installed `/expense-requests` exposes the initiator, not a reliable distinct
accountable recipient. Before automatic top-up draft/cashbox recommendation or
native1C approval, establish exact recipient/org/currency and stable request
identity/version in the integration. Extend existing ADMIN request cases, not a
second approval system. Do not infer a recipient from comments.

Rollback: stop/disable the new delivery timer, restore prior portal code/image
`633d1fd505ff626d17658098d5c810e1be1d8280`, preserve reminder history. No1C rollback
is needed because there were no writes.

Procurement evidence progress54.8→54.8; no item IDs/stages changed. Autonomous
orders, contacts, scheduling, spending and1C writes remain disabled. The next
small step is owner review of the working calendar, then a separately scoped
integration change for native request creation/approval.

## Exact code files in7877d2e

- `app/(dashboard)/admin/expense-requests/page.tsx`
- `app/(dashboard)/procurement/ProcurementPaymentCalendarClient.tsx`
- `app/(dashboard)/procurement/page.tsx`
- `app/api/procurement/delivery/route.ts`
- `components/ProcurementDeliveryAdmin.tsx`
- `components/ProcurementDeliveryAdminSection.tsx`
- `components/ProcurementDeliveryCash.tsx`
- `components/ProcurementDeliveryPanel.tsx`
- `lib/admin-inbox-data.ts`
- `lib/admin-inbox-delivery.ts`
- `lib/admin-inbox-web-push-policy.ts`
- `lib/admin-operations-view.ts`
- `lib/procurement-delivery-evidence.ts`
- `lib/procurement-delivery-policy.ts`
- `lib/procurement-delivery-reminders.ts`
- `lib/procurement-delivery-source.ts`
- `ops/systemd/offonika-procurement-delivery.service`
- `ops/systemd/offonika-procurement-delivery.timer`
- `scripts/procurement-delivery-sync.ts`
- `tests/procurement-buyer-hardening.test.ts`
- `tests/procurement-delivery-cash.test.ts`
- `tests/procurement-delivery-panel.test.ts`
- `tests/procurement-delivery-source.test.ts`
- `tests/procurement-delivery.integration.test.ts`

Unrelated supplier/advance WIP and the local review route/helper/demo files were
left uncommitted. No extra worktree was created. The old preview handoff is
historical; this document is the release source of truth.
