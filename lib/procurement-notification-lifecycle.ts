import 'server-only';
import type { Prisma } from '@prisma/client';
import { DELIVERY_READY_KIND, currentDeliveryPush } from './procurement-delivery-notifications';
import { procurementNotificationEvidence as evidence } from './procurement-notification-evidence';
import { COLLECTION_READY_KIND, currentCollectionPushes } from './procurement-collection-notifications';
import { cashNoticeBase } from './procurement-morning-policy';
import { isFinishedPaymentState } from './procurement-small-remainder';
import { CASH_ISSUE_KIND, cashIssueNotices } from './procurement-cash-issue-policy';
import { currentCashIssue } from './procurement-cash-issue-notifications';
import {RECEIPT_EMPLOYEE_KIND} from './procurement-receipt-policy';
import {isPaymentReceipt} from './procurement-document-policy';
import {QR_CHECK_KIND,needsQrCheck,qrCheckPlan,qrCheckRequestDay} from './procurement-qr-check-policy';
import {qrCheckKey} from './procurement-qr-check-key';
import {savedPaymentEvidence} from './procurement-evidence-continuity';

export function procurementNotificationPlan(fingerprint: string, kind: string) {
  if (!kind.startsWith('procurement_payment_')) return null;
  return /^procurement-payment:([^:]+):(approved|needs_changes|cancelled|updated):/.exec(fingerprint)?.[1] ?? null;
}
type Row = { id: number; kind: string; fingerprint: string };
type Db = Pick<Prisma.TransactionClient, 'supplierPaymentPlan'|'supplierPaymentReceipt'>;
export async function inactiveProcurementNotifications(db: Db, rows: Row[]) {
  const inactive = new Set<number>();
  const qrRows=rows.filter(r=>r.kind===QR_CHECK_KIND);
  if(qrRows.length){
    // DB-only projection: opening the bell never starts another 1C scan.
    const ids=qrRows.map(r=>qrCheckPlan(r.fingerprint)).filter((id):id is string=>!!id);
    const plans=await db.supplierPaymentPlan.findMany({where:{id:{in:ids}},include:{receipts:{where:{purpose:'QR',replacedById:null}}}});
    for(const r of qrRows){
      const plan=plans.find(p=>p.id===qrCheckPlan(r.fingerprint)),day=qrCheckRequestDay(r.fingerprint);
      if(!plan||!day||!needsQrCheck(plan,plan.receipts,day)||qrCheckKey(plan,plan.receipts,day)!==r.fingerprint||isFinishedPaymentState(savedPaymentEvidence(plan)?.evidence.state))inactive.add(r.id);
    }
  }
  const receiptRows=rows.filter(r=>r.kind===RECEIPT_EMPLOYEE_KIND);
  if(receiptRows.length){
    const ids=receiptRows.map(r=>/^procurement-receipt:[^:]+:([^:]+)$/.exec(r.fingerprint)?.[1]).filter((id):id is string=>!!id);
    const files=await db.supplierPaymentReceipt.findMany({where:{id:{in:ids}},select:{id:true,purpose:true,replacedById:true}});
    const active=new Set(files.filter(isPaymentReceipt).map(f=>f.id));
    for(const r of receiptRows)if(!active.has(r.fingerprint.split(':')[2]))inactive.add(r.id);
  }
  if (rows.some(r => r.kind === CASH_ISSUE_KIND)) {
    const current = await currentCashIssue();
    if (current.state !== 'unknown') for (const row of rows) {
      if (row.kind === CASH_ISSUE_KIND && !cashIssueNotices(current).some(notice => row.fingerprint === notice.fingerprint)) inactive.add(row.id);
    }
  }
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
        || r.kind === 'procurement_payment_needs_changes' && p.status === 'SUBMITTED'
        || r.kind === 'procurement_payment_updated' && p.status !== 'SUBMITTED');
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
