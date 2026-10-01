import { test } from 'node:test';
import assert from 'node:assert/strict';
import { payrollReviewPrice } from '../lib/payroll-review-price';
test('weighted selling price uses revenue and quantity, not payroll or cost', () => {
  assert.equal(payrollReviewPrice([{quantity: 2, revenue: 200}, {quantity: 1, revenue: 160}]).average, 120);
  assert.equal(payrollReviewPrice([{quantity: 1, revenue: 46696}]).average, 46696);
});
test('missing quantities never become a fabricated unit price', () => {
  assert.equal(payrollReviewPrice([{revenue: 400}]).average, null);
  assert.equal(payrollReviewPrice([{revenue: 400, quantity: NaN}]).quantity, null);
});
test('returns and zero quantities require source inspection', () => {
  assert.equal(payrollReviewPrice([{revenue: 0, quantity: 0}]).average, null);
  assert.equal(payrollReviewPrice([{revenue: -100, quantity: -1}]).average, null);
  assert.equal(payrollReviewPrice([{revenue: 200, quantity: 2}, {revenue: -50, quantity: -1}]).average, null);
});
