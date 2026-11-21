import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { confirmedPayments, type PaymentConfirmation } from './procurement-confirmed-payment';
import { manualPaymentLinks } from './procurement-manual-payment-links';

type PlanVersion = {id: string; updatedAt: Date; oneCCashEvidence: unknown};
const changed = () => new Error('Заявки изменились во время сверки. Обновите календарь.');

// Only newly observed, whole, uniquely allocated supplier-debt RKOs enter here.
// Re-read under the same lock as approval and manual allocation; write all or none.
export async function retainPaymentConfirmations<T extends PlanVersion>(plans: T[], confirmations: PaymentConfirmation[], started: Date) {
  if (!confirmations.length) return plans;
  for (let attempt = 0; ; attempt++) try {
    return await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(73106241)`;
      const rows = await tx.supplierPaymentPlan.findMany({select: {id: true, updatedAt: true, oneCCashEvidence: true}});
      const versions = new Map(plans.map(p => [p.id, p.updatedAt.getTime()]));
      if (rows.length !== plans.length || rows.some(p => versions.get(p.id) !== p.updatedAt.getTime())) throw changed();
      const owners = new Map(rows.flatMap(p => confirmedPayments(p.oneCCashEvidence).map(link => [link.ref, {id:p.id, link}] as const)));
      const manual = new Set(rows.flatMap(p => manualPaymentLinks(p.oneCCashEvidence).map(link => link.ref.toLowerCase())));
      const observed = new Map(plans.flatMap(p => confirmedPayments(p.oneCCashEvidence).map(link => [link.ref, p.id] as const)));
      const proposed = new Map(confirmations.map(c => [c.payment.ref, c.planId]));
      for (const [ref, owner] of owners) {
        if (observed.get(ref) !== owner.id && proposed.get(ref) !== owner.id) throw changed();
      }
      const additions = new Map<string, PaymentConfirmation['payment'][]>();
      for (const {planId, payment} of confirmations) {
        if (!versions.has(planId)) throw changed();
        const owner = owners.get(payment.ref);
        if (manual.has(payment.ref) || owner && (owner.id !== planId || owner.link.fingerprint !== payment.fingerprint)) throw changed();
        if (owner) continue;
        owners.set(payment.ref, {id: planId, link: payment});
        additions.set(planId, [...(additions.get(planId) || []), payment]);
      }
      for (const row of rows) {
        const add = additions.get(row.id);
        if (!add) continue;
        const meta = row.oneCCashEvidence && typeof row.oneCCashEvidence === 'object' && !Array.isArray(row.oneCCashEvidence) ? row.oneCCashEvidence : {};
        const view = meta.lastCompletePaymentView;
        if (view && typeof view === 'object' && !Array.isArray(view) && Date.parse(String(view.readStartedAt)) > started.getTime()) throw changed();
        const updated = {...meta, confirmedSupplierPayments: [...confirmedPayments(meta), ...add]};
        const result = await tx.supplierPaymentPlan.updateMany({where: {id: row.id, updatedAt: row.updatedAt,
          oneCCashEvidence: {equals: row.oneCCashEvidence ?? Prisma.AnyNull}}, data: {updatedAt: row.updatedAt,
          oneCCashEvidence: updated}});
        if (result.count !== 1) throw changed();
        row.oneCCashEvidence = updated;
      }
      const byId = new Map(rows.map(p => [p.id, p.oneCCashEvidence]));
      return plans.map(p => ({...p, oneCCashEvidence: byId.get(p.id)}));
    }, {isolationLevel: 'Serializable'});
  } catch (error) {
    if (attempt >= 2 || !(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034')) throw error;
  }
}

// Competing reads or a storage outage defer only the newly observed links.
// Financial commands call retainPaymentConfirmations directly and fail closed.
export async function retainDisplayConfirmations<T extends PlanVersion>(plans: T[], confirmations: PaymentConfirmation[], started: Date) {
  try {
    return {plans: await retainPaymentConfirmations(plans, confirmations, started), deferred: undefined};
  } catch {
    return {plans, deferred: new Set(confirmations.map(c => c.planId))};
  }
}
