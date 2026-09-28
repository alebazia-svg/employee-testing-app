import test from 'node:test';
import assert from 'node:assert/strict';
import { deliveryFundingFromEvidence, deliveryFundingForManagerCashboxes } from '../lib/procurement-delivery-funding';
import { DELIVERY_PERSON as P } from '../lib/procurement-delivery-policy';
const now = Date.parse('2026-09-27T12:00:00Z');
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
function fixture(): any {
  return { ok: true, complete: true, contract_version: 'cash-funding-context-v2', organization_ref: P.organizationRef,
    mode: 'read-only', write_operations: false, snapshot_consistent: false, automatic_spending_allowed: false,
    automatic_cashbox_selection_allowed: false, available_cash_calculated: false,
    payables_scope: 'current_active_register_all_dates_including_future_plans',
    requests_scope: 'non_deleted_unposted_or_no_active_history_or_nonzero_native_balance_all_dates_all_forms',
    movement_scope: 'nonzero_groups_only_same_grain_as_native_balances',
    cash_as_of: '2026-09-27T15:00:00', read_finished_at: '2026-09-27T15:00:01',
    sections_complete: Object.fromEntries(['cash', 'requests', 'distribution', 'payables', 'payable_movements'].map(s => [s, true])),
    cash: [{ cashbox_ref: id(1), cashbox_name: 'Касса А', currency_ref: P.currencyRef, deleted: false, balance: 50000 }],
    requests: [{ request_ref: id(2), number: '000F-000001', date: '01.01.2025 10:00:00', organization_ref: P.organizationRef,
      currency_ref: P.currencyRef, version_token: 'AQ==', amount: 20000, posted: true, status_key: 'payable',
      is_accountable_issue: true, multiple_recipients: false, accountable_person_ref: P.ref }],
    distribution: [{ request_ref: id(2), line_number: 1, amount: 20000 }],
    payables: [{ document_ref: id(2), source_ref: id(1), recipient_ref: P.ref, remaining_amount: 7000 }],
    payable_movements: [{ document_ref: id(2), source_ref: id(1), recipient_ref: P.ref, planned_amount: 20000, executed_amount: 13000 }],
  };
}
test('partial payment counted once; old requests retained, no available cash or autochoice', () => {
  const v = deliveryFundingFromEvidence(fixture(), now);
  assert.equal(v.cashboxes[0].balance, 50000); assert.equal(v.cashboxes[0].pending, 7000);
  assert.equal(v.topups[0].remaining, 7000); assert.match(v.topups[0].date, /^2025/);
  assert.equal('availableCash' in v, false); assert.equal('recommendedCashbox' in v, false);
});
test('manager scope uses exact mappings, deduplicates, never falls back to safes or name matching', () => {
  const d = fixture();
  d.cash.push({ ...d.cash[0], cashbox_ref: id(8), cashbox_name: 'Сейф' },
    { ...d.cash[0], cashbox_ref: id(9), cashbox_name: 'Касса А' });
  const all = deliveryFundingFromEvidence(d, now);
  const scoped = deliveryFundingForManagerCashboxes(all, [id(1), id(1)]);
  assert.deepEqual(scoped.cashboxes.map(b => b.ref), [id(1)]);
  assert.equal(scoped.cashboxes[0].pending, 7000);
  assert.deepEqual(scoped.topups, all.topups);
  assert.equal(scoped.unassignedAmount, all.unassignedAmount);
  assert.equal(deliveryFundingForManagerCashboxes(all, []).cashboxes.length, 0);
  assert.equal(all.cashboxes.length, 3);
  assert.throws(() => deliveryFundingForManagerCashboxes(all, ['Касса А']));
});
test('unallocated requests never assigned by header/name or deducted from a random box', () => {
  const d = fixture(); d.requests[0].requested_cashbox_ref = id(1);
  d.payables[0].source_ref = null; d.payable_movements[0].source_ref = null;
  const v = deliveryFundingFromEvidence(d, now);
  assert.equal(v.unassignedAmount, 7000); assert.equal(v.unassignedCount, 1); assert.equal(v.cashboxes[0].pending, 0);
});
test('missing history is unknown, not paid or full amount to issue', () => {
  const d = fixture(); d.payables = []; d.payable_movements = [];
  const v = deliveryFundingFromEvidence(d, now); assert.equal(v.topups[0].remaining, null); assert.equal(v.reviewCount, 1);
});
test('negative remaining never increases free cash or nets a positive obligation away', () => {
  const d = fixture(); d.payables[0].remaining_amount = -500; d.payable_movements[0].executed_amount = 20500;
  const v = deliveryFundingFromEvidence(d, now); assert.equal(v.cashboxes[0].pending, null); assert.equal(v.topups[0].remaining, null);
});
test('recipient is exact, never inferred from initiator or grouped recipients', () => {
  for (const patch of [{ accountable_person_ref: id(3), requested_by_ref: P.ref }, { multiple_recipients: true }, { is_accountable_issue: false }]) {
    const d = fixture(); Object.assign(d.requests[0], patch); assert.equal(deliveryFundingFromEvidence(d, now).topups.length, 0);
  }
});
test('wrong currency, rejected/unposted/unknown requests do not get a confirmed cash amount', () => {
  for (const patch of [{ currency_ref: id(3) }, { status_key: 'rejected' }, { status_key: 'unknown' }, { posted: false }]) {
    const d = fixture(); Object.assign(d.requests[0], patch); assert.equal(deliveryFundingFromEvidence(d, now).cashboxes[0].pending, null);
  }
});
test('deleted and currency cashboxes excluded; zero and negative RUB balances remain visible', () => {
  const d = fixture(); d.cash[0].balance = -10;
  d.cash.push({ ...d.cash[0], cashbox_ref: id(4), deleted: true }, { ...d.cash[0], cashbox_ref: id(5), currency_ref: id(6) }, { ...d.cash[0], cashbox_ref: id(7), balance: 0 });
  const v = deliveryFundingFromEvidence(d, now); assert.deepEqual(v.cashboxes.map(b => b.balance), [-10, 0]);
});
test('every source defect fails closed, no partial trustworthy-looking table', () => {
  const mutations = [
    (d: any) => d.complete = false, (d: any) => d.sections_complete.payables = false,
    (d: any) => d.organization_ref = id(3), (d: any) => d.requests[0].organization_ref = id(3),
    (d: any) => d.cash_as_of = '2025-01-01', (d: any) => d.read_finished_at = '2025-01-01',
    (d: any) => d.cash[0].balance = '50000', (d: any) => d.cash[0].balance = NaN,
    (d: any) => d.requests[0].version_token = null, (d: any) => d.cash[0].currency_ref = '',
    (d: any) => d.requests[0].accountable_person_ref = '', (d: any) => d.payables[0].remaining_amount = 7001,
    (d: any) => d.distribution[0].request_ref = id(3), (d: any) => d.automatic_cashbox_selection_allowed = true,
  ];
  for (const mutation of mutations) { const d = fixture(); mutation(d); assert.throws(() => deliveryFundingFromEvidence(d, now)); }
  for (const section of ['cash', 'requests', 'distribution', 'payables', 'payable_movements']) {
    const d = fixture(); d[section].push(d[section][0]); assert.throws(() => deliveryFundingFromEvidence(d, now));
  }
});
