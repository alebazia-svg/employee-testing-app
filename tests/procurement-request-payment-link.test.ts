import test from 'node:test';
import assert from 'node:assert/strict';
import type { ExpenseRequestSourceRow } from '../lib/expense-request-source';
import type { SupplierCurrencyPaymentRow } from '../lib/procurement-currency-payment-source';
import { attachRequestOrderLinks } from '../lib/procurement-request-payment-link';
import { matchProcurementPaymentEvidence, type EvidencePlan } from '../lib/procurement-currency-payment-evidence';
import { paymentFingerprint } from '../lib/procurement-manual-payment-links';

const payment: SupplierCurrencyPaymentRow = { ref: 'rko', date: '30.09.2026 15:27:43', number: 'test', posted: true, deleted: false,
  documentAmount: 47600, documentCurrency: 'РУБ', baseDocumentRef: '', supplier: 'Supplier' };
const request: ExpenseRequestSourceRow = {
  ref: 'request', date: '30.09.2026 15:27:00', posted: true, deletion_mark: false, amount: 47600,
  partner: { name: 'Supplier' }, currency: { name: 'руб' }, source_document: { ref: 'order', name: 'Заказ поставщику' },
  completeness: { request: true, linked_cash_expense_orders: true },
  linked_cash_expense_orders: { complete: true, truncated: false, errors: [], missing_fields: [], rows: [
    { ref: 'rko', date: payment.date, posted: true, deletion_mark: false, amount: 47600, request_amount: 47600, executed_amount: 47600, request_amount_conflict: false },
  ] },
};
const plan: EvidencePlan = { id: 'plan', planCode: 'PAY-TEST', supplierPartner: 'Supplier', supplierCounterparty: '',
  orderRefs: ['order'], plannedAmount: 47600, paymentMethod: 'CASH', status: 'APPROVED', createdAt: '2026-09-29T00:00:00Z' };
const match = (payments = [payment], requests = [request], plans = [plan]) => matchProcurementPaymentEvidence(plans, requests, payments, []);

test('order → native request → posted whole RUB RKO closes portal plan without a comment code', () => {
  for (const baseDocumentRef of ['', 'request', 'order']) {
    const p = { ...payment, baseDocumentRef };
    const linked = attachRequestOrderLinks([p], [request])[0];
    assert.equal(linked.requestOrderRef, 'order');
    assert.equal(paymentFingerprint(linked), paymentFingerprint(p), 'original document identity is preserved');
    const result = match([p]).get(plan.id)!;
    assert.equal(result.state, 'ISSUED_BY_ONE_C');
    assert.equal(result.issuedAmount, 47600); assert.equal(result.paidAmount, 0);
    assert.equal(result.remainingAmount, 0); assert.equal(result.cashOrders.length, 1);
  }
});
test('partial plan payment uses paid RKO amount, never request amount or requested budget', () => {
  const result = match([payment], [request], [{ ...plan, plannedAmount: 50000 }]).get(plan.id)!;
  assert.equal(result.state, 'PARTIALLY_ISSUED'); assert.equal(result.remainingAmount, 2400);
  assert.equal(match([payment], [{ ...request, amount: 100000 }]).get(plan.id)!.issuedAmount, 47600);
});
test('changed/unposted/deleted RKO reopens plan; repeated copies never multiply money', () => {
  assert.equal(match([payment, payment]).get(plan.id)!.issuedAmount, 47600);
  for (const payments of [[], [{ ...payment, posted: false }], [{ ...payment, deleted: true }],
    [{ ...payment, documentAmount: 47599 }], [payment, { ...payment, documentAmount: 1 }]]) {
    assert.equal(match(payments).get(plan.id)!.issuedAmount, 0);
  }
});
test('an explicit portal code and the request chain count the same RKO only once', () => {
  assert.equal(match([payment], [{ ...request, comment: plan.planCode }]).get(plan.id)!.issuedAmount, 47600);
  const result = match([payment], [{ ...request, comment: 'PAY-OTHER' }], [plan, { ...plan, id: 'other', planCode: 'PAY-OTHER' }]);
  assert.equal(result.get('other')!.issuedAmount, 47600); assert.equal(result.get('plan')!.issuedAmount, 0);
});
test('multiple candidate plans remain for review, no guessing by equal amounts', () => {
  const result = match([payment], [request], [plan, { ...plan, id: 'other' }]);
  for (const e of result.values()) { assert.equal(e.state, 'NEEDS_REVIEW'); assert.equal(e.issuedAmount, 0); }
});
test('another order, supplier, unapproved plan or later-created plan cannot consume the RKO', () => {
  for (const patch of [{ orderRefs: ['other'] }, { supplierPartner: 'Other' }, { status: 'SUBMITTED' },
    { createdAt: '2026-10-01T00:00:00Z' }, { createdAt: undefined }]) {
    assert.equal(match([payment], [request], [{ ...plan, ...patch }]).get(plan.id)!.issuedAmount, 0);
  }
});
test('request link requires complete source, native currency, posting, dates and supplier', () => {
  for (const patch of [{ posted: false }, { deletion_mark: true }, { deletion_mark: undefined },
    { source_document: { ref: '' } }, { completeness: {} }, { currency: { name: 'USDT' } },
    { currency: undefined }, { partner: { name: 'Other' } }, { date: '01.10.2026 12:00:00' }]) {
    assert.equal(match([payment], [{ ...request, ...patch }]).get(plan.id)!.issuedAmount, 0);
  }
  for (const patch of [{ complete: false }, { truncated: true }, { errors: ['unavailable'] }, { missing_fields: ['request'] }]) {
    assert.equal(match([payment], [{ ...request, linked_cash_expense_orders: { ...request.linked_cash_expense_orders!, ...patch } }]).get(plan.id)!.issuedAmount, 0);
  }
});
test('split or ambiguous RKO allocation and conflicting original basis stay unlinked', () => {
  const branch = request.linked_cash_expense_orders!, link = branch.rows![0];
  for (const patch of [{ request_amount: 20000 }, { executed_amount: 20000 }, { amount: 20000 },
    { request_amount_conflict: true }, { request_amount_conflict: undefined }, { date: '30.09.2026 15:27:44' },
    { posted: false }, { deletion_mark: true }]) {
    assert.equal(match([payment], [{ ...request, linked_cash_expense_orders: { ...branch, rows: [{ ...link, ...patch }] } }]).get(plan.id)!.issuedAmount, 0);
  }
  assert.equal(match([payment], [request, { ...request, ref: 'other-request' }]).get(plan.id)!.issuedAmount, 0);
  assert.equal(attachRequestOrderLinks([{ ...payment, baseDocumentRef: 'other-basis' }], [request])[0].requestOrderRef, undefined);
  assert.equal(attachRequestOrderLinks([{ ...payment, settlementOrderRef: 'other-order' }], [request])[0].requestOrderRef, undefined);
  assert.equal(match([payment], [{ ...request, linked_cash_expense_orders: { ...branch, rows: [link, link] } }]).get(plan.id)!.issuedAmount, 0);
});
test('derived request links are cleared when source disappears and never assume a FX rate', () => {
  const linked = attachRequestOrderLinks([payment], [request]);
  assert.equal(match(linked, []).get(plan.id)!.issuedAmount, 0);
  assert.equal(attachRequestOrderLinks([{ ...payment, documentCurrency: 'USDT' }], [request])[0].requestOrderRef, undefined);
});
