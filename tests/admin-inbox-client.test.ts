import test from 'node:test';
import assert from 'node:assert/strict';
import { createSharedJsonReader } from '../lib/admin-inbox-client';

test('responsive bells share concurrent reads but a later refresh reads fresh data', async () => {
  let count = 0, release!: (value: Response) => void;
  const read = createSharedJsonReader(async () => { count++; return new Promise(resolve => { release = resolve; }); });
  const a = read('/attention'), b = read('/attention');
  assert.equal(a, b); assert.equal(count, 1);
  release(Response.json({ attentionCount: 3 }));
  assert.equal((await a).payload.attentionCount, 3);
  const c = read('/attention');
  assert.notEqual(c, a); assert.equal(count, 2);
  release(Response.json({ attentionCount: 0 }));
  assert.equal((await c).payload.attentionCount, 0);
});

test('history and attention are never conflated and failure does not poison retries', async () => {
  let count = 0;
  const read = createSharedJsonReader(async url => { count++; if (count === 1) throw new Error('offline'); return Response.json({ url }); });
  await assert.rejects(read('/attention'));
  const [a, b] = await Promise.all([read('/attention'), read('/history')]);
  assert.equal(a.payload.url, '/attention'); assert.equal(b.payload.url, '/history');
  assert.equal(count, 3);
});

test('a stalled read is aborted and does not block a later retry', async () => {
  let count = 0;
  const read = createSharedJsonReader(async (_url, options) => {
    count++;
    if (count > 1) return Response.json({ attentionCount: 1 });
    return new Promise((_resolve, reject) => options?.signal?.addEventListener('abort', () => reject(new Error('timed out')), { once: true }));
  }, 5);
  await assert.rejects(read('/attention'), /timed out/);
  assert.equal((await read('/attention')).payload.attentionCount, 1);
});
