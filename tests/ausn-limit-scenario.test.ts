import assert from 'node:assert/strict';
import test from 'node:test';
import { limitScenario } from '../lib/ausn-limit-scenario';

test('limit scenario follows the forecast pace convention and marks the crossing month', () => {
  const result = limitScenario({ remaining: 12_000_000, cutoff: '2026-10-26', year: '2026', monthly: 8_000_000 });
  assert.equal(result.days, 45);
  assert.equal(result.date, '2026-12-10');
  assert.equal(result.withinYear, true);
  assert.deepEqual(result.months.map((month) => [month.periodKey, month.days, month.partial]), [['2026-10', 5, true], ['2026-11', 30, false], ['2026-12', 31, false]]);
  assert.deepEqual(result.months.map((month) => month.crosses), [false, false, true]);
  assert.equal(Math.round(result.safeMonthly!), Math.round(12_000_000 / 66 * 30));
});

test('limit scenario without pace or after year end does not invent a date', () => {
  assert.equal(limitScenario({ remaining: 1_000_000, cutoff: '2026-10-26', year: '2026', monthly: 0 }).date, undefined);
  assert.equal(limitScenario({ remaining: 1_000_000, cutoff: '2026-10-26', year: '2026', monthly: 100_000 }).withinYear, false);
  assert.deepEqual(limitScenario({ remaining: 0, cutoff: '2026-10-26', year: '2026', monthly: 100_000 }).months, []);
});
