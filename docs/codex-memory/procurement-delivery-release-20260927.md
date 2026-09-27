# Delivery accountable cash — production release, 27 September 2026

## Current state

### Amount-entry follow-up — deployed 27 September

Owner explicitly approved deployment. Current production code:
`92ec045281e9a74b13fb9236026b61ae5391b4e3`, pushed to
`origin/design-local-updates`. Only the eight scoped code/test files below were
committed. Exact committed source built successfully on VPS; visible Terminal
workflow completed with `DEPLOY_EXIT=0`. No migrations or unrelated WIP included.
Rollback image: `offonika-portal-rollback:before-delivery-amount-92ec045`;
previous production code `c470756ee9506f1fcd5ac78086b42bcc2592e912`.
Deploy log: `/tmp/delivery-amount-deploy-20260927.Yfin4s/deploy.log`.

Post-deploy read-only source smoke passed; independent SSH confirmed the code
commit and active delivery timer. Readback: balance2259, reminderActive=true,
requestedByBuyer=false, requestDetails=null, requestStateAvailable=true.
The new amount-form text is present in the deployed client bundle. Health endpoint
ok, login200, unauthenticated deliveryAPI401. Authenticated production ADMIN page
rendered successfully and confirmed the test request remains reset. No new real
request was submitted for testing. Buyer modal/POST tested locally; production
buyer-login verification remains outstanding (browser is signed in as ADMIN).

Owner approved a prefilled editable top-up amount and optional comment. Implemented
in the existing buyer dialog and ADMIN card, without 1C writes or approval. The
suggestion is target minus the displayed balance; it is not a mandated payout.
POST validates a positive amount with kopecks and a <=500-character comment;
identity, current balance and timestamps come from the server. Cancel sends nothing.
The first amount/comment submission is immutable within the reserve cycle; retries
return its original values. Old text-only requests can add an amount once.

Versioned details are stored in a separate private audit event with unique key
`delivery:manual:<reminderId>:details`; no schema migration, duplicate inbox receipt
or extra notification. ADMIN separates requested amount / balance at submission
from fresh balance / current reserve gap. No cashier-selection or cashier-push
workflow is implemented: the owner's new idea is explicitly deferred.

Changed files for this follow-up:
- `app/api/procurement/delivery/route.ts`
- `components/ProcurementDeliveryPanel.tsx`
- `components/ProcurementDeliveryRequestDialog.tsx`
- `components/ProcurementDeliveryAdmin.tsx`
- `lib/procurement-delivery-reminders.ts`
- `lib/procurement-delivery-request.ts`
- `tests/procurement-delivery.integration.test.ts`
- `tests/procurement-delivery-request.test.ts`
- this handoff.

Owner also explicitly requested resetting her production test submission and
authorized the visible Terminal sudo workflow. One exact text-only manual marker
was removed after guarded preview and backup; its full original data is retained
in a private reset audit event. The automatic reminder and its receipt are intact.
Independent readback: requestedByBuyer=false, reminderActive=true, balance2259.
No 1C document or balance changed. Restore source on VPS (0600):
`/tmp/delivery-owner-test-request-backup-20260927.json`.
Local operation log: `/tmp/delivery-request-amount-20260927.9Eea9s/reset.log`, exit0.
This reset was performed before the separately approved amount-entry deployment.

Verification: 24 focused tests passed (including isolated PostgreSQL authorization,
concurrent POSTs, input validation, immutable retry, legacy request enrichment and
new-cycle isolation); TypeScript, production build and diff check passed. Browser
checked cancel/reopen, invalid zero, editable amount with comma/kopecks, optional
comment, real local POST, reload persistence, and the actual ADMIN display.
Local browser used fresh read-only 1C balance, isolated request persistence and
demo users. Production verification is documented above.
Unrelated WIP preserved. Procurement progress54.8→54.8; no item/stage changes;
autonomous orders, contact, schedules, spending and1C writes remain disabled.

### Earlier deployed baseline (superseded by92ec045 above)

Owner explicitly approved stage1 and continued its correction rollout. Previous production code commit:
`c470756ee9506f1fcd5ac78086b42bcc2592e912`, pushed to
`origin/design-local-updates` and deployed to `/docker/employee-testing-app`.
The visible Terminal sudo workflow completed with `DEPLOY_EXIT=0`.
Initial stage1 release was `7877d2e4a4e1267675b4eb3b09d8390234d7c1a6`.

- Real read-only accountable balance, exact Astemir / OFFONIKA / RUB identity.
- Buyer card remains below the complete summary / QR / USDT block.
- No owner's name or manual refresh button. Automatic reminder: `Требуется пополнение`.
  `Запрос на пополнение отправлен` appears only for a persisted buyer action.
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

Correction c470756:92 focused tests (64 source/inbox +27 buyer/card/sync +1 real
PostgreSQL scenario), TypeScript and production build passed. Local browser checked
automatic → button → persisted manual state → reopening; new reserve cycles do
not inherit the old manual state. Production readback after restart:
`reminderActive:true,requestedByBuyer:false,requestStateAvailable:true`, balance2,259,
one reminder and one receipt. Existing source smoke passed read-only, timer active.
Deploy log: `/tmp/procurement-delivery-status-deploy-20260927.ZpNq6G/deploy.log`.

The buyer click is a cycle-scoped append-only audit marker in the existing event
table (`procurement_delivery_request`, unique `delivery:manual:<reminderId>`),
without another receipt/push. It does not change the original automatic reminder
or its history. Exact fixed legacy manual wording remains recognized; unknown or
unavailable state never claims a buyer submission. No schema migration required.

Exact correction files:
- `components/ProcurementDeliveryPanel.tsx`
- `lib/procurement-delivery-policy.ts`
- `lib/procurement-delivery-reminders.ts`
- `tests/procurement-delivery-panel.test.ts`
- `tests/procurement-delivery-source.test.ts`
- `tests/procurement-delivery.integration.test.ts`

Correction rollback image: `offonika-portal-rollback:before-delivery-status-c470756`;
previous code7877d2e. Preserve all audit markers. The production buyer-login and
device push-delivery verification limits below still apply.

Initial release verification:

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
