import { evaluateAcquisitionSettlement } from './procurement-acquisition-settlement';
import { reconcileSupplier } from './procurement-settlement-reconciliation';
import { verifiedOrderDebt, planningDiscovery } from './procurement-planning-evidence';
import type { SupplierOrderFinanceRow } from './procurement-payment-source';

const normalized = (s: string) => s.trim().toLocaleLowerCase('ru').replaceAll('ё', 'е').replace(/\s+/g, ' ');
export type OrderReceiptSettlement = {
  checkedAt: string;
  debtRub: number;
  requiresAdvanceReview: boolean;
  receipts: { ref: string; number: string; amountRub: number; remainingRub: number }[];
  supplier: { ref: string; grossDebtRub: number; creditsRub: number; netOwedRub: number };
};
function completeOrderLinks(row: SupplierOrderFinanceRow, detail: Record<string, any>) {
  const order = detail?.order?.[0];
  return !(detail?.ok !== true || detail?.complete !== true || detail?.write_operations !== false || detail?.planning_links_contract !== 'supplier-planning-links-v1'
    || detail.order_links_complete !== true || detail.order_links_scope !== 'all_header_and_goods_order_links_for_returned_receipts'
    || detail.order?.length !== 1 || order?.order_ref !== row.ref || order.posted !== true || order.deleted !== false
    || normalized(order.manager_name || '') !== normalized(row.manager)
    || normalized(order.supplier_name || '') !== normalized(row.supplierPartner)
    || !Array.isArray(detail.receipts) || !Array.isArray(detail.order_links));
}

/** Absence is a checked document fact, not an inference from a zero amount. */
export function noAcquisitionsEvidence(row: SupplierOrderFinanceRow, detail: Record<string, any>, at: string) {
  return completeOrderLinks(row, detail) && detail.receipts.length === 0 && detail.order_links.length === 0
    && row.receiptAmount === 0 ? { checkedAt: at } : undefined;
}

export function verifyPlanningOrder(row: SupplierOrderFinanceRow,
  discovery: ReturnType<typeof planningDiscovery>, detail: Record<string, any>, supplier: Record<string, any>, at: string,
): SupplierOrderFinanceRow {
  row = { ...row, receiptSettlement: undefined, noAcquisitions: undefined };
  const review = (planningReason: string) => ({ ...row, planningState: 'needs_review' as const, planningReason, verifiedAt: at });
  if (!completeOrderLinks(row, detail)) return review('Не удалось подтвердить связи заказа в 1С');
  const order = detail.order[0];
  if (!discovery.links.some(l => l.order_ref === row.ref)) row.noAcquisitions = noAcquisitionsEvidence(row, detail, at);
  const rec = reconcileSupplier(supplier, order.supplier_ref);
  if (rec.state !== 'available') return review('Взаиморасчёты и документы расходятся — нужна сверка');
  if (!detail.receipts.length) {
    if (rec.buckets.some(b => b.advanceMinor > 0)) return review('Есть авансы поставщику — проверьте их зачёт перед новой предоплатой');
    // Preserve prepayment only for a live order confirmed by the finance source.
    // Absence of a receipt is not a debt and a closed order is not a prepayment.
    if (/закрыт|отмен/i.test(order.status_name || '') || row.orderPaymentGap <= 500
      || row.receiptAmount > 0.009 || discovery.links.some(l => l.order_ref === row.ref)) return review('По заказу нет подтверждённого приобретения; уточните основание оплаты');
    return { ...row, planningState: 'prepayment', planningReason: 'Предоплата по заказу, товар ещё не поступил', verifiedAt: at };
  }
  const receiptRefs = new Set(detail.receipts.map((r: any) => r.receipt_ref));
  if (detail.order_links.some((l: any) => !receiptRefs.has(l.receipt_ref)) || detail.receipts.some((r: any) => {
    const links = detail.order_links.filter((l: any) => l.receipt_ref === r.receipt_ref);
    return links.length !== 1 || links[0].order_ref !== row.ref || links[0].order_supplier_ref !== order.supplier_ref;
  })) return review('Приобретение связано с несколькими заказами — распределение требует проверки');
  const acquired = evaluateAcquisitionSettlement(detail, row.ref);
  if (acquired.state !== 'verified') return review('Неполные данные движения приобретений');
  if (acquired.receipts.some(r => !['руб', 'rub', '₽', 'российский рубль'].includes(normalized(r.currencyName)))) return review('Валютное приобретение требует проверки расчётов');
  const attachReceiptSettlement = (debtMinor: number) => {
    const balances = supplier.document_balances.filter((b: any) => ['руб', 'rub', '₽', 'российский рубль'].includes(normalized(b.currency_name || '')));
    const grossDebtMinor = balances.reduce((sum: number, b: any) => sum + Math.round(b.raw_debt_balance * 100), 0);
    const creditsMinor = balances.reduce((sum: number, b: any) => sum + Math.round(b.raw_prepayment_balance * 100), 0);
    row = { ...row, orderPaymentGap: debtMinor / 100, receiptSettlement: {
      checkedAt: at, debtRub: debtMinor / 100, requiresAdvanceReview: debtMinor > 0 && rec.buckets.some(b => b.advanceMinor > 0),
      receipts: acquired.receipts.map(r => ({ref: r.ref, number: r.number, amountRub: r.documentAmountMinor / 100, remainingRub: r.outstandingMinor! / 100})),
      supplier: { ref: order.supplier_ref, grossDebtRub: grossDebtMinor / 100, creditsRub: creditsMinor / 100, netOwedRub: (grossDebtMinor - creditsMinor) / 100 },
    } };
  };
  if (acquired.receipts.every(r => r.status === 'settled')) {
    // Reconcile the second register too. No row in discovery alone is not proof.
    if (discovery.balances.some(b => receiptRefs.has(b.receipt_ref))
      || supplier.document_balances.some((b: any) => receiptRefs.has(b.settlement_document_ref)
        && (b.raw_debt_balance !== 0 || b.raw_prepayment_balance !== 0))) return review('Остатки приобретения изменились во время сверки');
    attachReceiptSettlement(0);
    return { ...row, planningState: 'settled', planningReason: 'Расчёты по приобретениям завершены', orderPaymentGap: 0, verifiedAt: at };
  }
  const debt = verifiedOrderDebt(discovery, row.ref, detail, supplier, 0, true);
  if (!debt) return review('Остаток приобретения не подтверждён для отдельной оплаты по заказу');
  // All receipts must be understood, not just the positive rows in discovery.
  if (acquired.receipts.some(r => r.status === 'needs_review')) return review('Не по всем приобретениям подтверждено погашение');
  const receiptDebt = acquired.receipts.reduce((sum, r) => sum + (r.outstandingMinor || 0), 0);
  if (receiptDebt !== debt.debtMinor) return review('Остаток изменился во время сверки — требуется обновление');
  attachReceiptSettlement(debt.debtMinor);
  if (row.receiptSettlement!.requiresAdvanceReview) return review('Остаток приобретений подтверждён. У поставщика есть авансы или возвраты — перед оплатой нужно проверить зачёт');
  if (debt.debtMinor <= 50000) return { ...row, orderPaymentGap: debt.debtMinor / 100, planningState: 'small_balance',
    planningReason: 'Остаток до 500 ₽; в 1С он не списан', verifiedAt: at };
  return { ...row, orderPaymentGap: debt.debtMinor / 100, planningState: 'receipt_debt',
    controlGroup: 'verified_receipt_debt', planningReason: 'Долг по приобретению сверен с взаиморасчётами', verifiedAt: at };
}
