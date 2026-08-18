import assert from 'node:assert/strict';
import test from 'node:test';
import { shiftControlEmployeeRevisionHistoryKey, shiftControlOneCAuditKey, stripShiftControlOneCAudit } from '../lib/shift-control-one-c-audit';

test('removes the 1C audit snapshot from employee-visible handover data', () => {
  const value = {
    [shiftControlOneCAuditKey]: {
      capturedAt: '2026-07-24T19:55:00.000Z',
      personalCash: { status: 'captured', balance: 2851 },
    },
    [shiftControlEmployeeRevisionHistoryKey]: [{ editedAt: '2026-08-08T11:01:00.000Z' }],
    cashComparison: { expected: 2851, actual: 2850, difference: -1, status: 'mismatch' },
    cashRecountInputHistory: [{ value: 2850, enteredAt: '2026-08-08T11:01:00.000Z', kind: 'initial' }],
    cashRecountStage: 'completed_with_discrepancy',
    cashRecountAttempt: 2,
    personalCash: { cashBalance: 2850, discrepancyType: 'shortage', discrepancyAmount: 1, requiresComment: false },
  };

  assert.deepEqual(stripShiftControlOneCAudit(value), {
    personalCash: { cashBalance: 2850 },
  });
  assert.equal(value[shiftControlOneCAuditKey].personalCash.balance, 2851);
});

test('keeps only the neutral comment-required signal while a handover draft is open', () => {
  assert.deepEqual(stripShiftControlOneCAudit({
    draft: true,
    personalCash: { cashBalance: 1000, discrepancyType: 'shortage', discrepancyAmount: 301, requiresComment: true },
  }), {
    draft: true,
    personalCash: { cashBalance: 1000, requiresComment: true },
  });
});

test('leaves non-object task data unchanged', () => {
  assert.equal(stripShiftControlOneCAudit(null), null);
  assert.equal(stripShiftControlOneCAudit('legacy'), 'legacy');
});
