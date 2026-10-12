# Notification and expense form correction — local candidate, 2026-10-12

## Status and scope

Prepared in `codex/expense-requests-release` after production 1.4.4. NOT deployed;
version is intentionally unchanged pending an approved release.
Local code commits: `95ed76f` (notifications), `4da02e2` (expense UI). No production DB,
1C, schema, PWA cashier, Telegram bot or service-worker changes. Preserve the
separate primary checkout's unrelated dirty work.

Owner approved fixing false old funding reminders, notification noise and the
existing expense form. Similar-history article suggestions are an IDEA only.
Renaming the technical 1C writer was a QUESTION only; neither was implemented.

## Candidate policy

- Unavailable, stale or ambiguous native delivery evidence is a System item,
  never a fresh request to fund the same old request. Fresh native full issuance
  retires the funding request. Pending and delayed cashier issuance remain
  distinct actions. This changes the previous unknown-as-financial-attention
  fallback only when this candidate is released.
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

47 unit tests and four isolated PostgreSQL integration scenarios passed. TypeScript
and production build passed; final text refinements checked in the real local UI.
Local modal: choose articles, preview differences, continue editing, cancel/reset;
mobile width 390 and desktop width 1920 checked. System summary navigation and
actual bell → exact delivery request → modal → close/URL reset verified.
The native edit preview is a local fixture, not a new end-to-end 1C write test.
Push transports were mocked; no new physical-device delivery test was sent. Prior
physical tests do not substitute for testing a future released build. OS cards may
remain until a replacement push or app-open reconciliation. Legacy Telegram queue
was inspected but not changed. Source-health warning assumes persisted down state
until recovery; it is not proof of continuous network outage. Intermittent unknown
native evidence is inspectable in System but has no per-request outage timer.

Local preview fixtures and fake command routes stay in /tmp, never release them.

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
