import assert from 'node:assert/strict';
import test from 'node:test';
import { handleTerminalFiscalSummaryRequest } from '../lib/terminal-fiscal-summary-api';

const url = 'http://localhost/api/admin/terminal-fiscal/summary?mappingId=m1&from=2026-08-09T00:00:00.000Z&to=2026-08-10T00:00:00.000Z';

test('ADMIN summary delegates to the read-only audit loader exactly once', async () => {
  let calls = 0;
  const response = await handleTerminalFiscalSummaryRequest({
    request: new Request(url), admin: { role: 'ADMIN' },
    loadSummary: async (query) => {
      calls += 1;
      assert.equal(query.mappingId, 'm1');
      return { total: 4, statuses: { confirmed: 4 } };
    },
  });
  assert.equal(response.status, 200);
  assert.equal(calls, 1);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(await response.json(), { summary: { total: 4, statuses: { confirmed: 4 } } });
});

test('summary API never calls the loader for non-admin or invalid requests', async () => {
  let calls = 0;
  const loadSummary = async () => { calls += 1; return null; };
  assert.equal((await handleTerminalFiscalSummaryRequest({ request: new Request(url), admin: null, loadSummary })).status, 403);
  assert.equal((await handleTerminalFiscalSummaryRequest({ request: new Request('http://localhost/api/admin/terminal-fiscal/summary'), admin: { role: 'ADMIN' }, loadSummary })).status, 400);
  assert.equal(calls, 0);
});
