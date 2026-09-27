import test from 'node:test';
import assert from 'node:assert/strict';
import { deliveryCashFromStatement } from '../lib/procurement-delivery-evidence';
import { DELIVERY_PERSON, deliveryAction, deliveryUserAllowed } from '../lib/procurement-delivery-policy';

const now = Date.parse('2026-09-27T12:00:00Z');
const window = { from: '2026-09-27', to: '2026-09-27' };
const dimension = { organization_ref: String(DELIVERY_PERSON.organizationRef), currency_ref: String(DELIVERY_PERSON.currencyRef), department_ref: 'procurement', purpose_ref: '', purpose_name: 'Обычная' };
function fixture() {
  return { ok: true, complete: true, contract_version: 'accountable-statement-v1', mode: 'read-only', write_operations: false,
    automatic_spending_allowed: false, balance_meaning: 'accounting_only_not_cash_on_hand', person_ref: DELIVERY_PERSON.ref, person_name: DELIVERY_PERSON.name,
    date_from: window.from, date_to: window.to, as_of: '27.09.2026 15:00:00', end_exclusive: '27.09.2026 15:00:01',
    opening: [{ ...dimension, amount: 100, to_report: 999 }, { ...dimension, department_ref: '', amount: -50, to_report: 0 }],
    closing: [{ ...dimension, amount: 120, to_report: 999 }, { ...dimension, department_ref: '', amount: -50, to_report: 0 }],
    movements: [{ ...dimension, document_ref: 'cash-1', line_number: 1, period: '27.09.2026 10:00:00', posted: true, deleted: false, sign: 1, amount: 20, to_report: 0 }],
  };
}
test('money nets departments, not report resource; empty validated closing is zero', () => {
  assert.equal(deliveryCashFromStatement(fixture(), window, now).balance, 70);
  const zero = fixture(); zero.opening = []; zero.closing = []; zero.movements = [];
  assert.equal(deliveryCashFromStatement(zero, window, now).balance, 0);
});
test('never nets another organization or currency', () => {
  const data = fixture();
  for (const patch of [{ organization_ref: 'other-org' }, { currency_ref: 'CNY' }]) {
    const row = { ...dimension, ...patch, amount: 99999, to_report: 0 };
    data.opening.push(row); data.closing.push(row);
  }
  assert.equal(deliveryCashFromStatement(data, window, now).balance, 70);
});
test('incomplete, wrong identity/window, stale, duplicate, string money and non-reconciling evidence fail closed', () => {
  const changes: ((d: any) => void)[] = [
    d => d.complete = false, d => d.person_ref = 'wrong', d => d.date_to = '2026-09-26',
    d => d.as_of = '27.09.2026 14:00:00', d => d.opening.push(d.opening[0]), d => d.movements.push(d.movements[0]),
    d => d.movements[0].amount = '20', d => d.closing[0].amount = 121,
    d => d.movements[0].posted = false, d => d.movements[0].deleted = true,
    d => d.movements[0].period = '26.09.2026 10:00:00', d => d.closing[0].to_report = 10,
    d => d.closing = null, d => d.write_operations = true,
  ];
  for (const change of changes) { const data = fixture(); change(data); assert.throws(() => deliveryCashFromStatement(data, window, now)); }
});
test('alert hysteresis retains one partial top-up request until the reserve is restored', () => {
  const action = (balance: number | null, active: boolean, manual = false) => deliveryAction({ snapshot: { balance, checkedAt: new Date(now).toISOString() }, active, manual, now });
  assert.equal(action(20000, false), 'open'); assert.equal(action(20000.01, false), 'keep');
  assert.equal(action(25000, false, true), 'open'); assert.equal(action(25000, true), 'keep');
  assert.equal(action(35000, true), 'cover'); assert.equal(action(null, true), 'keep');
  assert.equal(action(-1000, false), 'open'); assert.equal(action(35000, false, true), 'keep');
  assert.equal(deliveryAction({ snapshot: { balance: 0, checkedAt: '2020-01-01' }, active: false, manual: true, now }), 'keep');
});
test('only exact, active procurement employee mapping is allowed', () => {
  const user = { role: 'EMPLOYEE', portalArea: 'PROCUREMENT', oneCManagerName: DELIVERY_PERSON.name, isActive: true };
  assert.equal(deliveryUserAllowed(user), true);
  for (const patch of [{ role: 'ADMIN' }, { portalArea: 'WORKDAY' }, { oneCManagerName: 'Астемир' }, { isActive: false }]) assert.equal(deliveryUserAllowed({ ...user, ...patch }), false);
});
