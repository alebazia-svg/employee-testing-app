import assert from 'node:assert/strict';
import test from 'node:test';
import { loadPlatformaOfdReceipts } from '../lib/terminal-fiscal-sources';

const input = {
  kktRegistrationNumber: '0000000000000000',
  from: '2026-08-27T00:00:00+03:00',
  to: '2026-08-28T00:00:00+03:00',
};

test('retries an incomplete Platforma OFD snapshot and accepts the complete retry', async () => {
  process.env.PLATFORMA_OFD_PROXY_BASE_URL = 'https://ofd.invalid';
  let attempts = 0;
  const waits: number[] = [];
  const result = await loadPlatformaOfdReceipts(input, {
    fetchJson: async () => {
      attempts += 1;
      return {
        response: new Response(null, { status: 200 }),
        body: attempts === 1
          ? { receipts: [], meta: { complete: false } }
          : { receipts: [], meta: { complete: true } },
      };
    },
    sleep: async (milliseconds) => { waits.push(milliseconds); },
  });
  assert.equal(result.complete, true);
  assert.equal(attempts, 2);
  assert.deepEqual(waits, [1_000]);
});

test('fails closed after three incomplete Platforma OFD snapshots', async () => {
  process.env.PLATFORMA_OFD_PROXY_BASE_URL = 'https://ofd.invalid';
  let attempts = 0;
  const result = await loadPlatformaOfdReceipts(input, {
    fetchJson: async () => {
      attempts += 1;
      return { response: new Response(null, { status: 200 }), body: { receipts: [], complete: false } };
    },
    sleep: async () => undefined,
  });
  assert.equal(result.complete, false);
  assert.equal(result.errorCode, 'OFD_INCOMPLETE');
  assert.equal(attempts, 3);
});
