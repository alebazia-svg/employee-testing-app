import test from 'node:test';
import assert from 'node:assert/strict';
import { readEmployeeCashReceipt } from '../lib/employee-cash-receipt';

const item = { id: '12345678-1234-4234-9234-123456789abc', userId: 8, workDayEntryId: 133, workDayDate: '2026-10-30', direction: 'deposit_safe', amount: '310000', createdAt: '2026-10-30T08:27:00Z', comment: '', url: '/api/employee/cash-operations', photo: new Blob(['test']), lastError: '' };
const operation = { id: 75, idempotencyKey: item.id, userId: item.userId, workDayEntryId: item.workDayEntryId, date: item.workDayDate, direction: item.direction, amount: 310000, status: 'pending_1c' };
test('a durable receipt is read without an image or a financial POST, even while 1C is pending', async () => {
  const receipt = await readEmployeeCashReceipt(item, async (url, options) => {
    assert.equal(url, `/api/employee/cash-operations?idempotencyKey=${item.id}`);
    assert.equal(options?.method, undefined);
    assert.equal(options?.body, undefined);
    assert.equal(options?.cache, 'no-store');
    return Response.json({ operation });
  });
  assert.deepEqual(receipt, { operation });
});
test('only an explicit not-found permits another photo upload', async () => {
  assert.equal(await readEmployeeCashReceipt(item, async () => new Response(null, { status: 404 })), null);
  for (const status of [401, 403, 500, 502, 503]) await assert.rejects(readEmployeeCashReceipt(item, async () => new Response(null, { status })));
  await assert.rejects(readEmployeeCashReceipt(item, async () => { throw new Error('Network failed'); }));
});
test('another operation or an HTML login response cannot acknowledge the queued item', async () => {
  for (const patch of [{ userId: 9 }, { workDayEntryId: 134 }, { idempotencyKey: 'another' }, { amount: 1 }]) await assert.rejects(readEmployeeCashReceipt(item, async () => Response.json({ operation: { ...operation, ...patch } })));
  await assert.rejects(readEmployeeCashReceipt(item, async () => new Response('<html>Login</html>')));
});
