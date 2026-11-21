import type { Prisma } from '@prisma/client';
import { manualPaymentLinks } from './procurement-manual-payment-links';
import { confirmedPayments } from './procurement-confirmed-payment';
import type { ProcurementPaymentEvidence } from './procurement-currency-payment-evidence';

export async function assertUnpaidAction(tx: Prisma.TransactionClient, plan: {id: string; paymentMethod: string; oneCCashEvidence: unknown}, evidence?: ProcurementPaymentEvidence) {
  if (!evidence || evidence.state !== 'NO_EVIDENCE' || evidence.paymentAmountNeedsConfirmation ||
      evidence.collection || evidence.issuedAmount || evidence.paidAmount || evidence.paidForeignAmount ||
      evidence.cashOrders?.length || evidence.currencyPayments?.length || evidence.paymentReviewReasons?.length ||
      manualPaymentLinks(plan.oneCCashEvidence).length || confirmedPayments(plan.oneCCashEvidence).length) {
    throw Error('Изменение недоступно: по заявке есть движение денег или требуется сверка с 1С.');
  }
  const last=(plan.oneCCashEvidence as {lastCompletePaymentView?:{evidence?:{qrFunding?:{state?:string}}}}|null)?.lastCompletePaymentView?.evidence?.qrFunding;
  if (plan.paymentMethod === 'ACCOUNTABLE_QR' && (evidence.qrFunding?.state !== 'none' || last?.state==='confirmed')) {
    throw Error('Сначала проверьте перемещение денег по QR в 1С.');
  }
  // Receipt writers take the same row lock. Check again after any concurrent upload.
  await tx.$queryRaw`SELECT "id" FROM "SupplierPaymentPlan" WHERE "id" = ${plan.id} FOR UPDATE`;
  if (await tx.supplierPaymentReceipt.count({where:{planId:plan.id,purpose:'RECEIPT',replacedById:null}})) {
    throw Error('В заявке уже есть чек оплаты. Проверьте его перед изменением.');
  }
}
