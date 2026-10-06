import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { Prisma } from '@prisma/client';
import type { ProcurementPaymentEvidence } from './procurement-currency-payment-evidence';

export type EvidenceContinuityPlan = {
  id: string; updatedAt: Date; oneCCashEvidence: unknown;
  [key: string]: unknown;
};
export type PaymentEvidenceView = ProcurementPaymentEvidence & {
  verification: 'current' | 'last-confirmed' | 'unavailable';
  verifiedAt?: string;
};
const object = (value: unknown): Record<string, any> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};

/** Display continuity only. Never pass cached evidence to matching, reserves,
 * notifications, manual linking or any write decision. */
export function paymentEvidenceIdentity(plan: EvidenceContinuityPlan) {
  const meta = object(plan.oneCCashEvidence);
  return createHash('sha256').update(JSON.stringify([
    plan.id, plan.planCode, plan.managerUserId, plan.supplierPartner, plan.supplierCounterparty,
    plan.orderRefs, String(plan.plannedAmount), plan.paymentMethod, plan.currency,
    String(plan.foreignAmount ?? ''), plan.plannedDate, plan.createdAt, plan.status,
    meta.paymentMatchFrom, meta.pendingRevision, meta.manualRubleLinks, meta.completion,
  ])).digest('hex');
}

type Saved = { version: 1; identity: string; readStartedAt: string; verifiedAt: string; evidence: ProcurementPaymentEvidence };
export function savedPaymentEvidence(plan: EvidenceContinuityPlan): Saved | null {
  const s = object(plan.oneCCashEvidence).lastCompletePaymentView;
  if (!s || s.version !== 1 || s.identity !== paymentEvidenceIdentity(plan) ||
      !Number.isFinite(Date.parse(s.readStartedAt)) || !Number.isFinite(Date.parse(s.verifiedAt)) ||
      !s.evidence || typeof s.evidence.state !== 'string' ||
      !Number.isFinite(s.evidence.issuedAmount) || !Array.isArray(s.evidence.cashOrders) ||
      !Array.isArray(s.evidence.currencyPayments)) return null;
  return s;
}

export function paymentEvidenceView(plan: EvidenceContinuityPlan, current: ProcurementPaymentEvidence,
  complete: boolean, verifiedAt: string): PaymentEvidenceView {
  if (complete) return { ...current, verification: 'current', verifiedAt };
  const saved = savedPaymentEvidence(plan);
  if (saved) {
    // An old permission to collect cash must never remain actionable.
    const { collection, ...evidence } = saved.evidence;
    return { ...evidence, verification: 'last-confirmed', verifiedAt: saved.verifiedAt };
  }
  return { ...current, state: 'SOURCE_UNAVAILABLE', issuedAmount: 0, paidAmount: 0,
    paidForeignAmount: 0, cashOrders: [], currencyPayments: [], collection: undefined,
    verification: 'unavailable' };
}

/** Compare-and-swap prevents clobbering revisions/manual links/concurrent reads.
 * Successful complete empty reads are saved too: cancelled payments must not revive.
 * Incomplete reads NEVER persist or replace a confirmed snapshot. */
export async function preservePaymentEvidenceViews(plans: EvidenceContinuityPlan[],
  evidence: Map<string, ProcurementPaymentEvidence>, complete: boolean, readStartedAt: Date,
  store: { updateMany(args: any): Promise<unknown> }, now = new Date()) {
  const verifiedAt = now.toISOString();
  const views = new Map<string, PaymentEvidenceView>();
  for (const plan of plans) {
    const current = evidence.get(plan.id);
    if (!current) continue;
    const saved = savedPaymentEvidence(plan);
    const superseded = !!saved && Date.parse(saved.readStartedAt) > readStartedAt.getTime();
    views.set(plan.id, paymentEvidenceView(plan, current, complete && !superseded, verifiedAt));
    if (!complete || superseded) continue;
    const { collection, ...withoutCollection } = current;
    const snapshot = JSON.parse(JSON.stringify(withoutCollection)) as ProcurementPaymentEvidence;
    // PostgreSQL jsonb normalizes object-key order; compare JSON values, not text.
    if (saved && isDeepStrictEqual(saved.evidence, snapshot) &&
        now.getTime() - Date.parse(saved.verifiedAt) < 5 * 60_000) continue;
    try {
      await store.updateMany({ where: { id: plan.id, updatedAt: plan.updatedAt,
          oneCCashEvidence: { equals: plan.oneCCashEvidence ?? Prisma.AnyNull } },
        // A presentation refresh is not a business edit: preserve version quotes
        // used by revision/completion dialogs. JSON CAS also guards cache races.
        data: { updatedAt: plan.updatedAt, oneCCashEvidence: { ...object(plan.oneCCashEvidence), lastCompletePaymentView: {
          version: 1, identity: paymentEvidenceIdentity(plan), readStartedAt: readStartedAt.toISOString(),
          verifiedAt, evidence: snapshot,
        } } } });
    } catch {
      // A cache-write failure must not change fresh business evidence. A later
      // outage will be shown as unavailable, never manufactured as unpaid.
    }
  }
  return views;
}
