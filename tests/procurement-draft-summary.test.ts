import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeDraftUsdt } from '../lib/procurement-draft-summary';
const row = (rub: string, usdt = '') => ({paymentMethod: 'USDT', plannedAmount: rub, foreignAmount: usdt});
test('mixed exact and estimated USDT are not added as rubles twice', () => {
  const result = summarizeDraftUsdt([row('200000'), row('', '1000')], 89);
  assert.equal(result.exactUsdt, 1000);
  assert.equal(result.rublesAwaitingUsdt, 200000);
  assert.equal(result.estimatedRubles, 289000);
  assert.equal(result.requiredUsdt, 1000 + 200000 / 89);
});
test('exact USDT wins over a conflicting ruble reference', () => {
  assert.equal(summarizeDraftUsdt([row('132234', '1000')], 89).estimatedRubles, 89000);
});
test('unknown rate is not zero cost', () => {
  assert.equal(summarizeDraftUsdt([row('', '1000')], null).estimatedRubles, null);
  assert.equal(summarizeDraftUsdt([row('200000')], null).requiredUsdt, null);
});
test('blank or invalid sums do not produce a sufficiency claim', () => {
  for (const value of ['', '-1', 'NaN', 'Infinity']) {
    assert.equal(summarizeDraftUsdt([row(value)], 89).requiredUsdt, null);
  }
});
test('other methods do not consume USDT in this summary', () => {
  assert.equal(summarizeDraftUsdt([{paymentMethod:'CASH', plannedAmount:'100', foreignAmount:''}], 89).count, 0);
});
