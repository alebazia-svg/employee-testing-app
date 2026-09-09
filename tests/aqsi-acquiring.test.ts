import assert from 'node:assert/strict';
import test from 'node:test';
import { loadAqsiOperations } from '../lib/aqsi-acquiring';

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

test('loads successful aQsi card and SBP slips as portal bank operations', async () => {
  const calls: string[] = [];
  const result = await loadAqsiOperations({
    apiKey: 'secret', portalTerminalKey: 'aqsi-portal', aqsiTerminalId: '10693079',
    from: '2026-09-01T00:00:00+03:00', to: '2026-09-02T00:00:00+03:00',
    fetcher: async (url, init) => {
      calls.push(String(url));
      assert.equal(new Headers(init?.headers).get('x-client-key'), 'Application secret');
      return response({ count: 2, pages: 1, rows: [
        { id: 'card', content: { type: 'purchase', amount: 60000, dateTime: '2026-09-01T11:37:20+03:00', retrievalReferenceNumber: 'card-rrn', terminalId: '10693079', iface: 'contactless', responseCode: '000' } },
        { id: 'qr', content: { type: 'purchase', amount: 140000, dateTime: '2026-09-01T15:45:23+03:00', retrievalReferenceNumber: 'qr-rrn', terminalId: '10693079', iface: 'sbp', responseCode: 'SUCCESS' } },
      ] });
    },
  });
  assert.equal(result.complete, true);
  assert.equal(result.data.length, 2);
  assert.deepEqual(result.data.map((item) => item.rawType), ['TERM_CARD', 'TERM_SBP']);
  assert.match(calls[0], /filtered\.terminalId=10693079/);
});
test('fails closed for an unknown or unsuccessful slip', async () => {
  const result = await loadAqsiOperations({
    apiKey: 'secret', portalTerminalKey: 'aqsi-portal', aqsiTerminalId: '10693079',
    from: '2026-09-01T00:00:00+03:00', to: '2026-09-02T00:00:00+03:00',
    fetcher: async () => response({ count: 1, pages: 1, rows: [
      { id: 'declined', content: { type: 'purchase', amount: 10000, dateTime: '2026-09-01T12:00:00+03:00', terminalId: '10693079', iface: 'sbp', responseCode: 'DECLINED' } },
    ] }),
  });
  assert.equal(result.complete, false);
  assert.equal(result.errorCode, 'AQSI_NORMALIZATION_FAILED');
});
