import assert from 'node:assert/strict';
import test from 'node:test';
import { adminShiftRepairPlan } from '../lib/workday-admin-shift-repair';

test('matches retail checks by purpose despite different sort order; never mutates task facts', () => {
  const current = [
    { id: 1, title: 'Принять кассу', category: 'cash', plannedTimeMinutes: 540, numericValue: 25750, completedAt: new Date() },
    { id: 2, title: 'Середина', category: 'cash', plannedTimeMinutes: 870, handoverData: { cash: 100 } },
    { id: 3, title: 'Сдать смену', category: 'handover', plannedTimeMinutes: 1200 },
  ];
  const before = structuredClone(current);
  assert.deepEqual(adminShiftRepairPlan(current, [
    { title: 'Середина', category: 'cash', plannedTimeMinutes: 930 },
    { title: 'Принять кассу', category: 'cash', plannedTimeMinutes: 660 },
    { title: 'Сдать смену', category: 'handover', plannedTimeMinutes: 1200 },
  ]), [{ id: 2, from: 870, to: 930 }, { id: 1, from: 540, to: 660 }]);
  assert.deepEqual(current, before);
});

test('ambiguous or incompatible checks cannot drop facts or add requirements silently', () => {
  const task = { id: 1, title: 'Касса', category: 'cash', plannedTimeMinutes: 540 };
  for (const [current, target] of [
    [[task, { ...task, id: 2 }], [task]], [[task], [task, task]],
    [[task], [{ ...task, title: 'Другой контроль' }]], [[task], [{ ...task, plannedTimeMinutes: null }]],
  ] as const) assert.throws(() => adminShiftRepairPlan([...current], [...target]), /сопоставить|набор проверок/);
});
