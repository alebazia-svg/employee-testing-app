import test from 'node:test';
import assert from 'node:assert/strict';
import { cashDuplicateResult, CASH_DUPLICATE_CODE } from '../lib/cash-operation-duplicate';
import { cashOutboxFormData, cashOutboxResponseAcknowledges } from '../lib/employee-cash-outbox';

const item = { id: 'request-2', userId: 8, workDayEntryId: 133, workDayDate: '2026-10-30', direction: 'deposit_safe', amount: '310000', createdAt: '2026-10-30T08:27:00Z', comment: '', url: '/api/employee/cash-operations', photo: new Blob(['test'], { type: 'image/jpeg' }), lastError: '' };
const previous = { id: 75, idempotencyKey: 'request-1', userId: 8, workDayEntryId: 133, date: '2026-10-30', direction: 'deposit_safe', amount: 310000, createdAt: '2026-10-30T08:36:04Z', status: 'posted_1c_pair' };
const reply = { code: CASH_DUPLICATE_CODE, requestedIdempotencyKey: item.id, operation: previous };
test('an explicit matching duplicate is a review, never a generic success acknowledgement', () => {
  assert.deepEqual(cashDuplicateResult(reply, item), previous);
  assert.equal(cashOutboxResponseAcknowledges(reply, item), false);
});
test('another employee, shift, amount, direction or request cannot consume the saved outbox item', () => {
  for (const patch of [{ userId: 9 }, { workDayEntryId: 134 }, { amount: 1 }, { direction: 'phone_reserve' }, { id: 0 }, { createdAt: 'bad' }]) {
    assert.equal(cashDuplicateResult({ ...reply, operation: { ...previous, ...patch } }, item), null);
  }
  assert.equal(cashDuplicateResult({ ...reply, requestedIdempotencyKey: 'request-3' }, item), null);
  assert.equal(cashDuplicateResult({ ...reply, code: 'OTHER' }, item), null);
});
test('the second-transfer confirmation is carried with the original durable request/photo', () => {
  const form = cashOutboxFormData({ ...item, duplicateOf: previous, distinctFromOperationId: 75 });
  assert.equal(form.get('idempotencyKey'), item.id);
  assert.equal(form.get('workDayEntryId'), '133');
  assert.equal(form.get('distinctFromOperationId'), '75');
  assert.equal(form.get('duplicateOf'), null);
  assert.ok(form.get('photo') instanceof File);
  assert.equal(cashOutboxFormData(item).get('distinctFromOperationId'), null);
});
