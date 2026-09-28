import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { row } from './procurement-delivery-native.test';
const require = createRequire(import.meta.url);

async function automatic(rows: any[], options: { complete?: boolean; used?: boolean; unlinked?: boolean } = {}) {
  const output = await build({ entryPoints: ['lib/procurement-delivery-native-source.ts'], bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external', plugins: [{ name: 'auto-source', setup(b) {
    b.onResolve({ filter: /^\.\/(prisma|expense-request-source)$/ }, a => ({ path: a.path, external: true }));
  } }] });
  const mod = { exports: {} as any };
  const mocks: Record<string, any> = {
    './prisma': { prisma: { adminInboxEvent: {
      findUnique: async () => options.unlinked ? { type: 'procurement.delivery_native_unlinked' } : null,
      findMany: async () => options.used ? [{ eventKey: 'delivery:native:another-cycle' }] : [],
    } } },
    './expense-request-source': { fetchExpenseRequestSnapshot: async () => ({ rows, complete: options.complete !== false, checkedAt: new Date().toISOString() }) },
  };
  new Function('require', 'module', 'exports', output.outputFiles[0].text)((name: string) => mocks[name] ?? require(name), mod, mod.exports);
  return mod.exports.loadDeliveryNative('current', { amount: 15000, requestedAt: new Date(Date.now() - 1200000).toISOString() });
}
const currentRow = (issued = 0) => ({ ...row(issued), date: new Date(Date.now() - 600000).toISOString() });
test('unique new personal native request appears automatically, without a portal write', async () => {
  for (const [issued, state] of [[0, 'payable'], [5000, 'partial'], [15000, 'issued']] as const) {
    const view = await automatic([currentRow(issued)]);
    assert.equal(view.state, 'linked'); assert.equal(view.automatic, true); assert.equal(view.status.state, state);
  }
});
test('multiple, invalid, historical, reused, manually unlinked or incomplete candidates never auto-select', async () => {
  const r = currentRow();
  const second = { ...r, ref: '11111111-2222-3333-4444-777777777777' };
  assert.equal((await automatic([r, second])).reviewReason, 'ambiguous');
  assert.equal((await automatic([r, { ...second, deletion_mark: true }])).reviewReason, 'ambiguous');
  for (const patch of [{ posted: false }, { deletion_mark: true }, { status: { key: 'rejected' } }, { amount: 14000 }, { date: new Date(Date.now() - 3600000).toISOString() }]) {
    assert.equal((await automatic([{ ...r, ...patch }])).state, 'unlinked');
  }
  assert.equal((await automatic([r], { used: true })).state, 'unlinked');
  assert.equal((await automatic([r], { unlinked: true })).reviewReason, 'manual');
  assert.equal((await automatic([r], { complete: false })).state, 'unavailable');
  assert.equal((await automatic([r, { ...second, accountable_identity_contract: undefined }])).state, 'unavailable');
  assert.equal((await automatic([r, { ...second, date: 'invalid' }])).state, 'unavailable');
  assert.equal((await automatic([{ ...r, date: new Date(Date.now() + 3600000).toISOString() }])).state, 'unlinked');
  assert.equal((await automatic([{ ...r, accountable_person: { ref: 'someone-else' } }])).state, 'unlinked');
});

async function reader(payload: unknown) {
  const result = await build({ entryPoints: ['lib/expense-request-source.ts'], bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external', plugins: [{ name: 'source-env', setup(b) {
    b.onResolve({ filter: /^@\/lib\/one-c-env$/ }, () => ({ path: 'env', namespace: 'mock' }));
    b.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: "export const readOneCRuntimeEnv=()=>({baseUrl:'https://example.invalid',user:'test',password:'test'});" }));
  } }] });
  const mod = { exports: {} as any }; new Function('require', 'module', 'exports', result.outputFiles[0].text)(require, mod, mod.exports);
  const saved = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify(payload), { status: 200 })) as typeof fetch;
  try { return await mod.exports.fetchExpenseRequestSnapshot({ from: new Date('2026-09-28T00:00:00+03:00'), to: new Date('2026-09-29T00:00:00+03:00'), strictRequests: true }); }
  finally { globalThis.fetch = saved; }
}
const page = () => ({ ok: true, rows: [], completeness: { requests: true, complete: true }, pagination: { limit: 100, offset: 0, has_more: false } });
test('strict personal reader requires explicit completeness and valid pagination', async () => {
  assert.equal((await reader(page())).complete, true);
  for (const patch of [{ ok: undefined }, { completeness: {} }, { rows: null }, { pagination: { limit: 100, offset: 0, has_more: true } }, { pagination: { limit: 100, offset: 100, has_more: false } }]) await assert.rejects(reader({ ...page(), ...patch }));
});
test('duplicate identity is incomplete, optional attachment failure does not hide valid request evidence', async () => {
  assert.equal((await reader({ ...page(), rows: [{ ref: 'test' }, { ref: 'test' }] })).complete, false);
  assert.equal((await reader({ ...page(), completeness: { requests: true, complete: false } })).complete, true);
});
test('stored exact link never turns a missing/reassigned/incomplete document into paid', async () => {
  for (const mode of ['missing', 'wrong-person', 'incomplete', 'failure']) {
    const result = await build({ entryPoints: ['lib/procurement-delivery-native-source.ts'], bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external', plugins: [{ name: 'state', setup(b) {
      b.onResolve({ filter: /^\.\/(prisma|expense-request-source)$/ }, args => ({ path: args.path, namespace: 'mock' }));
      b.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: args.path === './prisma'
        ? `export const prisma={adminInboxEvent:{findUnique:async()=>({type:'procurement.delivery_native_linked',body:JSON.stringify({version:1,ref:'11111111-2222-3333-4444-555555555555',date:'2026-09-28',amount:15000,userId:1,linkedAt:new Date().toISOString()})})}};`
        : `export async function fetchExpenseRequestSnapshot(){${mode === 'failure' ? "throw Error('private');" : `return {complete:${mode !== 'incomplete'},rows:${mode === 'wrong-person' ? "[{ref:'11111111-2222-3333-4444-555555555555'}]" : '[]'},checkedAt:new Date().toISOString()};`}}` }));
    } }] });
    const mod = { exports: {} as any }; new Function('require', 'module', 'exports', result.outputFiles[0].text)(require, mod, mod.exports);
    assert.deepEqual(await mod.exports.loadDeliveryNative('test', { amount: 15000 }), { state: 'unavailable' });
  }
});
