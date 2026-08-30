import assert from 'node:assert/strict';
import test from 'node:test';
import { buildBulkScheduleChanges, bulkScheduleCounts } from '../lib/work-schedule-bulk';

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
