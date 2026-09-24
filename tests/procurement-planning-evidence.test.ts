import test from 'node:test';
import assert from 'node:assert/strict';
import { planningDiscovery, verifiedOrderDebt } from '../lib/procurement-planning-evidence';
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
function fixture() {
  const dims = { analytics_ref: id(1), organization_ref: id(2), counterparty_ref: id(3), contract_ref: id(4), currency_ref: id(5) };
  const balance = { ...dims, receipt_ref: id(6), supplier_ref: id(7), settlement_object_ref: id(8),
    due_date: '', arising_date: '', currency_name: 'руб', raw_debt_balance: 1000, raw_prepayment_balance: 0 };
  const link = { receipt_ref: id(6), order_ref: id(8), manager_ref: id(9), manager_name: 'Астемир',
    order_supplier_ref: id(7), order_counterparty_ref: id(3), order_posted: true, order_deleted: false };
  const discovery: any = { ok: true, complete: true, balances_complete: true, links_complete: true,
    contract_version: 'supplier-unpaid-receipts-v3', write_operations: false, supplier_reconciliation_required: true,
    automatic_payment_recommendation_allowed: false, amount_scope: 'receipt_balance_dimensions_not_allocated_to_orders',
    balances: [balance], order_links: [link] };
  const detail: any = { ok: true, complete: true, write_operations: false, planning_links_contract: 'supplier-planning-links-v1',
    order_links_complete: true, order_links_scope: 'all_header_and_goods_order_links_for_returned_receipts',
    order: [{ order_ref: id(8), manager_ref: id(9), manager_name: 'Астемир', supplier_ref: id(7), supplier_name: 'Поставщик',
      posted: true, deleted: false, order_number: '385', status_name: 'Закрыт' }],
    receipts: [{ receipt_ref: id(6), posted: true }], order_links: [link] };
  const supplier: any = { ok: true, complete: true, ledger_complete: true, documents_complete: true,
    contract_version: 'supplier-reconciliation-v1', as_of: '24.09.2026 12:00:00', write_operations: false,
    automatic_completion_allowed: false, automatic_payment_recommendation_allowed: false,
    supplier: [{ supplier_ref: id(7) }], ledger_balances: [{ ...dims, settlement_object_ref: id(8), raw_balance: -1000 }],
    document_balances: [{ ...balance, settlement_document_ref: id(6) }] };
  return { discovery, detail, supplier };
}
const run = (f: ReturnType<typeof fixture>) => verifiedOrderDebt(planningDiscovery(f.discovery), id(8), f.detail, f.supplier);
test('closed order with exact receipt debt and no unallocated advances is eligible', () => {
  assert.equal(run(fixture())?.debtMinor, 100000);
});
test('shared acquisition cannot be offered twice', () => {
  const f = fixture(); const other = { ...f.discovery.order_links[0], order_ref: id(10) };
  f.discovery.order_links.push(other); f.detail.order_links = [...f.discovery.order_links];
  assert.equal(run(f), null);
});
test('supplier advances block another payment even with a positive receipt debt', () => {
  const f = fixture(); f.supplier.document_balances[0].raw_prepayment_balance = 100;
  f.supplier.ledger_balances[0].raw_balance = -900;
  assert.equal(run(f), null);
});
test('missing contract, foreign money, wrong ownership and stale amounts need review', () => {
  for (const mutate of [
    (f: ReturnType<typeof fixture>) => { f.discovery.balances[0].contract_ref = id(0); },
    (f: ReturnType<typeof fixture>) => { f.discovery.balances[0].currency_name = 'USD'; },
    (f: ReturnType<typeof fixture>) => { f.detail.order[0].manager_ref = id(20); },
    (f: ReturnType<typeof fixture>) => { f.discovery.balances[0].raw_debt_balance = 999; },
    (f: ReturnType<typeof fixture>) => { f.detail.order_links_complete = false; },
  ]) { const f = fixture(); mutate(f); assert.equal(run(f), null); }
});
test('small debt is excluded, not changed in source', () => {
  const f = fixture(); f.discovery.balances[0].raw_debt_balance = 500;
  f.supplier.document_balances[0].raw_debt_balance = 500; f.supplier.ledger_balances[0].raw_balance = -500;
  assert.equal(run(f), null); assert.equal(f.discovery.balances[0].raw_debt_balance, 500);
});
test('incomplete discovery and duplicate balance rows fail closed', () => {
  const f = fixture(); f.discovery.complete = false;
  assert.throws(() => planningDiscovery(f.discovery));
  const g = fixture(); g.discovery.balances.push(g.discovery.balances[0]);
  assert.throws(() => planningDiscovery(g.discovery));
});
