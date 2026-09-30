import test from 'node:test';
import assert from 'node:assert/strict';
import { expenseRequestMoscowCalendarDate, expenseRequestMoscowDayEnd, fetchExpenseRequestSnapshot } from '../lib/expense-request-source';

test('today-inclusive bound follows Moscow midnight, including month/year/leap boundaries', () => {
  for (const [now, tomorrow] of [
    ['2026-09-30T16:00:00Z', '2026-10-01'], ['2026-09-30T20:59:59Z', '2026-10-01'],
    ['2026-09-30T21:00:00Z', '2026-10-02'], ['2026-12-31T20:59:59Z', '2027-01-01'],
    ['2028-02-28T21:00:00Z', '2028-03-01'],
  ]) {
    const end = expenseRequestMoscowDayEnd(new Date(now));
    assert.equal(expenseRequestMoscowCalendarDate(end), tomorrow);
    assert.equal(end.toISOString(), new Date(`${tomorrow}T00:00:00+03:00`).toISOString());
    assert.ok(end > new Date(now));
  }
});

test('procurement request history uses contiguous exclusive-end Moscow windows and retains old requests', async t => {
  const old = { ...process.env }; t.after(() => { process.env = old; });
  process.env['1C_BASE_URL'] = 'https://one-c.invalid'; process.env['1C_API_USER'] = 'test'; process.env['1C_API_PASSWORD'] = 'test';
  const calls: string[][] = [];
  let incomplete = false, duplicate = false;
  t.mock.method(globalThis, 'fetch', async (input: string) => {
    const query = new URL(input).searchParams, from = query.get('from')!, to = query.get('to')!;
    calls.push([from, to]);
    assert.ok(Date.parse(to) - Date.parse(from) <= 31 * 86400000);
    return Response.json({ ok: true, rows: [{ ref: duplicate ? 'same' : from }], completeness: { complete: !incomplete } });
  });
  const input = { from: new Date('2026-08-01T20:00:00Z'), to: new Date('2026-10-02T00:00:00Z'), includeHistory: true };
  const result = await fetchExpenseRequestSnapshot(input);
  assert.equal(result.complete, true); assert.equal(result.rows.length, 2);
  assert.deepEqual(calls, [['2026-08-01', '2026-09-01'], ['2026-09-01', '2026-10-02']]);
  incomplete = true; assert.equal((await fetchExpenseRequestSnapshot(input)).complete, false);
  incomplete = false; duplicate = true;
  const repeated = await fetchExpenseRequestSnapshot(input);
  assert.equal(repeated.complete, false); assert.ok(repeated.errors.includes('ROW_REF_DUPLICATED'));
  await assert.rejects(fetchExpenseRequestSnapshot({ ...input, includeHistory: false }), /PERIOD_INVALID/);
  duplicate = false; calls.length = 0;
  await fetchExpenseRequestSnapshot({ from: new Date('2026-09-29T21:00:00Z'), to: new Date('2026-09-30T21:00:00Z'), includeHistory: true });
  assert.deepEqual(calls, [['2026-09-30', '2026-10-01']]);
});
