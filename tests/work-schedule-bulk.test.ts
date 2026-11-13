import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSchedulePlanChanges, toggleSchedulePlanDate, buildBulkScheduleChanges, buildBulkScheduleEditChanges, bulkScheduleCounts } from '../lib/work-schedule-bulk';

test('bulk schedule marks selected missing dates as working and all other missing dates as off', () => {
  const changes = buildBulkScheduleChanges(
    ['2026-09-03', '2026-09-01', '2026-09-02'],
    new Set(['2026-09-01', '2026-09-03']),
  );

  assert.deepEqual(changes, [
    { date: '2026-09-01', status: 'working' },
    { date: '2026-09-02', status: 'off' },
    { date: '2026-09-03', status: 'working' },
  ]);
});

test('bulk schedule only changes dates explicitly passed as missing', () => {
  const changes = buildBulkScheduleChanges(['2026-09-02'], new Set(['2026-09-01', '2026-09-02']));
  assert.deepEqual(changes, [{ date: '2026-09-02', status: 'working' }]);
});

test('bulk schedule summary remains consistent for all-working and all-off selections', () => {
  assert.deepEqual(bulkScheduleCounts(buildBulkScheduleChanges(['2026-09-01', '2026-09-02'], new Set())), {
    workingDays: 0,
    offDays: 2,
    totalDays: 2,
  });
  assert.deepEqual(bulkScheduleCounts(buildBulkScheduleChanges(['2026-09-01', '2026-09-02'], new Set(['2026-09-01', '2026-09-02']))), {
    workingDays: 2,
    offDays: 0,
    totalDays: 2,
  });
});

test('bulk edit sends only dates whose existing status actually changed', () => {
  const changes = buildBulkScheduleEditChanges(
    ['2026-09-03', '2026-09-01', '2026-09-02'],
    new Set(['2026-09-02', '2026-09-03']),
    new Map([
      ['2026-09-01', 'working'],
      ['2026-09-02', 'off'],
      ['2026-09-03', 'working'],
    ]),
  );

  assert.deepEqual(changes, [
    { date: '2026-09-01', status: 'off', previousStatus: 'working' },
    { date: '2026-09-02', status: 'working', previousStatus: 'off' },
  ]);
});

test('bulk edit ignores dates without a saved original status', () => {
  const changes = buildBulkScheduleEditChanges(
    ['2026-09-01', '2026-09-02'],
    new Set(['2026-09-01', '2026-09-02']),
    new Map([['2026-09-01', 'working']]),
  );
  assert.deepEqual(changes, []);
});


test('explicit plan fills only selected dates and preserves untouched empty and saved days', () => {
  const original = Object.freeze({ '2026-10-23': 'working', '2026-10-24': null, '2026-10-25': 'off', '2026-10-26': null } as const);
  assert.deepEqual(buildSchedulePlanChanges(original, { '2026-10-24': 'off', '2026-10-25': 'working' }), [
    { date: '2026-10-24', status: 'off', previousStatus: null },
    { date: '2026-10-25', status: 'working', previousStatus: 'off' },
  ]);
  assert.equal(original['2026-10-24'], null);
});

test('plan ignores dates outside the eligible snapshot and preserves concurrency preconditions', () => {
  assert.deepEqual(buildSchedulePlanChanges({ '2026-10-23': 'working' }, { '2026-10-22': 'working', '2026-10-23': 'off' }), [
    { date: '2026-10-23', status: 'off', previousStatus: 'working' },
  ]);
  assert.deepEqual(buildSchedulePlanChanges({ '2026-10-23': 'working' }, { '2026-10-23': 'working' }), []);
});

test('selecting four workdays never turns the remainder of a month into days off', () => {
  const original: Record<string, 'working' | 'off' | null> = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`2026-11-${String(i + 1).padStart(2, '0')}`, null]));
  original['2026-11-11'] = 'working';
  original['2026-11-29'] = 'off';
  let draft = {};
  for (const date of ['2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17']) draft = toggleSchedulePlanDate(original, draft, date, 'working');
  for (const date of ['2026-11-12', '2026-11-13']) draft = toggleSchedulePlanDate(original, draft, date, 'off');
  const changes = buildSchedulePlanChanges(original, draft);
  assert.deepEqual(changes.map(({ date, status }) => [date, status]), [
    ['2026-11-12', 'off'], ['2026-11-13', 'off'], ['2026-11-14', 'working'], ['2026-11-15', 'working'], ['2026-11-16', 'working'], ['2026-11-17', 'working'],
  ]);
  const after = { ...original, ...Object.fromEntries(changes.map(({ date, status }) => [date, status])) };
  assert.equal(after['2026-11-18'], null);
  assert.equal(after['2026-11-30'], null);
  assert.equal(after['2026-11-11'], 'working');
  assert.equal(after['2026-11-29'], 'off');
});

test('repeated tap and switching back to saved status undo a draft without erasing saved days', () => {
  const original = Object.freeze({ '2026-11-12': null, '2026-11-13': 'working', '2026-11-14': 'off' } as const);
  const first = Object.freeze(toggleSchedulePlanDate(original, {}, '2026-11-12', 'working'));
  assert.deepEqual(toggleSchedulePlanDate(original, first, '2026-11-12', 'working'), {});
  let draft = toggleSchedulePlanDate(original, first, '2026-11-12', 'off');
  assert.equal(draft['2026-11-12'], 'off');
  draft = toggleSchedulePlanDate(original, draft, '2026-11-13', 'off');
  draft = toggleSchedulePlanDate(original, draft, '2026-11-13', 'working');
  assert.deepEqual(buildSchedulePlanChanges(original, draft), [{ date: '2026-11-12', status: 'off', previousStatus: null }]);
  assert.deepEqual(toggleSchedulePlanDate(original, {}, '2026-11-14', 'off'), {});
  assert.deepEqual(toggleSchedulePlanDate(original, {}, '2026-11-15', 'working'), {});
  assert.deepEqual(buildSchedulePlanChanges(original, {}), []);
  assert.equal(first['2026-11-12'], 'working');
});
