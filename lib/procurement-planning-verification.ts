import { evaluateAcquisitionSettlement } from './procurement-acquisition-settlement';
import { reconcileSupplier } from './procurement-settlement-reconciliation';
import { verifiedOrderDebt, planningDiscovery } from './procurement-planning-evidence';
import type { SupplierOrderFinanceRow } from './procurement-payment-source';

const normalized = (s: string) => s.trim().toLocaleLowerCase('ru').replaceAll('ё', 'е').replace(/\s+/g, ' ');
export function verifyPlanningOrder(row: SupplierOrderFinanceRow,
  discovery: ReturnType<typeof planningDiscovery>, detail: Record<string, any>, supplier: Record<string, any>, at: string,
): SupplierOrderFinanceRow {
  const review = (planningReason: string) => ({ ...row, planningState: 'needs_review' as const, planningReason, verifiedAt: at });
  const order = detail?.order?.[0];
  if (detail?.complete !== true || detail?.write_operations !== false || detail?.planning_links_contract !== 'supplier-planning-links-v1'
    || detail.order_links_complete !== true || detail.order_links_scope !== 'all_header_and_goods_order_links_for_returned_receipts'
    || detail.order?.length !== 1 || order?.order_ref !== row.ref || order.posted !== true || order.deleted !== false
    || normalized(order.manager_name || '') !== normalized(row.manager)
    || normalized(order.supplier_name || '') !== normalized(row.supplierPartner)
    || !Array.isArray(detail.receipts) || !Array.isArray(detail.order_links)) return review('Не удалось подтвердить связи заказа в 1С');
  const rec = reconcileSupplier(supplier, order.supplier_ref);
  if (rec.state !== 'available') return review('Взаиморасчёты и документы расходятся — нужна сверка руководителя');
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
  if (acquired.receipts.every(r => r.status === 'settled')) {
    // Reconcile the second register too. No row in discovery alone is not proof.
    if (discovery.balances.some(b => receiptRefs.has(b.receipt_ref))
      || supplier.document_balances.some((b: any) => receiptRefs.has(b.settlement_document_ref)
        && (b.raw_debt_balance !== 0 || b.raw_prepayment_balance !== 0))) return review('Остатки приобретения изменились во время сверки');
    return { ...row, planningState: 'settled', planningReason: 'Расчёты по приобретениям завершены', orderPaymentGap: 0, verifiedAt: at };
  }
  if (rec.buckets.some(b => b.advanceMinor > 0)) return review('Есть авансы поставщику — нужно проверить, относятся ли они к этому заказу');
  const debt = verifiedOrderDebt(discovery, row.ref, detail, supplier, 0);
  if (!debt) return review('Остаток приобретения не подтверждён для отдельной оплаты по заказу');
  // All receipts must be understood, not just the positive rows in discovery.
  if (acquired.receipts.some(r => r.status === 'needs_review')) return review('Не по всем приобретениям подтверждено погашение');
  const receiptDebt = acquired.receipts.reduce((sum, r) => sum + (r.outstandingMinor || 0), 0);
  if (receiptDebt !== debt.debtMinor) return review('Остаток изменился во время сверки — требуется обновление');
  if (debt.debtMinor <= 50000) return { ...row, orderPaymentGap: debt.debtMinor / 100, planningState: 'small_balance',
    planningReason: 'Остаток до 500 ₽ скрыт из подбора; в 1С он не списан', verifiedAt: at };
  return { ...row, orderPaymentGap: debt.debtMinor / 100, planningState: 'receipt_debt',
    controlGroup: 'verified_receipt_debt', planningReason: 'Долг по приобретению сверен с взаиморасчётами', verifiedAt: at };
}
