import assert from 'node:assert/strict';
import test from 'node:test';
import { formatAdminWorkdayRevision } from '../lib/admin-workday-revision';

const parts = [
  {
    count: 2,
    latestId: 12,
    latestAt: '2026-07-26T06:07:00.000Z',
  },
];

test('changes revision when workday data changes', () => {
  const before = formatAdminWorkdayRevision({
    date: '2026-07-26',
    today: '2026-07-26',
    nowMinutes: 600,
    parts,
  });
  const after = formatAdminWorkdayRevision({
    date: '2026-07-26',
    today: '2026-07-26',
    nowMinutes: 600,
    parts: [{ ...parts[0], count: 3, latestId: 13, latestAt: '2026-07-26T06:12:00.000Z' }],
  });

  assert.notEqual(before, after);
});

test('changes current-day revision when the minute changes', () => {
  const before = formatAdminWorkdayRevision({
    date: '2026-07-26',
    today: '2026-07-26',
    nowMinutes: 600,
    parts,
  });
  const after = formatAdminWorkdayRevision({
    date: '2026-07-26',
    today: '2026-07-26',
    nowMinutes: 601,
    parts,
  });

  assert.notEqual(before, after);
});

test('keeps historical revision stable when only current time changes', () => {
  const before = formatAdminWorkdayRevision({
    date: '2026-07-24',
    today: '2026-07-26',
    nowMinutes: 600,
    parts,
  });
  const after = formatAdminWorkdayRevision({
    date: '2026-07-24',
    today: '2026-07-26',
    nowMinutes: 601,
    parts,
  });

  assert.equal(before, after);
});
