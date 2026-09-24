import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateAcquisitionSettlement } from '@/lib/procurement-acquisition-settlement';

// Sanitized shape of the verified order 385 / acquisition 771 example.
function fixture() {
  const dimension = { analytics_ref: 'analytics', settlement_object_ref: 'order', currency_ref: 'rub', settlement_document_ref: 'receipt' };
  return {
    ok: true, complete: true, mode: 'read-only', write_operations: false, automatic_completion_allowed: false,
    contract_version: 'supplier-document-evidence-v1', new_settlement_architecture: true,
    due_date_balance_scope: 'exact_settlement_documents_all_history_through_as_of',
    receipt_source_movement_scope: 'linked_receipt_registrars_all_history_through_as_of',
    due_date_movement_scope: 'requested_window_exact_receipt_links_or_order_object',
    receipt_amount_scope: 'whole_receipt_not_allocated_to_order',
    as_of: '22.09.2026 19:35:46', movement_date_from: '01.09.2026 0:00:00',
    order: [{ order_ref: 'order', posted: true, deleted: false, document_amount: 199073.94, status_name: 'Закрыт' }],
    receipts: [{ receipt_ref: 'receipt', receipt_number: '771', receipt_date: '15.09.2026 0:00:00',
      posted: true, currency_ref: 'rub', currency_name: 'руб', document_amount: 503540.13 }],
    balances: [], movements: [],
    receipt_source_movements: [{ ...dimension, recorder_ref: 'receipt', line_number: 1, raw_amount: 503540.13 }],
    due_date_movements: [
      { ...dimension, recorder_ref: 'register', line_number: 1, source_recorder_ref: 'receipt', movement_date: '15.09.2026 0:00:00', movement_type: 'Приход', raw_debt: 503540.13 },
      { ...dimension, recorder_ref: 'register', line_number: 2, source_recorder_ref: 'rko', movement_date: '21.09.2026 13:50:41', movement_type: 'Расход', raw_debt: 503540.13 },
    ],
    due_date_balances: [] as Record<string, unknown>[],
  };
}
const evaluate = (p: unknown) => evaluateAcquisitionSettlement(p, 'order');
test('acquisition settlement is independent of closed order amount and never closes a plan', () => {
  const r = evaluate(fixture());
  assert.equal(r.state, 'verified');
  assert.equal(r.receipts[0].status, 'settled');
  assert.equal(r.receipts[0].documentAmountMinor, 50354013);
  assert.equal(r.receipts[0].outstandingMinor, 0);
  assert.equal(r.automaticCompletionAllowed, false);
});
test('empty balances without movements do not prove payment', () => {
  const f = fixture(); f.due_date_movements = [];
  assert.equal(evaluate(f).receipts[0].status, 'needs_review');
  assert.equal(evaluate(f).receipts[0].outstandingMinor, null);
});
test('receipt older than requested movement window is not assumed paid', () => {
  const f = fixture(); f.movement_date_from = '20.09.2026 0:00:00';
  assert.equal(evaluate(f).receipts[0].status, 'needs_review');
});
test('small residual remains an actual debt, not a write-off', () => {
  const f = fixture(); f.due_date_balances = [{ analytics_ref: 'analytics', settlement_object_ref: 'order',
    settlement_document_ref: 'receipt', currency_ref: 'rub', raw_debt_balance: 50, raw_prepayment_balance: 0 }];
  assert.equal(evaluate(f).receipts[0].status, 'debt');
  assert.equal(evaluate(f).receipts[0].outstandingMinor, 5000);
});
test('partial debt survives even when acquisition predates movement window', () => {
  const f = fixture(); f.movement_date_from = '20.09.2026 0:00:00'; f.due_date_movements = [];
  f.due_date_balances = [{ analytics_ref: 'analytics', settlement_object_ref: 'contract',
    settlement_document_ref: 'receipt', currency_ref: 'rub', raw_debt_balance: 84512.66, raw_prepayment_balance: 0 }];
  assert.equal(evaluate(f).receipts[0].outstandingMinor, 8451266);
});
test('foreign currency and different analytics cannot cancel each other', () => {
  const f = fixture(); f.due_date_movements[1].currency_ref = 'usdt';
  assert.equal(evaluate(f).receipts[0].status, 'needs_review');
  f.due_date_movements[1].currency_ref = 'rub'; f.due_date_movements[1].analytics_ref = 'other';
  assert.equal(evaluate(f).receipts[0].status, 'needs_review');
});
test('partial responses, old contracts, wrong order and missing arrays fail closed', () => {
  for (const p of [{ ...fixture(), complete: false }, { ...fixture(), contract_version: 'old' },
    { ...fixture(), order: [] }, { ...fixture(), receipts: undefined }, { ...fixture(), new_settlement_architecture: false }]) {
    assert.equal(evaluate(p).state, 'unavailable');
  }
});
test('duplicates and unrelated contract balances invalidate source', () => {
  const f = fixture(); f.due_date_movements.push(f.due_date_movements[0]);
  assert.equal(evaluate(f).reason, 'DUPLICATE_GRAIN');
  const other = fixture(); other.due_date_balances = [{ settlement_document_ref: 'other-receipt' }];
  assert.equal(evaluate(other).reason, 'UNRELATED_BALANCE');
});
test('receipt without acquisition recognition or with invalid amount is not settled', () => {
  const f = fixture(); f.receipt_source_movements = [];
  assert.equal(evaluate(f).receipts[0].status, 'needs_review');
  f.receipts[0].document_amount = NaN;
  assert.equal(evaluate(f).state, 'unavailable');
});
test('missing and negative debt values cannot become zero', () => {
  const f = fixture(); f.due_date_movements[1].raw_debt = -503540.13;
  assert.equal(evaluate(f).receipts[0].status, 'needs_review');
  assert.equal(evaluate({ ...fixture(), due_date_movements: [{ ...fixture().due_date_movements[0], raw_debt: null }] }).state, 'unavailable');
});
test('no receipts means no financial completion conclusion', () => {
  const f = fixture(); f.receipts = []; f.due_date_movements = []; f.receipt_source_movements = [];
  assert.deepEqual(evaluate(f).receipts, []);
});
