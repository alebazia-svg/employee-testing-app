import assert from 'node:assert/strict';
import test from 'node:test';
import { shiftControlEmployeeRevisionHistoryKey, shiftControlOneCAuditKey, stripShiftControlOneCAudit } from '../lib/shift-control-one-c-audit';

test('removes the 1C audit snapshot from employee-visible handover data', () => {
  const value = {
    personalCash: { cashBalance: 2850 },
    [shiftControlOneCAuditKey]: {
      capturedAt: '2026-07-24T19:55:00.000Z',
      personalCash: { status: 'captured', balance: 2851 },
    },
    [shiftControlEmployeeRevisionHistoryKey]: [{ editedAt: '2026-08-08T11:01:00.000Z' }],
  };

  assert.deepEqual(stripShiftControlOneCAudit(value), {
    personalCash: { cashBalance: 2850 },
  });
  assert.equal(value[shiftControlOneCAuditKey].personalCash.balance, 2851);
});

test('leaves non-object task data unchanged', () => {
  assert.equal(stripShiftControlOneCAudit(null), null);
  assert.equal(stripShiftControlOneCAudit('legacy'), 'legacy');
});
