import 'server-only';
import type { Prisma } from '@prisma/client';
import { DELIVERY_READY_KIND, currentDeliveryPush } from './procurement-delivery-notifications';
import { procurementNotificationEvidence as evidence } from './procurement-notification-evidence';
import { COLLECTION_READY_KIND, currentCollectionPushes } from './procurement-collection-notifications';
import { cashNoticeBase } from './procurement-morning-policy';
import { isFinishedPaymentState } from './procurement-small-remainder';

export function procurementNotificationPlan(fingerprint: string, kind: string) {
  if (!kind.startsWith('procurement_payment_')) return null;
  return /^procurement-payment:([^:]+):(approved|needs_changes|cancelled):/.exec(fingerprint)?.[1] ?? null;
}
type Row = { id: number; kind: string; fingerprint: string };
type Db = Pick<Prisma.TransactionClient, 'supplierPaymentPlan'>;
export async function inactiveProcurementNotifications(db: Db, rows: Row[]) {
  const inactive = new Set<number>();
  const ids = [...new Set(rows.map(r => procurementNotificationPlan(r.fingerprint, r.kind)).filter((id): id is string => Boolean(id)))];
  if (ids.length) {
    const plans = await db.supplierPaymentPlan.findMany({ where: { id: { in: ids } }, select: { id: true, status: true, updatedAt: true } });
    const paid = plans.some(p => p.status === 'APPROVED') ? await evidence() : null;
    // Recheck versions after the remote reconciliation; never close a newly edited plan
    // using an earlier payment allocation.
    const latest = await db.supplierPaymentPlan.findMany({ where: { id: { in: ids } }, select: { id: true, status: true, updatedAt: true } });
    const byId = new Map(latest.map(p => [p.id, p]));
    for (const r of rows) {
      const id = procurementNotificationPlan(r.fingerprint, r.kind);
      if (!id) continue;
      const p = byId.get(id);
      const closed = !p || ['CANCELLED', 'COMPLETED_WITHOUT_TOPUP'].includes(p.status);
      const fullyPaid = p && paid?.versions.get(id) === p.updatedAt.toISOString() && isFinishedPaymentState(paid.get(id)?.state);
      const oldDecision = p && (r.kind === 'procurement_payment_approved' && p.status !== 'APPROVED'
        || r.kind === 'procurement_payment_needs_changes' && p.status === 'SUBMITTED');
      // A rejected revision can leave the original plan APPROVED: that notice remains
      // meaningful until payment, cancellation or resubmission.
      if (closed || fullyPaid || oldDecision) inactive.add(r.id);
    }
  }
  if (rows.some(r => r.kind === DELIVERY_READY_KIND)) {
    const current = await currentDeliveryPush();
    if (current.state !== 'unknown') for (const r of rows) {
      if (r.kind === DELIVERY_READY_KIND && (current.state !== 'ready' || (cashNoticeBase(r) ?? r.fingerprint) !== current.fingerprint)) inactive.add(r.id);
    }
  }
  if (rows.some(r => r.kind === COLLECTION_READY_KIND)) {
    const current = await currentCollectionPushes();
    if (current.state === 'ready') for (const r of rows) {
      if (r.kind === COLLECTION_READY_KIND && !current.notices.some(n => n.fingerprint === (cashNoticeBase(r) ?? r.fingerprint))) inactive.add(r.id);
    }
  }
  return inactive;
}
