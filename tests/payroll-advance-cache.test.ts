import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPayrollAdvanceCache } from '../lib/payroll-advance-cache';
import type { PayrollAdvanceRead } from '../lib/payroll-one-c-advances';

test('employees share one complete read; next open after five minutes sees changed/cancelled advances', async () => {
  let time = Date.parse('2026-10-22T08:00:00Z'), calls = 0, amount = 2000;
  const read = createPayrollAdvanceCache(async (periodKey, dateFrom, dateTo) => {
    calls++;
    return { version: 1, periodKey, dateFrom, dateTo, checkedAt: new Date(time).toISOString(), issues: [],
      documents: amount ? [{ key: 'doc:1', employeeRef: 'person', employeeName: 'Абшаева Зухра', documentNumber: '1', documentDate: dateTo, amount, periodKey }] : [] };
  }, () => time);
  const values = await Promise.all(Array.from({ length: 10 }, () => read('2026-10')));
  assert.equal(calls, 1); assert.ok(values.every(value => value === values[0]));
  amount = 3000; time += 299999;
  assert.equal((await read('2026-10'))?.documents[0].amount, 2000); assert.equal(calls, 1);
  time++; assert.equal((await read('2026-10'))?.documents[0].amount, 3000); assert.equal(calls, 2);
  amount = 0; time += 300000;
  assert.deepEqual((await read('2026-10'))?.documents, []); assert.equal(calls, 3);
});
test('outage never serves expired data or a fabricated zero and retries remain throttled', async () => {
  let time = Date.parse('2026-10-22T08:00:00Z'), calls = 0, broken = false;
  const read = createPayrollAdvanceCache(async (periodKey, dateFrom, dateTo): Promise<PayrollAdvanceRead> => {
    calls++; if (broken) throw Error('private diagnostic');
    return { version: 1, periodKey, dateFrom, dateTo, checkedAt: new Date(time).toISOString(), issues: [], documents: [] };
  }, () => time);
  assert.ok(await read('2026-10')); broken = true; time += 300000;
  assert.equal(await read('2026-10'), null);
  for (let i = 0; i < 10; i++) assert.equal(await read('2026-10'), null);
  assert.equal(calls, 2);
  broken = false; time += 300000;
  assert.ok(await read('2026-10')); assert.equal(calls, 3);
});
test('Moscow midnight changes the window; other months and invalid periods do not trigger reads', async () => {
  let time = Date.parse('2026-10-22T20:59:59Z');
  const windows: string[] = [];
  const read = createPayrollAdvanceCache(async (periodKey, dateFrom, dateTo) => {
    windows.push(dateTo); return { version: 1, periodKey, dateFrom, dateTo, checkedAt: new Date(time).toISOString(), issues: [], documents: [] };
  }, () => time);
  assert.equal(await read('2026-09'), null); assert.equal(await read('bad'), null);
  await read('2026-10'); time += 1000; await read('2026-10');
  assert.deepEqual(windows, ['2026-10-22', '2026-10-23']);
});
