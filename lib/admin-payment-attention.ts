import { isFinishedPaymentState } from './procurement-small-remainder';
import { paymentPreparationDate } from './procurement-schedule';
import type { PreparationPlan } from './procurement-day-preparation';
import type { ProcurementPaymentEvidence } from './procurement-currency-payment-evidence';

export type PaymentAttention = {
  expenses: number | null;
  suppliers: { decisions: number; preparation: number | null } | null;
};

type AttentionPlan = Pick<PreparationPlan, 'id' | 'status' | 'plannedDate' | 'paymentMethod' | 'oneCCashEvidence'> & {
  evidence: Pick<ProcurementPaymentEvidence, 'state' | 'collection' | 'paymentReviewReasons'>;
  hasPendingRevision: boolean;
};

export function supplierPaymentAttention(plans: AttentionPlan[], today: string,
  preparation: ReadonlyMap<string, { amount: number | null }>,
  plansWithReceipts: ReadonlySet<string>, evidenceComplete: boolean) {
  const tomorrow = new Date(Date.parse(today) + 86_400_000).toISOString().slice(0, 10);
  const decisions = plans.filter(plan =>
    plan.hasPendingRevision || (plan.status === 'SUBMITTED' && plan.evidence.state !== 'PAID_BY_ONE_C')).length;
  if (!evidenceComplete) return { decisions, preparation: null };

  const needsFunds = plans.filter(plan => {
    if (plan.status !== 'APPROVED' || plan.hasPendingRevision || isFinishedPaymentState(plan.evidence.state)) return false;
    const day = paymentPreparationDate(plan);
    if (!day || day > tomorrow || plan.evidence.collection || plan.evidence.paymentReviewReasons?.length) return false;
    if (plan.paymentMethod === 'ACCOUNTABLE_QR' && plansWithReceipts.has(plan.id)) return false;
    return (preparation.get(plan.id)?.amount ?? 0) > 0;
  }).length;
  return { decisions, preparation: needsFunds };
}
