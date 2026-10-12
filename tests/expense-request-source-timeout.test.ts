import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { fetchExpenseRequestSnapshot } from '../lib/expense-request-source';

const period = { from: new Date('2026-09-12T00:00:00+03:00'), to: new Date('2026-10-13T00:00:00+03:00'), strictRequests: true };
function setup(t: TestContext, timeout: string, delay: number, pages = [1]) {
  const keys = ['1C_BASE_URL', '1C_API_USER', '1C_API_PASSWORD', '1C_REQUEST_TIMEOUT_MS'];
  const saved = keys.map(key => process.env[key]);
  const oldFetch = globalThis.fetch;
  Object.assign(process.env, { '1C_BASE_URL': 'http://one-c.test', '1C_API_USER': 'test', '1C_API_PASSWORD': 'test', '1C_REQUEST_TIMEOUT_MS': timeout });
  t.mock.timers.enable({ apis: ['setTimeout'] });
  t.after(() => {
    globalThis.fetch = oldFetch;
    keys.forEach((key, index) => { if (saved[index] === undefined) delete process.env[key]; else process.env[key] = saved[index]; });
  });
  const calls: AbortSignal[] = [];
  globalThis.fetch = (async (input, init) => {
    const offset = Number(new URL(String(input)).searchParams.get('offset'));
    const count = pages[offset / 100] ?? 0;
    const signal = init!.signal!;
    calls.push(signal);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, delay);
      signal.addEventListener('abort', () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
    });
    return Response.json({ ok: true, rows: Array.from({ length: count }, (_, index) => ({ ref: `request-${offset + index}` })), completeness: { complete: true, requests: true }, pagination: { limit: 100, offset, has_more: count === 100 } });
  }) as typeof fetch;
  return calls;
}

test('monthly snapshot survives slow pages beyond shared five-second timeout and reads every page', async t => {
  const calls = setup(t, '5000', 6000, [100, 26]);
  const result = fetchExpenseRequestSnapshot(period).then(value => ({ value }), error => ({ error }));
  t.mock.timers.tick(6000);
  await setImmediate();
  t.mock.timers.tick(6000);
  const outcome = await result;
  assert.ok('value' in outcome, 'a valid six-second page must not time out');
  assert.equal(outcome.value.complete, true);
  assert.equal(outcome.value.rows.length, 126);
  assert.equal(outcome.value.pageCount, 2);
  t.mock.timers.tick(30000);
  assert.equal(calls.some(signal => signal.aborted), false, 'completed page timers are cleared');
});

test('unresponsive source still aborts at the fifteen-second floor without retry or partial success', async t => {
  const calls = setup(t, '5000', 20000);
  const result = assert.rejects(fetchExpenseRequestSnapshot(period), /SOURCE_TIMEOUT/);
  t.mock.timers.tick(14999);
  assert.equal(calls[0].aborted, false);
  t.mock.timers.tick(1);
  await result;
  assert.equal(calls[0].aborted, true);
  assert.equal(calls.length, 1);
});

test('explicitly longer source timeout is preserved', async t => {
  const calls = setup(t, '30000', 20000);
  const result = fetchExpenseRequestSnapshot(period);
  t.mock.timers.tick(15000);
  assert.equal(calls[0].aborted, false);
  t.mock.timers.tick(5000);
  assert.equal((await result).rows.length, 1);
});
