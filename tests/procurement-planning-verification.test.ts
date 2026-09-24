import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyPlanningOrder } from '../lib/procurement-planning-verification';
import { planningDiscovery } from '../lib/procurement-planning-evidence';
import { normalizeSupplierOrder } from '../lib/procurement-payment-source';

const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
function fixture() {
  const dims = { analytics_ref: id(1), organization_ref: id(2), counterparty_ref: id(3), contract_ref: id(4), currency_ref: id(5), settlement_object_ref: id(8) };
  const balance = { ...dims, receipt_ref: id(6), supplier_ref: id(7), due_date: '', arising_date: '', currency_name: 'руб', raw_debt_balance: 1000, raw_prepayment_balance: 0 };
  const link = { receipt_ref: id(6), order_ref: id(8), manager_ref: id(9), manager_name: 'Астемир', order_supplier_ref: id(7), order_counterparty_ref: id(3), order_posted: true, order_deleted: false };
  const discovery: any = { ok: true, complete: true, balances_complete: true, links_complete: true, contract_version: 'supplier-unpaid-receipts-v3', write_operations: false, supplier_reconciliation_required: true, automatic_payment_recommendation_allowed: false, amount_scope: 'receipt_balance_dimensions_not_allocated_to_orders', balances: [balance], order_links: [link] };
  const detail: any = { ok: true, complete: true, mode: 'read-only', write_operations: false, automatic_completion_allowed: false,
    planning_links_contract: 'supplier-planning-links-v1', order_links_complete: true, order_links_scope: 'all_header_and_goods_order_links_for_returned_receipts',
    contract_version: 'supplier-document-evidence-v1', new_settlement_architecture: true,
    due_date_balance_scope: 'exact_settlement_documents_all_history_through_as_of', receipt_source_movement_scope: 'linked_receipt_registrars_all_history_through_as_of',
    due_date_movement_scope: 'requested_window_exact_receipt_links_or_order_object', receipt_amount_scope: 'whole_receipt_not_allocated_to_order',
    as_of: '24.09.2026 12:00:00', movement_date_from: '01.09.2026 0:00:00',
    order: [{ order_ref: id(8), manager_ref: id(9), manager_name: 'Астемир', supplier_ref: id(7), supplier_name: 'Поставщик', posted: true, deleted: false, order_number: '385', status_name: 'Закрыт' }],
    receipts: [{ receipt_ref: id(6), receipt_number: '771', receipt_date: '15.09.2026 0:00:00', posted: true, currency_ref: id(5), currency_name: 'руб', document_amount: 5000 }],
    order_links: [link], balances: [], movements: [], receipt_source_movements: [], due_date_movements: [],
    due_date_balances: [{ ...balance, settlement_document_ref: id(6) }] };
  const supplier: any = { ok: true, complete: true, ledger_complete: true, documents_complete: true, contract_version: 'supplier-reconciliation-v1', as_of: detail.as_of, write_operations: false, automatic_completion_allowed: false, automatic_payment_recommendation_allowed: false,
    supplier: [{ supplier_ref: id(7) }], ledger_balances: [{ ...dims, raw_balance: -1000 }], document_balances: [{ ...balance, settlement_document_ref: id(6) }] };
  const row = normalizeSupplierOrder({ ref: id(8), manager: 'Астемир', supplier_partner: 'Поставщик', order_payment_gap: 22000, receipt_amount: 5000 })!;
  return { discovery, detail, supplier, row, dims };
}
const run = (f: ReturnType<typeof fixture>) => verifyPlanningOrder(f.row, planningDiscovery(f.discovery), f.detail, f.supplier, '2026-09-24T09:00:00Z');
test('closed status and order amount cannot override actual receipt debt', () => {
  const r = run(fixture()); assert.equal(r.planningState, 'receipt_debt'); assert.equal(r.orderPaymentGap, 1000);
});
test('contract advance, shared receipt and inconsistent supplier balances never become payable', () => {
  for (const mutate of [
    (f: ReturnType<typeof fixture>) => { f.supplier.document_balances[0].raw_prepayment_balance = 100; f.supplier.ledger_balances[0].raw_balance = -900; },
    (f: ReturnType<typeof fixture>) => f.detail.order_links.push({ ...f.detail.order_links[0], order_ref: id(33) }),
    (f: ReturnType<typeof fixture>) => { f.supplier.ledger_balances[0].raw_balance = -500; },
  ]) { const f = fixture(); mutate(f); assert.equal(run(f).planningState, 'needs_review'); }
});
test('live prepayment is preserved; closed or incomplete source is not prepayment', () => {
  const f = fixture(); f.detail.receipts = []; f.detail.order_links = []; f.discovery.balances = []; f.discovery.order_links = []; f.row.receiptAmount = 0;
  f.detail.order[0].status_name = 'К поступлению';
  assert.equal(run(f).planningState, 'prepayment');
  assert.deepEqual(run(f).noAcquisitions, {checkedAt:'2026-09-24T09:00:00Z'});
  f.supplier.document_balances[0].raw_prepayment_balance = 100;
  f.supplier.ledger_balances[0].raw_balance = -900;
  assert.equal(run(f).planningState, 'needs_review', 'existing advance cannot become another automatic prepayment');
  assert.ok(run(f).noAcquisitions, 'an advance does not hide the verified absence of acquisitions');
  f.supplier.document_balances[0].raw_prepayment_balance = 0;
  f.supplier.ledger_balances[0].raw_balance = -1000;
  f.detail.order[0].status_name = 'Закрыт'; assert.equal(run(f).planningState, 'needs_review');
  f.detail.complete = false; assert.equal(run(f).planningState, 'needs_review');
  assert.equal(run(f).noAcquisitions, undefined);
});

