import assert from 'node:assert/strict';
import test from 'node:test';
import { buildScheduleImportEntries, parseScheduleSourceDate } from '../lib/work-schedule-import';

const users = [
  { id: 3, name: 'Чеченова Милана', department: 'retail' },
  { id: 4, name: 'Абшаева Зухра', department: 'retail' },
  { id: 5, name: 'Костеренко Магомед', department: 'retail' },
];

test('parses Russian and ISO schedule dates without timezone drift', () => {
  assert.equal(parseScheduleSourceDate('19.08.2026'), '2026-08-19');
  assert.equal(parseScheduleSourceDate('2026-08-19'), '2026-08-19');
  assert.equal(parseScheduleSourceDate('31.02.2026'), null);
});

test('maps unique first names to portal employees', () => {
  const result = buildScheduleImportEntries([
    { date: '19.08.2026', dayOfWeek: 'среда', employee: 'Милана', plannedWork: true, scheduleNote: '' },
    { date: '19.08.2026', dayOfWeek: 'среда', employee: 'Зухра', plannedWork: false, scheduleNote: '' },
  ], users);
  assert.deepEqual(result.entries.map((entry) => ({ userId: entry.userId, status: entry.status })), [
    { userId: 3, status: 'working' },
    { userId: 4, status: 'off' },
  ]);
  assert.deepEqual(result.unmappedNames, []);
  assert.deepEqual(result.ambiguousNames, []);
});

test('fails closed for unmapped, ambiguous and conflicting rows', () => {
  const result = buildScheduleImportEntries([
    { date: '19.08.2026', dayOfWeek: 'среда', employee: 'Новый', plannedWork: true, scheduleNote: '' },
    { date: '19.08.2026', dayOfWeek: 'среда', employee: 'Милана', plannedWork: true, scheduleNote: '' },
    { date: '19.08.2026', dayOfWeek: 'среда', employee: 'Милана', plannedWork: false, scheduleNote: '' },
  ], [...users, { id: 9, name: 'Иванова Милана', department: 'wholesale' }]);
  assert.deepEqual(result.unmappedNames, ['Новый']);
  assert.deepEqual(result.ambiguousNames, ['Милана']);
  assert.equal(result.entries.length, 0);
});
