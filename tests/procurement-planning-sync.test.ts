import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';

test('background refresh reuses unchanged rows, checks changed debt, preserves paid history and fails on incomplete discovery', async t => {
  const now = new Date('2026-09-24T09:00:00Z');
  const s: any = { raw: { complete: true, rows: [{ ref: 'one', manager: 'Астемир', orderPaymentGap: 1000 }] }, calls: 0, checks: 0 };
  (globalThis as any).planningSyncTest = s;
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; delete (globalThis as any).planningSyncTest; });
  globalThis.fetch = (async input => {
    const url = new URL(String(input));
    const kind = url.searchParams.get('detail');
    let body: any = { as_of: '24.09.2026 12:00:00' };
    if (kind === 'document-evidence') {
      s.calls++;
      body.order = [{ order_ref: url.searchParams.get('order_ref'), supplier_ref: 'supplier' }];
    } else if (kind === 'reconciliation') body.supplier = [{ supplier_ref: 'supplier', supplier_name: 'Поставщик' }];
    return new Response(JSON.stringify(body));
  }) as typeof fetch;
  const mocks: Record<string, string> = {
    'one-c-env': "export const readOneCRuntimeEnv=()=>({baseUrl:'https://test.invalid',user:'test',password:'test'});",
    'procurement-payment-source': 'export const fetchRawSupplierOrderFinance=async()=>globalThis.planningSyncTest.raw; export const normalizeSupplierOrder=x=>x;',
    'procurement-planning-evidence': "export const planningDiscovery=()=>{if(globalThis.planningSyncTest.fail)throw Error('INCOMPLETE');return {orders:new Map(),links:[],balances:[]}};",
    'procurement-reconciliation-total-check': 'export const supplierTotalCheck=()=>true;',
    'procurement-planning-verification': "export const verifyPlanningOrder=(row,d,detail,supplier,at)=>{globalThis.planningSyncTest.checks++;return {...row,planningState:'receipt_debt',verifiedAt:at}};",
  };
  const bundle = await build({ entryPoints: ['lib/procurement-planning-sync.ts'], bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external', plugins: [{ name: 'test-sources', setup(b) {
    b.onResolve({ filter: /\/(one-c-env|procurement-payment-source|procurement-planning-evidence|procurement-reconciliation-total-check|procurement-planning-verification)$/ }, a => ({ path: a.path.split('/').pop()!, namespace: 'test' }));
    b.onLoad({ filter: /.*/, namespace: 'test' }, a => ({ contents: mocks[a.path], loader: 'js' }));
  } }] });
  const module = { exports: {} as any };
  new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
  const run = module.exports.collectPlanningSnapshot;
  const first = await run({ rows: [] }, [], now);
  assert.equal(s.calls, 1); assert.equal(s.checks, 1);
  const paid = { ref: 'old-paid', planningState: 'settled', orderPaymentGap: 0 };
  first.rows.push(paid);
  const reused = await run(first, [], new Date(now.getTime() + 60000));
  assert.equal(s.calls, 1, 'no reread of unchanged order or paid archive');
  assert.deepEqual(reused.rows.find((r: any) => r.ref === paid.ref), paid);
  s.raw.rows[0] = { ...s.raw.rows[0], orderPaymentGap: 700 };
  const changed = await run(reused, [], new Date(now.getTime() + 120000));
  assert.equal(s.calls, 2); assert.equal(changed.rows.find((r: any) => r.ref === 'one').orderPaymentGap, 700);
  await run(changed, [], new Date(now.getTime() + 7 * 60000));
  assert.equal(s.calls, 3, 'bounded periodic refresh also catches evidence changes outside raw row');
  s.fail = true;
  await assert.rejects(() => run(changed, [], now));
  s.fail = false; s.raw.complete = false;
  await assert.rejects(() => run(changed, [], now), /INCOMPLETE_FINANCE_SOURCE/);
});
