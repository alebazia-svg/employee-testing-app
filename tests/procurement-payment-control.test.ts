import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPaymentPlanCode, calculateCashPreparation, calculateOrderPlanning, matchCashEvidence, paymentPlanLeadTime, validatePaymentPlan } from '@/lib/procurement-payment-control';

test('USDT plan can be submitted when only the ruble amount is known', () => {
  const result = validatePaymentPlan({ supplierPartner: 'China Mobile', orderRefs: ['order-1'], orderNumbers: ['1'], plannedDate: '2026-09-10', plannedAmount: 400000, condition: 'Перед отправкой', paymentMethod: 'USDT' });
  assert.equal(result.ok, true);
  assert.equal(result.data.foreignAmount, null);
});

test('USDT plan can be submitted when only the USDT amount is known', () => {
  const result = validatePaymentPlan({ supplierPartner: 'Luxo', orderRefs: ['order-1'], plannedDate: '2026-09-10', foreignAmount: 8000, paymentMethod: 'USDT' });
  assert.equal(result.ok, true);
  assert.equal(result.data.plannedAmount, null);
  assert.equal(result.data.foreignAmount, 8000);
});

test('a routine condition is supplied automatically for a short form', () => {
  const result = validatePaymentPlan({ supplierPartner: 'China Mobile', orderRefs: ['order-1'], plannedDate: '2026-09-10', plannedAmount: 400000, paymentMethod: 'CASH' });
  assert.equal(result.ok, true);
  assert.equal(result.data.condition, 'Оплата по выбранным заказам');
});

test('QR from the accountable employee card is a distinct payment method', () => {
  const result = validatePaymentPlan({ supplierPartner: 'В12', orderRefs: ['order-1'], plannedDate: '2026-09-10', plannedAmount: 112000, paymentMethod: 'ACCOUNTABLE_QR' });
  assert.equal(result.ok, true);
  assert.equal(result.data.paymentMethod, 'ACCOUNTABLE_QR');
});

test('cash evidence aggregates split posted RKO and ignores deleted RKO', () => {
  const result = matchCashEvidence({ planCode: 'PAY-20260909-000001', supplierPartner: 'Поставщик', supplierCounterparty: '', plannedAmount: 400000 }, [{
    ref: 'request-1', amount: 400000, comment: 'Оплата PAY-20260909-000001',
    linked_cash_expense_orders: { rows: [
      { ref: 'rko-1', number: '1', posted: true, deletion_mark: false, executed_amount: 250000 },
      { ref: 'rko-2', number: '2', posted: true, deletion_mark: false, executed_amount: 150000 },
      { ref: 'rko-3', number: '3', posted: true, deletion_mark: true, executed_amount: 999 },
    ] },
  }]);
  assert.equal(result.state, 'ISSUED_BY_ONE_C');
  assert.equal(result.issuedAmount, 400000);
  assert.deepEqual(result.cashOrders.map((order) => order.ref), ['rko-1', 'rko-2']);
});

test('partial payment keeps the unpaid part of the same order available for another plan', () => {
  const [order] = calculateOrderPlanning(
    [{ ref: 'order-1', orderPaymentGap: 700000 }],
    [{ orderRefs: ['order-1'], plannedAmount: 200000, status: 'APPROVED' }],
  );
  assert.equal(order.plannedActiveAmount, 200000);
  assert.equal(order.unplannedAmount, 500000);
});

test('issued part is not reserved twice after 1C reduces the order gap', () => {
  const [order] = calculateOrderPlanning(
    [{ ref: 'order-1', orderPaymentGap: 500000 }],
    [{ orderRefs: ['order-1'], plannedAmount: 200000, issuedAmount: 200000, status: 'APPROVED' }],
  );
  assert.equal(order.plannedActiveAmount, 0);
  assert.equal(order.unplannedAmount, 500000);
});

test('legacy plan covering several orders is allocated without exceeding an order gap', () => {
  const rows = calculateOrderPlanning(
    [{ ref: 'one', orderPaymentGap: 100000 }, { ref: 'two', orderPaymentGap: 300000 }],
    [{ orderRefs: ['one', 'two'], plannedAmount: 250000, status: 'SUBMITTED' }],
  );
  assert.deepEqual(rows.map((row) => row.unplannedAmount), [0, 150000]);
});

test('lead time distinguishes advance, next-day and same-day requests automatically', () => {
  assert.equal(paymentPlanLeadTime('2026-09-09T10:00:00Z', '2026-09-12').state, 'ADVANCE');
  assert.equal(paymentPlanLeadTime('2026-09-09T10:00:00Z', '2026-09-10').state, 'NEXT_DAY');
  assert.equal(paymentPlanLeadTime('2026-09-09T10:00:00Z', '2026-09-09').state, 'SAME_DAY');
  assert.equal(paymentPlanLeadTime('2026-09-08T21:30:00Z', '2026-09-09').state, 'SAME_DAY');
});

test('1C payment to another supplier is returned as a mismatch instead of a false match', () => {
  const result = matchCashEvidence({ planCode: 'PAY-1', supplierPartner: 'V12', supplierCounterparty: '', plannedAmount: 39500, managerName: 'Тохов Астемир', plannedDate: '2026-09-09' }, [{
    ref: 'request-p43', amount: 39500, payment_date: '2026-09-09', requested_by: { name: 'Тохов Астемир' }, counterparty: { name: 'P43' },
    linked_cash_expense_orders: { rows: [{ ref: 'rko-p43', number: '99', posted: true, deletion_mark: false, amount: 39500 }] },
  }]);
  assert.equal(result.state, 'MISMATCH');
  assert.equal(result.actualSupplier, 'P43');
});

test('plan code is recognizable for 1C comment matching', () => {
  assert.equal(buildPaymentPlanCode(new Date('2026-09-09T10:00:00Z'), 0.000001), 'PAY-20260909-000001');
});

test('existing USDT balance postpones safe visit to the next cash payment', () => {
  const result = calculateCashPreparation([
    { id: 'usdt', plannedDate: '2026-09-10', plannedAmount: 400000, paymentMethod: 'USDT', foreignAmount: 4800, exchangeRate: 83.33, commissionAmount: 2500 },
    { id: 'cash', plannedDate: '2026-09-12', plannedAmount: 95000, paymentMethod: 'CASH' },
  ], 5741.1, '2026-09-09');
  assert.deepEqual(result.rows, [{ planId: 'cash', plannedDate: '2026-09-12', cashRequired: 95000 }]);
  assert.equal(result.usdtDeficit, 0);
});

test('USDT deficit is converted to rubles with planned commission', () => {
  const result = calculateCashPreparation([{ id: 'usdt', plannedDate: '2026-09-10', plannedAmount: 400000, paymentMethod: 'USDT', foreignAmount: 4800, exchangeRate: 83, commissionAmount: 2500 }], 3000, '2026-09-09');
  assert.equal(result.rows[0].cashRequired, 151900);
  assert.equal(result.usdtDeficit, 1800);
});

test('unknown USDT amount keeps the requested rubles in cash preparation', () => {
  const result = calculateCashPreparation([
    { id: 'usdt-pending', plannedDate: '2026-09-11', plannedAmount: 700000, paymentMethod: 'USDT' },
  ], 3400, '2026-09-09');
  assert.deepEqual(result.rows, [{
    planId: 'usdt-pending',
    plannedDate: '2026-09-11',
    cashRequired: 700000,
    estimated: true,
  }]);
  assert.equal(result.unknownUsdtCount, 1);
  assert.equal(result.usdtDeficit, null);
});
