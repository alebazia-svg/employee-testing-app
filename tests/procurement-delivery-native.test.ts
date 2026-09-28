import test from 'node:test';
import assert from 'node:assert/strict';
import { deliveryCollectionAmount, deliveryNativeIdentity, deliveryNativeStatus, readDeliveryLink } from '../lib/procurement-delivery-native';
import { DELIVERY_PERSON } from '../lib/procurement-delivery-policy';
const ref = '11111111-2222-3333-4444-555555555555';
const rko = '11111111-2222-3333-4444-666666666666';
export function row(issued = 0): any {
  return { ref, number: 'test', date: '2026-09-28T12:00:00', amount: 15000, version_token: 'v1',
    accountable_identity_contract: 'expense-request-accountable-v1', accountable_person: { ref: DELIVERY_PERSON.ref },
    organization: { ref: DELIVERY_PERSON.organizationRef }, currency: { ref: DELIVERY_PERSON.currencyRef },
    is_accountable_issue: true, multiple_recipients: false, payment_form: { cash: true, cashless: false, card: false },
    posted: true, deletion_mark: false, status: { key: 'payable' }, cashbox: { ref, name: 'Касса тест' }, desired_payment_date: '2026-09-29',
    execution: { source: 'РегистрНакопления.ДенежныеСредстваКВыплате', complete: true, errors: [], amounts_consistent: true,
      state: issued === 0 ? 'not_executed' : issued === 15000 ? 'fully_executed' : 'partially_executed',
      request_amount: 15000, executed_amount: issued, remaining_amount: 15000 - issued,
      register_remaining_amount: 15000 - issued, has_execution_movements: issued > 0,
      remaining_amount_source: issued > 0 ? 'money_payable_register_balance' : 'request_amount_without_execution' },
    linked_cash_expense_orders: { complete: true, truncated: false, missing_fields: [], errors: [], rows: issued ? [{
      ref: rko, posted: true, deletion_mark: false, amount: issued, request_amount: issued, executed_amount: issued,
      request_amount_conflict: false, source_paths: ['payment_line.request'], cashbox: { ref, name: 'Касса тест' },
    }] : [] },
  };
}
const status = (r: any, amount = 15000) => deliveryNativeStatus(r, new Date().toISOString(), amount);
test('approval is distinct from issue; desired date and requested cashbox survive', () => {
  const s = status(row()); assert.equal(s.state, 'payable'); assert.equal(s.issued, 0); assert.equal(s.remaining, 15000);
  assert.equal(s.cashbox, 'Касса тест'); assert.equal(s.desiredDate, '2026-09-28T21:00:00.000Z');
  for (const [key, expected] of [['not_approved', 'waiting'], ['approved', 'approved'], ['rejected', 'rejected']]) {
    const r = row(); r.status.key = key; assert.equal(status(r).state, expected);
  }
});
test('partial/full require direct posted RKO and reconciled native register', () => {
  assert.equal(status(row(5000)).state, 'partial'); assert.equal(status(row(5000)).remaining, 10000);
  assert.equal(status(row(15000)).state, 'issued'); assert.equal(status(row(15000)).remaining, 0);
});
test('only payable native status authorizes collecting the remaining amount', () => {
  assert.equal(deliveryCollectionAmount(status(row(5000))), 10000);
  const r = row(5000); r.status.key = 'approved';
  assert.equal(deliveryCollectionAmount(status(r)), null);
  assert.equal(deliveryCollectionAmount(status(row(15000))), null);
});
test('wrong recipient/org/currency/operation never leaks a status', () => {
  for (const field of ['accountable_person', 'organization', 'currency']) {
    const r = row(); r[field].ref = ref; assert.equal(deliveryNativeIdentity(r), false); assert.throws(() => status(r));
  }
  for (const patch of [{ is_accountable_issue: false }, { multiple_recipients: true }, { accountable_identity_contract: null }, { payment_form: { cash: false } }]) assert.throws(() => status({ ...row(), ...patch }));
});
test('deleted, unposted, changed amount or unknown status clear approval/paid/source', () => {
  for (const patch of [{ deletion_mark: true }, { posted: false }, { amount: 14000 }, { status: { key: 'unknown' } }]) {
    const s = status({ ...row(15000), ...patch }); assert.equal(s.state, 'review'); assert.equal(s.issued, null); assert.equal(s.cashbox, null);
  }
});
test('source failures, duplicate RKO, removed links, cancelled/reversed/overpaid RKO fail closed', () => {
  const mutations = [
    (r: any) => r.execution.complete = false,
    (r: any) => r.execution.amounts_consistent = false,
    (r: any) => r.execution.errors.push('incomplete'),
    (r: any) => r.linked_cash_expense_orders.truncated = true,
    (r: any) => r.linked_cash_expense_orders.rows.push(r.linked_cash_expense_orders.rows[0]),
    (r: any) => r.linked_cash_expense_orders.rows = [],
    (r: any) => r.linked_cash_expense_orders.rows[0].posted = false,
    (r: any) => r.linked_cash_expense_orders.rows[0].deletion_mark = true,
    (r: any) => r.linked_cash_expense_orders.rows[0].executed_amount = -15000,
    (r: any) => r.linked_cash_expense_orders.rows[0].request_amount_conflict = true,
    (r: any) => r.linked_cash_expense_orders.rows[0].source_paths = [],
    (r: any) => r.execution.register_remaining_amount = -1,
  ];
  for (const mutate of mutations) { const r = row(15000); mutate(r); const s = status(r); assert.equal(s.state, 'review'); assert.equal(s.issued, null); }
});
test('a reversed issue is read afresh, not sticky paid; a one-kopeck balance remains partial', () => {
  assert.equal(status(row(15000)).state, 'issued'); assert.equal(status(row()).state, 'payable');
  assert.equal(status(row(14999.99)).state, 'partial');
});
test('stale status and malformed audit links fail closed', () => {
  assert.equal(deliveryNativeStatus(row(), '2020-01-01').state, 'review');
  assert.throws(() => readDeliveryLink('{}'));
  const link = { version: 1, ref, date: '2026-09-28', amount: 15000, userId: 1, linkedAt: new Date().toISOString() };
  assert.deepEqual(readDeliveryLink(JSON.stringify(link)), link);
});