test('no-acquisition label requires complete consistent links and clears stale evidence', () => {
  for (const mutate of [
    (f: ReturnType<typeof fixture>) => { f.detail.complete = false; },
    (f: ReturnType<typeof fixture>) => { f.detail.ok = false; },
    (f: ReturnType<typeof fixture>) => { f.detail.order_links_complete = false; },
    (f: ReturnType<typeof fixture>) => { f.detail.order[0].supplier_name = 'Другой'; },
    (f: ReturnType<typeof fixture>) => { f.row.receiptAmount = 5000; },
    (f: ReturnType<typeof fixture>) => { f.detail.order_links = [{order_ref:f.row.ref}]; },
    (f: ReturnType<typeof fixture>) => { f.discovery = fixture().discovery; },
  ]) {
    const f = fixture(); f.detail.receipts = []; f.detail.order_links = [];
    f.discovery.balances = []; f.discovery.order_links = []; f.row.receiptAmount = 0;
    f.row.noAcquisitions = {checkedAt:'old'};
    mutate(f);
    assert.equal(run(f).noAcquisitions, undefined);
  }
});
test('settled requires full recognized acquisition and equal offset, not empty debt alone', () => {
  const f = fixture(); f.discovery.balances = []; f.discovery.order_links = [];
  f.detail.due_date_balances = []; f.supplier.ledger_balances = []; f.supplier.document_balances = [];
  assert.equal(run(f).planningState, 'needs_review');
  f.detail.receipt_source_movements = [{ ...f.dims, recorder_ref: id(6), line_number: 1, raw_amount: 5000 }];
  f.detail.due_date_movements = ['Приход', 'Расход'].map((movement_type, i) => ({ ...f.dims, recorder_ref: id(20), line_number: i + 1, settlement_document_ref: id(6), source_recorder_ref: i ? id(21) : id(6), movement_date: '15.09.2026 0:00:00', movement_type, raw_debt: 5000 }));
  const r = run(f); assert.equal(r.planningState, 'settled'); assert.equal(r.orderPaymentGap, 0);
  assert.equal(f.row.orderPaymentGap, 22000, 'input unchanged');
  f.detail.movement_date_from = '20.09.2026 0:00:00'; assert.equal(run(f).planningState, 'needs_review');
});
test('fresh balance disagreement and foreign currency cannot be hidden as closed', () => {
  const f = fixture(); f.detail.due_date_balances[0].raw_debt_balance = 999;
  assert.equal(run(f).planningState, 'needs_review');
  const g = fixture(); g.detail.receipts[0].currency_name = 'USDT'; assert.equal(run(g).planningState, 'needs_review');
});
test('an advance on another settlement document preserves measured receipt debt but requires allocation review', () => {
  const f=fixture();
  f.supplier.document_balances.push({...f.supplier.document_balances[0],settlement_document_ref:id(30),raw_debt_balance:0,raw_prepayment_balance:700});
  f.supplier.ledger_balances[0].raw_balance=-300;
  const r=run(f);
  assert.equal(r.planningState,'needs_review');
  assert.equal(r.receiptSettlement?.debtRub,1000);
  assert.equal(r.orderPaymentGap,1000,'supplier advances do not replace the measured receipt balance with the raw order gap');
  assert.equal(r.receiptSettlement?.requiresAdvanceReview,true);
  assert.deepEqual(r.receiptSettlement?.supplier,{ref:id(7),grossDebtRub:1000,creditsRub:700,netOwedRub:300});
  f.detail.complete=false; f.row={...r};
  assert.equal(run(f).receiptSettlement,undefined,'failed rechecks never retain an apparently fresh amount');
});
