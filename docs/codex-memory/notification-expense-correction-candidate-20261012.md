# Notification and expense form correction — production 1.4.6, 2026-10-12

## Status and scope

Released with explicit owner approval as 1.4.6 on 2026-10-12 at 18:34 MSK.
Production source: `2db322af7bcd9ada283f35ec6e73f01c57fddca8`. Before release,
reconciled the concurrently published 1.4.5 and preserved its notification
detail dialogs and procurement changes (merge `97708f3`).
Implementation commits: `95ed76f` (notifications), `4da02e2` (expense UI). No production DB,
1C, schema, PWA cashier, Telegram bot or service-worker changes. Preserve the
separate primary checkout's unrelated dirty work.

Owner approved fixing false old funding reminders, notification noise and the
existing expense form. Similar-history article suggestions are an IDEA only.
Renaming the technical 1C writer was a QUESTION only; neither was implemented.

## Released policy

- Unavailable, stale or ambiguous native delivery evidence is a System item,
  never a fresh request to fund the same old request. Fresh native full issuance
  retires the funding request. Pending and delayed cashier issuance remain
  distinct actions. This changes the previous unknown-as-financial-attention
  fallback in this release.
- Summary state remembers previously sent IDs and urgency signals (bounded to
  2048), so temporary disappearance does not make the same item NEW again.
- Existing 09:00–22:00 owner window, 15-minute initial reminder, then hourly
  repeat and five-minute burst limit remain. Short outages/recoveries do not
  push. Known unrecovered problems older than an hour aggregate into one lower
  priority warning, repeated at most once per Moscow day in technical-only flow.
- A last successful complete expense sync older than an hour raises a source
  freshness warning. No successful sync history does not invent an outage.
- Active system details, including neutral unknown delivery evidence, are
  visible under System. Synthetic warnings do not call receipt-read endpoints.
- Reminder deadlines still drive the existing policy. Their explanatory labels
  are omitted from inbox rows and bell cards; visible cards retain identity,
  business action, amount and date without repeated status/category labels.

## Expense form

Read-only audit covered 124 requests over the last 30 days, not all historical
requests. Existing native operation-specific rules and edit contract were read.
Form shows recipient, cashbox, manager, operation, purpose and relevant payment
breakdown. Missing review fields are highlighted. Empty generic analytics are
hidden; populated extra fields are retained. Conditional fields can be revealed
for native validation. Recipient/cashbox/operation remain read-only because the
current native edit API does not allow them. Native preview remains authoritative
for conditional required fields and final status must be К оплате.

## Queue presentation approved by owner

The compact list retains applicant/amount, purpose, cashbox, date and one status.
Field omissions, queue age, document number and instructions belong in the modal.
Desktop column headings align with both normal and accountable rows; mobile stacks
those same facts. Copper hover/focus backgrounds are shared by both row types.
Payable native cards always show execution, including zero issued, so the owner
can distinguish approval from actual cash issuance.

## Verification and limits

After reconciling 1.4.5, 50 focused unit tests, four isolated PostgreSQL integration
scenarios and five release-info tests passed. TypeScript, local production build
and the actual VPS production build passed; final text refinements were checked
in the real local UI. Notification detail dialog opening/closing was also checked
locally after the merge.
Local modal: choose articles, preview differences, continue editing, cancel/reset;
mobile width 390 and desktop width 1920 checked. System summary navigation and
actual bell → exact delivery request → modal → close/URL reset verified.
The native edit preview is a local fixture, not a new end-to-end 1C write test.
Push transports were mocked; no new physical-device delivery test was sent. Prior
physical tests do not substitute for testing this released build. OS cards may
remain until a replacement push or app-open reconciliation. Legacy Telegram queue
was inspected but not changed. Source-health warning assumes persisted down state
until recovery; it is not proof of continuous network outage. Intermittent unknown
native evidence is inspectable in System but has no per-request outage timer.

Local preview fixtures and fake command routes stay in /tmp, never release them.

## Production verification and rollback

- Previous live version: 1.4.5, commit `2d9215f1291914885ca5b712245848d325edc5c9`.
- Released runtime/server commit: `2db322af7bcd9ada283f35ec6e73f01c57fddca8`.
- Public release metadata on both `team.mobo-opt.ru` and `portal.alebazia.xyz`:
  version 1.4.6, builtAt `2026-10-12T15:34:00.152Z`. Metadata revision is null
  and source unknown; commit identity was independently verified over SSH.
- Previous image: `sha256:210f0e4f189355f42e26d45382a4e17c38ccfc7fbebac56ec83e36c530c1e7a0`.
- Replacement image: `sha256:3e60ab585bbecd30e3ec616df27ff1ed815134562d4ce8432a14732f57dddbcc`.
- Preserved rollback tag: `offonika-portal-attention-rollback:pre-1.4.6-20261012`.
  No schema/migration, Dockerfile or compose changes; rollback remains schema compatible.
- Only portal-app rebuilt/restarted using server.env. Container healthy; public
  health endpoint returned ok. Existing uploads, procurement snapshots and T-Bank
  runtime mounts retained. Expense sync and inbox timers both active. Server tracked
  tree clean; pre-existing untracked `.rollback/` retained.
- Authenticated production ADMIN visibly shows version 1.4.6 and 18:34 MSK build.
  Attention contained one aggregate long-outage warning and no old Astemir funding
  request. System counter showed eight items. These are observed states at verification,
  not a claim that all underlying integrations have recovered.
- Real Chechenova request 00OF-001095 / 1,200 RUB opened read-only in the modal:
  recipient Доставка, cashbox Касса Чеченова, operation Прочий расход ДС, DDS
  Прочие платежи, expense article Доставка, department and execution 0/1,200.
  Existing native status К оплате correctly remains in the issue queue. No approval
  or financial write was performed during verification.
- Screenshots: `production-146-inbox.png` and `production-146-expense.png` in
  `/Users/bela/.codex/visualizations/2026/10/12/cash-issue/`.
- Physical iPhone/computer push after this release, a new end-to-end native write,
  and separately authenticated buyer/employee production screens were not tested.

## Exact changed runtime and test files

- `app/(dashboard)/admin/expense-requests/[id]/native/ExpenseNativeClient.tsx`
- `app/(dashboard)/admin/expense-requests/page.tsx`
- `app/(dashboard)/admin/inbox/AdminInboxListClient.tsx`
- `components/AdminInboxBell.tsx`
- `components/ExpenseRequestDialogRow.tsx`
- `components/ExpenseRequestsList.tsx`
- `components/ProcurementDeliveryAdmin.tsx`
- `lib/admin-inbox-attention-policy.ts`
- `lib/admin-inbox-attention-push.ts`
- `lib/admin-inbox-data.ts`
- `lib/admin-inbox-deadlines.ts`
- `lib/admin-inbox-source-health.ts`
- `lib/expense-request-form-view.ts`
- `tests/admin-inbox-attention.integration.test.ts`
- `tests/admin-inbox-attention.test.ts`
- `tests/admin-inbox-deadlines.integration.test.ts`
- `tests/admin-inbox-relevance.integration.test.ts`
- `tests/admin-inbox-source-health.integration.test.ts`
- `tests/admin-inbox-source-health.test.ts`
- `tests/expense-request-form-view.test.ts`

- `package.json`
- `package-lock.json`
