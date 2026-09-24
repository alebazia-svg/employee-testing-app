import assert from 'node:assert/strict';
import test from 'node:test';
import { reconcileSupplier, debtPlanningCoverage } from '../lib/procurement-settlement-reconciliation';

function fixture(debt = 100, advance = 0) {
  const dims = { analytics_ref: 'a', organization_ref: 'org', counterparty_ref: 'counterparty',
    contract_ref: 'contract', currency_ref: 'rub', settlement_object_ref: 'order' };
  return { ok: true, complete: true, ledger_complete: true, documents_complete: true,
    write_operations: false, automatic_completion_allowed: false, automatic_payment_recommendation_allowed: false,
    contract_version: 'supplier-reconciliation-v1', as_of: '22.09.2026 23:42:31',
    supplier: [{ supplier_ref: 'supplier' }],
    ledger_balances: [{ ...dims, raw_balance: advance - debt }],
    document_balances: [{ ...dims, settlement_document_ref: 'receipt', due_date: '', arising_date: '',
      raw_debt_balance: debt, raw_prepayment_balance: advance }] };
}
test('Luxo: advances and debts require review, not another payable million', () => {
  const result = reconcileSupplier(fixture(777437.68, 1684518.89), 'supplier');
  assert.equal(result.state, 'available');
  assert.equal(result.buckets[0].netMinor, 90708121);
  assert.equal(result.buckets[0].state, 'needs_review');
  assert.equal(debtPlanningCoverage(result.buckets[0], []).unplannedDebtMinor, null);
  assert.equal(result.automaticCompletionAllowed, false);
});
test('approved payments cover existing debt instead of adding it again', () => {
  const bucket = reconcileSupplier(fixture(1000), 'supplier').buckets[0];
  const result = debtPlanningCoverage(bucket, [{ id: 'p', remainingMinor: 30000 }]);
  assert.equal(result.unplannedDebtMinor, 70000);
  assert.equal(result.plannedMinor + result.unplannedDebtMinor!, 100000);
  assert.throws(() => debtPlanningCoverage(bucket, [{ id: 'p', remainingMinor: 1 }, { id: 'p', remainingMinor: 1 }]));
});
test('SmartFolio small residual remains accounted for, not written off', () => {
  const result = reconcileSupplier(fixture(10.92), 'supplier');
  assert.equal(result.buckets[0].debtMinor, 1092);
  assert.equal(result.buckets[0].state, 'debt');
});
test('unknown, incomplete, duplicate and inconsistent evidence cannot become zero debt', () => {
  for (const mutate of [
    (p: ReturnType<typeof fixture>) => { p.complete = false; },
    (p: ReturnType<typeof fixture>) => { p.document_balances.push(p.document_balances[0]); },
    (p: ReturnType<typeof fixture>) => { p.ledger_balances[0].raw_balance = 0; },
    (p: ReturnType<typeof fixture>) => { p.document_balances[0].raw_debt_balance = NaN; },
  ]) {
    const p = fixture(); mutate(p);
    assert.equal(reconcileSupplier(p, 'supplier').state, 'unavailable');
  }
  assert.equal(reconcileSupplier(fixture(), 'another').reason, 'SUPPLIER_MISMATCH');
});
test('different contracts, organizations and currencies stay separate', () => {
  for (const dim of ['contract_ref', 'organization_ref', 'currency_ref'] as const) {
    const p = fixture(); const other = fixture(0, 100);
    other.ledger_balances[0][dim] = 'other'; other.document_balances[0][dim] = 'other';
    p.ledger_balances.push(...other.ledger_balances); p.document_balances.push(...other.document_balances);
    const result = reconcileSupplier(p, 'supplier');
    assert.equal(result.buckets.length, 2);
    assert.deepEqual(result.buckets.map(b => b.state), ['debt', 'advance']);
  }
});
