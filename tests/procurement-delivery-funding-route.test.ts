import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { DELIVERY_PERSON } from '../lib/procurement-delivery-policy';
async function route(status = 200, fail = false, mappingFail = false) {
  const calls: string[] = [];
  const mocks: Record<string, unknown> = {
    '@/lib/admin-api-auth': { requireAdminApi: async () => ({ ok: status === 200, response: new Response(null, { status }) }) },
    '@/lib/one-c': { getCashFundingContext: async (ref: string) => { calls.push(ref); if (fail) throw Error('private details'); return {}; } },
    '@/lib/procurement-delivery-policy': { DELIVERY_PERSON },
    '@/lib/procurement-delivery-funding': {
      deliveryFundingFromEvidence: () => { calls.push('validate'); return { cashboxes: [] }; },
      deliveryFundingForManagerCashboxes: (data: unknown, refs: string[]) => { calls.push('manager-scope'); assert.deepEqual(refs, ['manager-cashbox-ref']); return data; },
    },
    '@/lib/prisma': { prisma: { userOneCCashboxMapping: { findMany: async (query: unknown) => {
      calls.push('mappings');
      assert.deepEqual(query, { where: { isActive: true, user: { isActive: true, role: 'EMPLOYEE', portalArea: 'WORKDAY', department: { in: ['retail', 'wholesale'] } } }, select: { oneCCashboxRef: true } });
      if (mappingFail) throw Error('private mapping error');
      return [{ oneCCashboxRef: 'manager-cashbox-ref' }];
    } } } },
  };
  const b = await build({ entryPoints: ['app/api/admin/procurement/delivery-funding/route.ts'], bundle: true, write: false, platform: 'node', format: 'cjs',
    plugins: [{ name: 'mocks', setup(b) { b.onResolve({ filter: /^@\/lib\// }, a => ({ path: a.path, external: true })); } }] });
  const mod = { exports: {} as { GET: () => Promise<Response> } };
  new Function('require', 'module', 'exports', b.outputFiles[0].text)((name: string) => mocks[name], mod, mod.exports);
  return { ...mod.exports, calls };
}
test('anonymous and employees cannot read funding; no write handler', async () => {
  for (const status of [401, 403]) { const r = await route(status); assert.equal((await r.GET()).status, status); assert.deepEqual(r.calls, []); assert.equal('POST' in r, false); }
});
test('scope is fixed on server, validated before response, never cached', async () => {
  const r = await route(); const response = await r.GET(); assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store'); assert.deepEqual(r.calls, [DELIVERY_PERSON.organizationRef, 'mappings', 'validate', 'manager-scope']);
});
test('mapping read failure never falls back to all cashboxes', async () => {
  const r = await route(200, false, true); const response = await r.GET();
  assert.equal(response.status, 503); assert.equal(r.calls.includes('manager-scope'), false);
  assert.doesNotMatch(await response.text(), /private mapping|cashboxes/);
});
test('failure does not leak financial rows/secrets or fake zero balances', async () => {
  const r = await route(200, true); const response = await r.GET(); assert.equal(response.status, 503);
  const body = await response.text(); assert.doesNotMatch(body, /private details|cashboxes|balance/);
});
