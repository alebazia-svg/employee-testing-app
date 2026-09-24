import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';

test('fresh selection allows any balance but blocks duplicate/missing identity and network failures', async t => {
  const saved = process.env.PROCUREMENT_PLANNING_MODE;
  t.after(() => { if (saved === undefined) delete process.env.PROCUREMENT_PLANNING_MODE; else process.env.PROCUREMENT_PLANNING_MODE = saved; delete (globalThis as any).planningSubmitTest; });
  const state: any = { rows: [{ ref: 'one', planningState: 'receipt_debt', orderPaymentGap: 1000 }], calls: 0 };
  (globalThis as any).planningSubmitTest = state;
  const bundle = await build({ entryPoints: ['lib/procurement-planning-submit.ts'], bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external', plugins: [{ name: 'scope', setup(b) {
    b.onResolve({ filter: /procurement-planning-sync$/ }, () => ({ path: 'reader', namespace: 'test' }));
    b.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export const verifySelectedPlanningOrders=async()=>{const s=globalThis.planningSubmitTest;s.calls++;if(s.fail)throw Error();return s.rows;}', loader: 'js' }));
  } }] });
  const module = { exports: {} as any }; new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
  const run = (amount = 1000, refs = ['one'], condition = '') => module.exports.planningSubmissionError(state.rows, [{ refs, amount, condition }]);
  delete process.env.PROCUREMENT_PLANNING_MODE; assert.equal(await run(), null); assert.equal(state.calls, 1);
  process.env.PROCUREMENT_PLANNING_MODE = 'snapshot'; assert.equal(await run(), null);
  assert.equal(await run(1001), null); assert.ok(await run(1000, ['one', 'one']));
  state.rows[0].planningState = 'settled'; assert.equal(await run(), null);
  state.rows[0].planningState = 'needs_review'; assert.equal(await run(), null);
  assert.equal(await run(2000, ['one'], 'Счёт поставщика на следующую поставку'), null);
  assert.equal(await run(1000, ['one'], 'Оплата по выбранным заказам'), null);
  assert.ok(await run(1000, ['missing'], 'Счёт поставщика'));
  state.rows[0].planningState = 'prepayment'; assert.equal(await run(), null);
  state.rows[0].paymentClosure = { state:'paid',remainingRub:0,checkedAt:new Date().toISOString(),receipts:[{number:'771'}] };
  assert.ok(await run(), 'a newly paid receipt blocks a stale selection at submission');
  state.rows[0].paymentClosure.checkedAt = new Date(Date.now() - 3600000).toISOString();
  assert.match(await run(), /до обновления сверки/, 'old payment proof cannot silently allow duplicate payment');
  state.rows[0].paymentClosure = { state:'small_balance',remainingRub:200,checkedAt:new Date().toISOString(),receipts:[{number:'771'}] };
  assert.equal(await run(), null, 'a real small remainder stays available for planning');
  delete state.rows[0].paymentClosure;
  state.fail = true; assert.ok(await run());
});
