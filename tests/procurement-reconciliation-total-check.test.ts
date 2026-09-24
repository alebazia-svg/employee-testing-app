import assert from 'node:assert/strict';
import test from 'node:test';
import { supplierTotalCheck } from '../lib/procurement-reconciliation-total-check';
const date = '2026-09-23';
function fixture() {
  return {
    detail: { ledger_balances: [{ contract_name: 'Договор', contract_ref: 'c', currency_name: 'руб', currency_ref: 'r', raw_balance: -10.92 }] },
    report: { ok: true, endpoint: 'supplier-settlements', date_from: date, date_to: date,
      sign_convention: 'Supplier debt is negative; overpayment or positive balance is positive. closing_balance = opening_balance - debt_increase + debt_decrease.',
      totals: { is_limited: false, rows_count: 1 }, rows: [{ supplier_partner: 'Supplier', supplier_counterparty: 'Counterparty',
        organization: 'Org', contract: 'Договор', currency: 'руб', opening_balance: 0, debt_increase: 10.92, debt_decrease: 0, closing_balance: -10.92 }] },
  };
}
test('matching report confirms the current detailed balance', () => {
  const { detail, report } = fixture();
  assert.equal(supplierTotalCheck(detail, report, 'Supplier', date), true);
});
test('changed, truncated and wrong-day reports do not verify', () => {
  for (const mutate of [
    (p: ReturnType<typeof fixture>['report']) => { p.rows[0].closing_balance = -20; },
    (p: ReturnType<typeof fixture>['report']) => { p.totals.is_limited = true; },
    (p: ReturnType<typeof fixture>['report']) => { p.date_to = '2026-09-22'; },
    (p: ReturnType<typeof fixture>['report']) => { p.rows[0].supplier_partner = 'Different'; },
  ]) {
    const { detail, report } = fixture(); mutate(report);
    assert.equal(supplierTotalCheck(detail, report, 'Supplier', date), false);
  }
});
test('a coincident total in another contract or currency is not confirmation', () => {
  for (const field of ['contract', 'currency'] as const) {
    const { detail, report } = fixture(); report.rows[0][field] = 'Other';
    assert.equal(supplierTotalCheck(detail, report, 'Supplier', date), false);
  }
});
test('duplicate report rows and ambiguous contract names are rejected', () => {
  const { detail, report } = fixture();
  report.rows.push(report.rows[0]); report.totals.rows_count = 2;
  assert.equal(supplierTotalCheck(detail, report, 'Supplier', date), false);
  const f = fixture(); f.detail.ledger_balances.push({ ...f.detail.ledger_balances[0], contract_ref: 'another', raw_balance: 0 });
  assert.equal(supplierTotalCheck(f.detail, f.report, 'Supplier', date), false);
});
