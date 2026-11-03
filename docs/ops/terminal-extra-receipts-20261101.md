# Possible extra receipts — local candidate, 2026-11-01

Owner approved a system-generated possible-extra-receipt check, parallel to missing
receipt checks, with the SAME native mobile receipt sheet, structured facts and
«Это дубль», «Была вторая продажа», «Нужна помощь». Personal owner-message copy,
standalone question page and desktop notification dialog were rejected. Employee
sending stays disabled until the agreed preview/release step. No production writes.

## Verified real 900 case

Read-only 1C, Platforma OFD and aQsi agree: terminal check000478, SBP900 at14:22:29;
1C00OF-00375914:28:05 / FD3297 and00OF-00376014:32:21 / FD3298 contained the same
holder900. At19:55:15 Zukhra registered refund00OF-000079 with explicit
links.originalCheck.ref pointing to00OF-003760. OFD accepted refund FD3306 at19:55:25
(KKT clock19:47). Bank has no refund. Net electronic totals18400 in all three
sources. Remaining sale is00OF-003759. Portal's19:57 read still left the original
question open; source adapter previously discarded originalCheck.ref. Do not send
an obsolete request to Zukhra or claim production alerts already closed.

## Implementation

- terminal-extra-receipts: conservative possible duplicate detector: complete
  bank/1C/OFD/peer reads;30-minute quiet period; one nearby payment across equipment,
  two distinct equal-goods/OFD-backed same-cashier receipts; no mixed/ambiguous case.
- Exact referenced reversal netting requires both immutable fiscal identities,
  same KKT, amount and goods, and no real terminal refund. Never chooses a wrong
  receipt by proximity, drops an unlinked return, or infers identity from totals.
- Source adapter preserves documentNumber and originalCheckRef.
- Existing runner integrates via TERMINAL_FISCAL_EXTRA_RECEIPTS_ENABLED=true.
  Employee notifications additionally require TERMINAL_FISCAL_EXTRA_RECEIPTS_NOTIFY=true.
  Both default OFF. Existing behavior remains with flags absent.
- Same Workday issue/notification/attention pipeline; new warning rule only.
  Possible extra receipts do not block handover. Existing required issues unchanged.
- Mapped actual 1C cashier only; otherwise existing ADMIN financial review remains.
- Serializable/retried idempotent staging and responses; owner inbox response.
  Second sale asks its payment method in the same sheet. No response closes the
  financial check. Closure requires every original receipt matched or explicitly
  reversed, with at least one live uniquely matched sale. Incomplete reads never
  close it. Cancel pending reminders; preserve sent history and answers.
- ADMIN issue details show the actual receipt facts/response, not credit-sale labels.

Changed source: lib/terminal-extra-receipts.ts, terminal-extra-receipts-sync.ts,
terminal-extra-receipt-response.ts, terminal-extra-receipt-transaction.ts,
terminal-fiscal-sources.ts, terminal-fiscal-matching.ts (optional metadata only),
terminal-fiscal-runner.ts, employee-attention-snapshot.ts, workday-required-issues.ts,
workday-notifications.ts, admin-workday-issue-detail.ts;
app/api/employee/extra-receipts/[id]/response/route.ts;
app/(dashboard)/admin/workday/WorkdayIssueDialog.tsx.
Tests: tests/terminal-extra-receipts.test.ts, workday-required-issues.test.ts.

## Acceptance

88 focused tests pass; TypeScript passes; isolated Next production build passes.
Real saved before/after snapshots:1 possible extra before,0 after,1 exact referenced
reversal; remaining payment matches00OF-003759 as confirmed. Private inputs stay
in.wip only. PostgreSQL integration: shadow/no-send, parallel idempotency, wrong
employee rejection, answer preserved, no close on answer/incomplete OFD, exact
reversal closure; repeat closure idempotent; new warning excluded from handover.
Build used separate /tmp copy; original3241 preview and3242 development untouched.
Initial copied build missed types/bcryptjs.d.ts; complete-copy rebuild passed.

Real mobile preview screenshot:.wip/extra900-automatic-mobile.png (before correction
fixture). No physical push tested, no production notification or activation,
no 1C/OFD write, no fiscal correction by Codex, no migration.
Current production UI observed1.20.10, candidate based on1.20.9 worktree. Before
release merge the latest deployment baseline, follow version/runbook/approval gates,
recheck these modules for concurrent changes and allocate a new portal version.
No version reserved; no deploy authorized/performed by this local candidate.
