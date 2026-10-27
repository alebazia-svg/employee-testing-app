import assert from 'node:assert/strict';
import test from 'node:test';
import { createPersonalPayrollSourceCache } from '../lib/payroll-personal-source-cache';

function fixture() {
  let time = Date.parse('2026-10-27T10:00:00Z');
  let calls = 0, fail = false;
  const load = async (period: string, today: string) => {
    calls++;
    if (fail) throw Error('outage');
    const dates = { dateFrom: `${period}-01`, dateTo: today, checkedAt: new Date(time).toISOString() };
    return { cash: { ...dates, documents: [] }, ledger: { ...dates, employees: [], movementCount: 0 } };
  };
  return { read: createPersonalPayrollSourceCache(load, () => time), calls: () => calls,
    fail: () => { fail = true; }, recover: () => { fail = false; }, advance: (ms: number) => { time += ms; } };
}
test('stored first paint does no I/O; parallel opens share one complete source read', async () => {
  const f = fixture();
  assert.equal(await f.read('2026-09', '2026-10-27', true), null);
  assert.equal(f.calls(), 0);
  const [a, b] = await Promise.all([f.read('2026-09', '2026-10-27'), f.read('2026-09', '2026-10-27')]);
  assert.equal(f.calls(), 1);
  assert.deepEqual(a, b);
  assert.equal(a?.sourceFallback, false);
  assert.deepEqual(await f.read('2026-09', '2026-10-27', true), a);
});
test('an outage preserves checked evidence and its exact date, throttles retries and recovers', async () => {
  const f = fixture();
  const first = await f.read('2026-09', '2026-10-27');
  f.advance(300_001); f.fail();
  const old = await f.read('2026-09', '2026-10-27');
  assert.equal(old?.sourceFallback, true);
  assert.equal(old?.checkedAt, first?.checkedAt);
  assert.deepEqual(old?.source, first?.source);
  await f.read('2026-09', '2026-10-27');
  assert.equal(f.calls(), 2);
  f.recover(); f.advance(30_001);
  assert.equal((await f.read('2026-09', '2026-10-27'))?.sourceFallback, false);
  assert.equal(f.calls(), 3);
});
test('cold outage stays unknown, never becomes a zero payment source', async () => {
  const f = fixture(); f.fail();
  await assert.rejects(f.read('2026-09', '2026-10-27'));
  await assert.rejects(f.read('2026-09', '2026-10-27'));
  assert.equal(f.calls(), 1);
  assert.equal(await f.read('2026-09', '2026-10-27', true), null);
});
test('only two rolling months are retained; a new day requires a refresh', async () => {
  const f = fixture();
  await f.read('2026-09', '2026-10-27');
  await f.read('2026-10', '2026-10-27');
  f.advance(5 * 86_400_000);
  assert.equal(await f.read('2026-09', '2026-11-01', true), null);
  const old = await f.read('2026-10', '2026-11-01', true);
  assert.equal(old?.sourceFallback, true);
  const fresh = await f.read('2026-10', '2026-11-01');
  assert.equal(fresh?.source.cash.dateTo, '2026-11-01');
  assert.equal(await f.read('2026-10', '2026-10-27'), null, 'caller cannot claim an obsolete today');
});
test('inconsistent evidence dates never overwrite the last checked source', async () => {
  const now = Date.parse('2026-10-27T10:00:00Z');
  const read = createPersonalPayrollSourceCache(async () => ({
    cash: { dateFrom: '2026-09-01', dateTo: '2026-10-26', checkedAt: new Date(now).toISOString(), documents: [] },
    ledger: { dateFrom: '2026-09-01', dateTo: '2026-10-27', checkedAt: new Date(now).toISOString(), employees: [], movementCount: 0 },
  }), () => now);
  await assert.rejects(read('2026-09', '2026-10-27'));
  assert.equal(await read('2026-09', '2026-10-27', true), null);
});
test('midnight requests do not share different windows or regress a newer saved day', async () => {
  let time = Date.parse('2026-10-27T20:59:59Z');
  const waiting = new Map<string, () => void>();
  const read = createPersonalPayrollSourceCache(async (period, today) => {
    await new Promise<void>(resolve => waiting.set(today, resolve));
    const dates = { dateFrom: `${period}-01`, dateTo: today, checkedAt: new Date(time).toISOString() };
    return { cash: { ...dates, documents: [] }, ledger: { ...dates, employees: [], movementCount: 0 } };
  }, () => time);
  const yesterday = read('2026-09', '2026-10-27');
  await Promise.resolve();
  time += 2000;
  const today = read('2026-09', '2026-10-28');
  await Promise.resolve();
  waiting.get('2026-10-28')!();
  assert.equal((await today)?.sourceFallback, false);
  waiting.get('2026-10-27')!();
  assert.equal((await yesterday)?.sourceFallback, true);
  assert.equal((await read('2026-09', '2026-10-28', true))?.source.cash.dateTo, '2026-10-28');
});
