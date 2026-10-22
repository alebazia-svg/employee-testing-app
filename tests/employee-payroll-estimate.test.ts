import assert from 'node:assert/strict';
import { test } from 'node:test';
import { roundEmployeeEarnings, type EmployeeEarning } from '../lib/employee-payroll-estimate';

test('retail rounding preserves approved component labels and the rounded total without changing accounting inputs', () => {
  const parts: EmployeeEarning[] = [
    { label: 'Выходы', amount: 7200 }, { label: 'Смартфоны и техника', amount: 2678.532 },
    { label: 'В кредит', amount: 30140.31839 }, { label: 'Аксессуары', amount: 8318.65 },
    { label: 'Поклейка и услуги', amount: 5140 },
  ];
  const before = JSON.stringify(parts);
  const result = roundEmployeeEarnings(parts)!;
  assert.equal(result.estimatedAccrued, 53500);
  assert.equal(result.earnings.reduce((sum, row) => sum + row.amount, 0), result.estimatedAccrued);
  assert.deepEqual(result.earnings.map(row => row.amount), [7200, 2700, 30200, 8300, 5100]);
  assert.equal(JSON.stringify(parts), before);
});
test('wholesale includes only day pay and wholesale sales; zeros hide, missing inputs do not become zero', () => {
  assert.deepEqual(roundEmployeeEarnings([{ label: 'Выходы', amount: 5500 }, { label: 'Оптовые продажи', amount: 51304.53405 }]),
    { estimatedAccrued: 56800, earnings: [{ label: 'Выходы', amount: 5500 }, { label: 'Оптовые продажи', amount: 51300 }] });
  assert.deepEqual(roundEmployeeEarnings([{ label: 'Выходы', amount: 0 }]), { estimatedAccrued: 0, earnings: [] });
  for (const parts of [undefined, [{ label: 'Выходы', amount: NaN }], [{ label: 'Выходы', amount: Infinity }],
    [{ label: 'Выходы', amount: 1 }, { label: 'Выходы', amount: 1 }], [{ label: 'secret', amount: 100 }]]) {
    assert.equal(roundEmployeeEarnings(parts as EmployeeEarning[] | undefined), null);
  }
});
test('rounding handles signed sales returns and preserves sums across many component combinations', () => {
  for (let n = -1000; n < 1000; n += 7) {
    const parts: EmployeeEarning[] = [{ label: 'Выходы', amount: 6000 }, { label: 'В кредит', amount: n / 7 },
      { label: 'Аксессуары', amount: 534.8 }];
    const result = roundEmployeeEarnings(parts)!;
    assert.equal(result.earnings.reduce((sum, row) => sum + row.amount, 0), result.estimatedAccrued);
    assert.equal(result.estimatedAccrued, Math.round(parts.reduce((sum, row) => sum + row.amount, 0) / 100) * 100);
  }
});
