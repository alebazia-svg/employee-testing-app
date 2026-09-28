import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

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
