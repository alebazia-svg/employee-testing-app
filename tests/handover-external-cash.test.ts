import assert from 'node:assert/strict';
import test from 'node:test';
import { externalCashSinceCount, handoverCashBoundary, isSeparateCashOperation } from '../lib/handover-external-cash';

test('only separate operations of the same shift after the saved cash count require review', () => {
  const capturedAt = '2026-11-27T16:33:00Z';
  const boundary = handoverCashBoundary({
    draft: true, personalCash: { cashBalance: 77870 },
    oneCAudit: { capturedAt }, updatedAt: '2026-11-27T16:36:00Z',
  });
  const operation = { id: 159, separate: true, workDayEntryId: 269,
    direction: 'deposit_safe', status: 'posted_1c_pair', createdAt: '2026-11-27T16:34:00Z' };
  assert.deepEqual(externalCashSinceCount([
    { ...operation, id: 155, createdAt: '2026-11-27T16:16:00Z' },
    { ...operation, id: 156, workDayEntryId: 268 },
    { ...operation, id: 157, status: 'cancelled' },
    { ...operation, id: 158, separate: false },
    operation,
    { ...operation, id: 160, direction: 'phone_reserve', status: 'pending_1c' },
  ], 269, boundary).map(row => row.id), [159, 160]);
  assert.equal(externalCashSinceCount([operation], 269, null).length, 0);
  assert.equal(handoverCashBoundary({ draft: false, personalCash: { cashBalance: 77870 } }), null);
});

test('handover-owned keys never count as separate operations', () => {
  assert.equal(isSeparateCashOperation('h833'), false);
  assert.equal(isSeparateCashOperation('00000000-0000-4000-8000-000000000341'), false);
  assert.equal(isSeparateCashOperation('a3be180c-c9b3-4ba3-b9ca-e97cb14f02b0'), true);
});

test('an operation submitted earlier is detected if it posts after the recount', () => {
  const boundary = Date.parse('2026-11-27T16:33:00Z');
  const operation = {
    id: 160, separate: true, workDayEntryId: 269, direction: 'phone_reserve',
    status: 'posted_1c_pair', createdAt: '2026-11-27T16:32:59Z',
    oneCPostedAt: '2026-11-27T16:33:02Z',
  };
  assert.deepEqual(externalCashSinceCount([operation], 269, boundary), [operation]);
  assert.deepEqual(externalCashSinceCount([operation], 269, boundary + 3000), []);
});
