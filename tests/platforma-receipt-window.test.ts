import test from 'node:test';
import assert from 'node:assert/strict';
import { readPlatformaReceiptWindow } from '../lib/platforma-receipt-window';

const from = '2026-08-13T00:00:00+03:00', toExclusive = '2026-08-14T00:00:00+03:00';
test('a complete day is returned unchanged without extra provider calls', async () => {
  let calls = 0; const expected = { complete: true, receipts: ['a'], providerTimeout: false };
  const actual = await readPlatformaReceiptWindow({ from, toExclusive, read: async () => { calls++; return expected; } });
  assert.equal(actual, expected); assert.equal(calls, 1);
});
test('a confirmed timeout splits into contiguous Moscow half-days and retains every receipt in order', async () => {
  const calls: string[][] = []; let active = 0, maxActive = 0;
  const result = await readPlatformaReceiptWindow({ from, toExclusive, read: async (start, end) => {
    calls.push([start, end]); active++; maxActive = Math.max(active, maxActive);
    await Promise.resolve(); active--;
    const timeout = start === from && end === toExclusive;
    return { complete: !timeout, providerTimeout: timeout, receipts: timeout ? [] : [start] };
  } });
  assert.equal(result.complete, true); assert.equal(maxActive, 1);
  assert.deepEqual(calls, [[from, toExclusive], [from, '2026-08-13T12:00:00+03:00'], ['2026-08-13T12:00:00+03:00', toExclusive]]);
  assert.deepEqual(result.receipts, [from, '2026-08-13T12:00:00+03:00']);
});
test('a non-timeout incomplete or invalid response never gets promoted to complete', async () => {
  let calls = 0;
  const result = await readPlatformaReceiptWindow({ from, toExclusive, read: async () => { calls++; return { complete: false, providerTimeout: false, receipts: ['partial'] }; } });
  assert.equal(result.complete, false); assert.equal(calls, 1);
});
test('persistent timeout stops at three-hour windows and does not read the remaining unprovable half', async () => {
  const calls: string[][] = [];
  const result = await readPlatformaReceiptWindow({ from, toExclusive, read: async (start, end) => {
    calls.push([start, end]); return { complete: false, providerTimeout: true, receipts: [] };
  } });
  assert.equal(result.complete, false); assert.equal(calls.length, 4);
  assert.equal(Date.parse(calls[3][1]) - Date.parse(calls[3][0]), 3 * 60 * 60 * 1000);
});
test('a failed right half preserves partial evidence but blocks the whole interval', async () => {
  let calls = 0;
  const result = await readPlatformaReceiptWindow({ from, toExclusive, read: async () => {
    calls++;
    return calls === 1 ? { complete: false, providerTimeout: true, receipts: [] }
      : { complete: calls === 2, providerTimeout: false, receipts: [calls] };
  } });
  assert.equal(result.complete, false); assert.deepEqual(result.receipts, [2, 3]);
});
