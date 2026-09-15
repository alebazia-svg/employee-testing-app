import assert from 'node:assert/strict';
import test from 'node:test';
import { settlementCalculationReady } from '../lib/procurement-cash-forecast-settlements';

const fixture = () => ({
  ok: true, endpoint: 'supplier-settlements', status: 'draft',
  sign_convention: 'Supplier debt is negative; overpayment or positive balance is positive. closing_balance = opening_balance - debt_increase + debt_decrease.',
  rows: [{ supplier_partner: '95-RU', currency: 'руб', opening_balance: -100, debt_increase: 50, debt_decrease: 20, closing_balance: -130 }],
  totals: { is_limited: false, rows_count: 1, opening_balance: -100, debt_increase: 50, debt_decrease: 20, closing_balance: -130 },
});
test('a draft release label does not discard a complete reconciled settlement report', () => {
  assert.equal(settlementCalculationReady(fixture()), true);
});
test('invalid totals, signs, truncated rows and currencies cannot become payment evidence', () => {
  const badTotal = fixture(); badTotal.totals.closing_balance = -129;
  const badRow = fixture(); badRow.rows[0].closing_balance = -129;
  const truncated = fixture(); truncated.totals.is_limited = true;
  const badSign = fixture(); badSign.sign_convention = 'unknown';
  const badCurrency = fixture(); badCurrency.rows[0].currency = 'USDT';
  for (const value of [badTotal, badRow, truncated, badSign, badCurrency]) assert.equal(settlementCalculationReady(value), false);
});
