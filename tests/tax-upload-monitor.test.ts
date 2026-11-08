import test from 'node:test';
import assert from 'node:assert/strict';
import { followTaxProcessing } from '../lib/tax-upload-monitor';
import { createTaxUploadStore } from '../lib/tax-upload-state';

test('a polling deadline means unconfirmed completion, never a failed file', async () => {
  let time = 0;
  const store = createTaxUploadStore();
  const attempt = store.begin('income', 'income.xlsx');
  store.update(attempt, { progress: 'processing' });
  await followTaxProcessing(attempt, 'doc', '2026-11-08', {
    update: store.update, refresh: () => assert.fail('no final result to refresh'),
    pause: async ms => { time += ms; }, now: () => time,
    fetchStatus: async () => Response.json({ state: 'processing' }),
  });
  assert.equal(store.getSnapshot()[0].progress, 'waiting');
  assert.equal(store.isBusy('income'), false);
});

test('network and malformed responses are retried before applying a confirmed result to its own file', async () => {
  let time = 0, calls = 0, refreshes = 0;
  const store = createTaxUploadStore();
  const a = store.begin('income', 'income.xlsx');
  store.update(a, { progress: 'processing' });
  store.begin('ens', 'ens.zip');
  await followTaxProcessing(a, 'doc A', '2026-11-08', {
    update: store.update, refresh: () => { refreshes++; },
    pause: async ms => { time += ms; }, now: () => time,
    fetchStatus: async url => {
      assert.match(String(url), /id=doc%20A/);
      calls++;
      if (calls === 1) throw new Error('offline');
      if (calls === 2) return new Response('broken json');
      return Response.json({ state: 'done', changes: ['Changed', 123] });
    },
  });
  assert.equal(calls, 3);
  assert.equal(refreshes, 1);
  assert.equal(store.getSnapshot()[0].progress, 'done');
  assert.deepEqual(store.getSnapshot()[0].changes, ['Changed']);
  assert.equal(store.getSnapshot()[1].progress, 'sending');
});

test('a confirmed failure preserves the server explanation', async () => {
  const store = createTaxUploadStore();
  const a = store.begin('income', 'income.xlsx');
  await followTaxProcessing(a, 'a', '', { update: store.update, refresh() {}, pause: async () => {}, fetchStatus: async () => Response.json({ state: 'failed', message: 'Wrong file' }) });
  assert.equal(store.getSnapshot()[0].progress, 'failed');
  assert.equal(store.getSnapshot()[0].message, 'Wrong file');
});
