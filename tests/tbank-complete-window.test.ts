import assert from 'node:assert/strict';
import test from 'node:test';
import { collectCompleteTBankWindow, splitIntoFixedWindows, TBANK_MATCHING_PAGE_LIMIT } from '../lib/tbank-complete-window';

test('pre-splits long source periods into fixed provider windows', () => {
  assert.deepEqual(splitIntoFixedWindows(0, 25, 10), [
    { fromMs: 0, toMs: 10 }, { fromMs: 10, toMs: 20 }, { fromMs: 20, toMs: 25 },
  ]);
});

test('recursively splits every full 1000-row T-Bank window and deduplicates identities', async () => {
  const calls: Array<[number, number]> = [];
  const result = await collectCompleteTBankWindow({
    fromMs: 0,
    toMs: 8000,
    identity: (value: { id: string }) => value.id,
    loadPage: async (from, to, limit) => {
      calls.push([from, to]);
      assert.equal(limit, TBANK_MATCHING_PAGE_LIMIT);
      if (to - from > 4000) return { ok: true, operations: Array.from({ length: 1000 }, (_, id) => ({ id: `full-${id}` })) };
      return { ok: true, operations: [{ id: `row-${from}` }, { id: 'shared' }] };
    },
  });
  assert.equal(result.complete, true);
  assert.equal(result.windows, 3);
  assert.deepEqual(calls, [[0, 8000], [0, 4000], [4000, 8000]]);
  assert.equal(result.operations.length, 3);
});

test('fails closed when an irreducible T-Bank window is still full', async () => {
  const result = await collectCompleteTBankWindow({
    fromMs: 0,
    toMs: 1000,
    identity: (value: number) => String(value),
    loadPage: async () => ({ ok: true, operations: Array.from({ length: 1000 }, (_, index) => index) }),
  });
  assert.equal(result.complete, false);
  assert.equal(result.operations.length, 0);
});

test('fails closed on an upstream page error', async () => {
  const result = await collectCompleteTBankWindow({
    fromMs: 0,
    toMs: 2000,
    identity: String,
    loadPage: async () => ({ ok: false, operations: [] }),
  });
  assert.equal(result.complete, false);
});
