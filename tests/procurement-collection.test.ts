import test from 'node:test';
import assert from 'node:assert/strict';
import { procurementCollections, procurementCollectionCopy } from '../lib/procurement-collection';
import { matchProcurementPaymentEvidence, type EvidencePlan } from '../lib/procurement-currency-payment-evidence';
import type { ExpenseRequestSourceRow } from '../lib/expense-request-source';

const order = '10000000-0000-0000-0000-000000000001';
const requestRef = '10000000-0000-0000-0000-000000000002';
const cashboxRef = '10000000-0000-0000-0000-000000000003';
const rko = '10000000-0000-0000-0000-000000000004';
const plan: EvidencePlan = { id: 'p', planCode: 'PAY-TEST', supplierPartner: 'Supplier', supplierCounterparty: 'Supplier',
  orderRefs: [order], plannedAmount: 68000, paymentMethod: 'CASH', status: 'APPROVED', createdAt: '2026-10-01T08:00:00Z' };
function request(): ExpenseRequestSourceRow {
  // Same contract/shape as the verified native request; no business identities.
  return { ref: requestRef, date: '01.10.2026 20:05:01', amount: 68000, posted: true, deletion_mark: false,
    status: { key: 'payable' }, business_operation: { name: 'Оплата поставщику' },
    source_document: { ref: order }, partner: { name: 'Supplier' }, counterparty: { name: 'Supplier' },
    currency: { name: 'руб' }, payment_form: { cash: true, cashless: false, card: false },
    cashbox: { ref: cashboxRef, name: 'Касса менеджера' }, desired_payment_date: '02.10.2026 0:00:00',
    completeness: { request: true, execution: true, linked_cash_expense_orders: true },
    execution: { complete: true, source: 'РегистрНакопления.ДенежныеСредстваКВыплате', state: 'not_executed', errors: [],
      request_amount: 68000, executed_amount: 0, remaining_amount: 68000, register_remaining_amount: 68000,
      amounts_consistent: true, has_execution_movements: false } as any,
    linked_cash_expense_orders: { complete: true, truncated: false, errors: [], missing_fields: [], rows: [] },
  };
}
const run = (r = request(), plans = [plan], payments: any[] = []) => matchProcurementPaymentEvidence(plans, [r], payments, []);
test('existing header contract links the collection, not a payment; future date never says collect now', () => {
  const e = run().get('p')!;
  assert.equal(e.issuedAmount, 0); assert.equal(e.remainingAmount, 68000);
  assert.equal(e.collection?.amount, 68000);
  assert.equal(e.collection?.date, '2026-10-02');
  assert.match(procurementCollectionCopy(e.collection!, '2026-10-01').title, /^Получить 2 октября/);
  assert.match(procurementCollectionCopy(e.collection!, '2026-10-02').title, /^Можно получить/);
});
test('deleted old native request alongside the replacement does not duplicate the invitation', () => {
  const old = { ...request(), ref: '10000000-0000-0000-0000-000000000005', deletion_mark: true, posted: false };
  assert.equal(matchProcurementPaymentEvidence([plan], [old, request()], [], []).get('p')?.collection?.requestRef, requestRef);
});
test('missing basis, other supplier, status, currency, cashbox and incomplete execution never authorize collection', () => {
  for (const patch of [
    { source_document: {} }, { partner: { name: 'Other' } }, { counterparty: { name: 'Other' } },
    { posted: false }, { deletion_mark: true }, { status: { key: 'approved' } },
    { currency: { name: 'USD' } }, { cashbox: { name: 'Касса' } }, { desired_payment_date: null },
    { payment_form: { cash: true, cashless: true, card: false } }, { business_operation: { name: 'Выдача подотчётнику' } },
    { execution: { ...request().execution, complete: false } }, { execution: { ...request().execution, register_remaining_amount: 0 } },
    { execution: { ...request().execution, remaining_amount: 67000 } },
  ]) assert.equal(run({ ...request(), ...patch } as ExpenseRequestSourceRow).get('p')?.collection, undefined, JSON.stringify(patch));
});
test('two eligible portal plans or two native permissions never guess; another manager is not ignored', () => {
  const e = run(request(), [plan, { ...plan, id: 'other-manager' }]);
  assert.ok([...e.values()].every(v => !v.collection));
  const rows = [request(), { ...request(), ref: '10000000-0000-0000-0000-000000000005' }];
  assert.equal(matchProcurementPaymentEvidence([plan], rows, [], []).get('p')?.collection, undefined);
  assert.equal(matchProcurementPaymentEvidence([plan], [request(), request()], [], []).get('p')?.collection, undefined);
});
test('foreign, unapproved, completed, later and smaller portal plans are not invitation targets', () => {
  for (const patch of [{ paymentMethod: 'USDT' }, { status: 'SUBMITTED' }, { status: 'CANCELLED' },
    { status: 'COMPLETED_WITHOUT_TOPUP' }, { createdAt: '2026-10-02T00:00:00Z' }, { plannedAmount: 67000 }, { orderRefs: [] }]) {
    assert.equal(run(request(), [{ ...plan, ...patch }]).get('p')?.collection, undefined, JSON.stringify(patch));
  }
});
test('partial RKO reduces the permission; fully executed or directly paid plan has no invitation', () => {
  for (const amount of [10000, 68000]) {
    const r = request();
    r.execution = { ...r.execution, state: amount === 68000 ? 'fully_executed' : 'partially_executed', executed_amount: amount,
      remaining_amount: 68000 - amount, register_remaining_amount: 68000 - amount, has_execution_movements: true,
      remaining_amount_source: 'money_payable_register_balance' } as any;
    r.linked_cash_expense_orders!.rows = [{ ref: rko, date: '02.10.2026 10:00:00', posted: true, deletion_mark: false,
      amount, request_amount: amount, executed_amount: amount, source_paths: ['header.request'] }];
    const payment = { ref: rko, number: 'RKO', date: '02.10.2026 10:00:00', posted: true, deleted: false,
      documentAmount: amount, documentCurrency: 'РУБ', baseDocumentRef: order, supplier: 'Supplier', counterparty: 'Supplier' };
    const e = run(r, [plan], [payment]).get('p')!;
    assert.equal(e.issuedAmount, amount);
    assert.equal(e.collection?.amount, amount === 68000 ? undefined : 58000);
    if (amount === 68000) assert.equal(run(request(), [plan], [payment]).get('p')?.collection, undefined, 'direct RKO overrides stale unexecuted request');
  }
});
test('ambiguous payment allocation and over-budget permission are blocked without changing the evidence', () => {
  const e = run();
  e.get('p')!.rubleAllocationNeedsReview = true;
  assert.equal(procurementCollections([plan], [request()], e).size, 0);
  e.get('p')!.rubleAllocationNeedsReview = false; e.get('p')!.remainingAmount = 60000;
  assert.equal(procurementCollections([plan], [request()], e).size, 0);
});
