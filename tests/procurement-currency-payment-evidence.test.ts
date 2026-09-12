import assert from 'node:assert/strict';
import test from 'node:test';
import { matchProcurementPaymentEvidence } from '@/lib/procurement-currency-payment-evidence';
import type { CurrencyConversionRow, SupplierCurrencyPaymentRow } from '@/lib/procurement-currency-payment-source';

const plan = {
  id: 'tural',
  planCode: 'PAY-20260909-659210',
  supplierPartner: 'Tural',
  supplierCounterparty: 'Tural',
  orderRefs: ['05bdb29c-961a-11f1-b4fa-002590803daf'],
  plannedAmount: 700000,
  paymentMethod: 'USDT',
  foreignAmount: null,
  plannedDate: '2026-09-11T00:00:00.000Z',
  createdAt: '2026-09-09T16:42:49.954Z',
  status: 'APPROVED',
};
const payment: SupplierCurrencyPaymentRow = {
  ref: 'rko-tural', date: '12.09.2026 2:28:48', number: '00OF-001675', posted: true,
  deleted: false, documentAmount: 7865.17, documentCurrency: 'USDT',
  baseDocumentRef: '05bdb29c-961a-11f1-b4fa-002590803daf',
};
const conversion: CurrencyConversionRow = {
  date: '12.09.2026 2:24:27', posted: true, deleted: false,
  currency: 'РУБ', conversionCurrency: 'USDT', conversionRate: 88.9996,
  linkedCashbox: 'Касса USDT',
};

test('Tural payment closes the linked ruble-estimate plan using the exchange rate, not accounting settlement', () => {
  const result = matchProcurementPaymentEvidence([plan], [], [payment], [conversion]).get('tural')!;
  assert.equal(result.state, 'PAID_BY_ONE_C');
  assert.equal(result.paidForeignAmount, 7865.17);
  assert.ok(Math.abs(result.paidAmount - 699996.983932) < 0.001);
  assert.equal(result.actualExchangeRate, 88.9996);
  assert.ok(result.remainingAmount < 3.02);
});

test('partial payment remains open with the unpaid ruble estimate', () => {
  const result = matchProcurementPaymentEvidence([plan], [], [{ ...payment, documentAmount: 3000 }], [conversion]).get('tural')!;
  assert.equal(result.state, 'PARTIALLY_PAID_BY_ONE_C');
  assert.equal(result.paidAmount, 266998.8);
  assert.equal(result.remainingAmount, 433001.2);
});

test('unposted, deleted or unrelated payments never close the plan', () => {
  const result = matchProcurementPaymentEvidence([plan], [], [
    { ...payment, posted: false },
    { ...payment, deleted: true },
    { ...payment, baseDocumentRef: 'other-order' },
  ], [conversion]).get('tural')!;
  assert.equal(result.state, 'NO_EVIDENCE');
  assert.equal(result.paidForeignAmount, 0);
});

test('known USDT amount can close from wallet balance without a new conversion, without claiming a ruble equivalent', () => {
  const result = matchProcurementPaymentEvidence([{ ...plan, foreignAmount: 7865.17 }], [], [payment], []).get('tural')!;
  assert.equal(result.state, 'PAID_BY_ONE_C');
  assert.equal(result.paidForeignAmount, 7865.17);
  assert.equal(result.paidAmount, 0);
  assert.equal(result.actualExchangeRate, null);
});
