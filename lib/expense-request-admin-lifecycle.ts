import { createHash } from 'node:crypto';
import type { ExpenseRequestCompletenessEvaluation, OneCNamedRef } from '@/lib/expense-request-completeness';
import type { ExpenseRequestSourceRow } from '@/lib/expense-request-source';

export const EXPENSE_REQUEST_NOT_APPROVED_STATUS = 'not_approved';

export type ExpenseRequestCaseLifecycle = {
  isNotApproved: boolean;
  notApprovedCycle: number;
  enteredNotApprovedAt: Date | null;
  seenAt: Date | null;
  seenById: number | null;
  reviewedAt: Date | null;
  reviewedById: number | null;
  newlyEnteredNotApproved: boolean;
};

export type ExistingExpenseRequestCaseLifecycle = Omit<ExpenseRequestCaseLifecycle, 'newlyEnteredNotApproved'>;

function text(value: unknown) {
  return String(value ?? '').trim();
}

function named(value: OneCNamedRef | null | undefined) {
  return { ref: text(value?.ref), name: text(value?.name ?? value?.value) };
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonical(item)]));
  }
  return value;
}

export function stableExpenseRequestHash(value: unknown) {
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}

export function normalizeExpenseRequestForAudit(row: ExpenseRequestSourceRow) {
  return canonical({
    ref: text(row.ref), number: text(row.number), date: text(row.date), amount: row.amount ?? null,
    posted: row.posted ?? null, deletionMark: row.deletion_mark ?? null,
    status: { ...named(row.status), key: text(row.status?.key) },
    cashbox: named(row.cashbox), paymentForm: row.payment_form ?? null,
    businessOperation: named(row.business_operation), cashFlowItem: named(row.cash_flow_item),
    counterparty: named(row.counterparty), partner: named(row.partner), department: named(row.department),
    paymentPurpose: text(row.payment_purpose), comment: text(row.comment), author: named(row.author),
    requestedBy: named(row.requested_by), decidedBy: named(row.decided_by),
    desiredPaymentDate: text(row.desired_payment_date), paymentDate: text(row.payment_date),
    sourceDocument: named(row.source_document), supportingDocuments: row.supporting_documents ?? null,
    attachedFiles: row.attached_files ?? null, linkedCashExpenseOrders: row.linked_cash_expense_orders ?? null,
    execution: row.execution ?? null, plannedDistribution: row.planned_distribution ?? null,
    completeness: row.completeness ?? null,
  });
}

export function expenseRequestSourceHash(row: ExpenseRequestSourceRow) {
  return stableExpenseRequestHash(normalizeExpenseRequestForAudit(row));
}

export function expenseRequestSyncRunKey(input: { from: Date; to: Date; checkedAt: string; complete: boolean; rows: ExpenseRequestSourceRow[] }) {
  return stableExpenseRequestHash({
    from: input.from.toISOString(), to: input.to.toISOString(), checkedAt: input.checkedAt, complete: input.complete,
    rows: input.rows.map((row) => ({ ref: text(row.ref), hash: expenseRequestSourceHash(row) })).sort((a, b) => a.ref.localeCompare(b.ref)),
  });
}

export function deriveExpenseRequestLifecycle(input: {
  existing: ExistingExpenseRequestCaseLifecycle | null;
  statusKey: string;
  now: Date;
  baseline: boolean;
}): ExpenseRequestCaseLifecycle {
  const isNotApproved = text(input.statusKey).toLowerCase() === EXPENSE_REQUEST_NOT_APPROVED_STATUS;
  if (!input.existing) {
    return {
      isNotApproved,
      notApprovedCycle: isNotApproved ? 1 : 0,
      enteredNotApprovedAt: isNotApproved ? input.now : null,
      seenAt: input.baseline || !isNotApproved ? input.now : null,
      seenById: null,
      reviewedAt: null,
      reviewedById: null,
      newlyEnteredNotApproved: isNotApproved && !input.baseline,
    };
  }
  if (isNotApproved && !input.existing.isNotApproved) {
    return {
      isNotApproved: true,
      notApprovedCycle: input.existing.notApprovedCycle + 1,
      enteredNotApprovedAt: input.now,
      seenAt: null,
      seenById: null,
      reviewedAt: null,
      reviewedById: null,
      newlyEnteredNotApproved: true,
    };
  }
  return { ...input.existing, isNotApproved, newlyEnteredNotApproved: false };
}

export function evaluationAuditData(evaluation: ExpenseRequestCompletenessEvaluation) {
  return {
    ruleVersion: evaluation.version,
    category: evaluation.category,
    categoryCandidates: evaluation.categoryCandidates,
    completenessState: evaluation.completenessState,
    evidenceState: evaluation.evidenceState,
    reasonCodes: evaluation.reasonCodes,
    missingInformation: evaluation.missingInformation,
    suggestedQuestion: evaluation.question,
    decisionSources: evaluation.decisionSources,
    confidence: evaluation.confidence,
    ambiguous: evaluation.ambiguous,
  };
}
