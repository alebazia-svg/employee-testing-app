import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';

test('batch route validates debt ownership, source completeness, duplicates and persists empty refs', async () => {
  const state: any = { user: { id: 10, name: 'Астемир', role: 'EMPLOYEE', portalArea: 'PROCUREMENT' }, complete: true, existing: [], created: [] };
  (globalThis as any).debtRouteTest = state;
  const mocks: Record<string, string> = {
    auth: 'export const getCurrentUser=async()=>globalThis.debtRouteTest.user;',
    prisma: `const s=globalThis.debtRouteTest; const tx={ $executeRaw:async()=>{}, supplierPaymentPlan:{findMany:async()=>s.existing,create:async({data})=>{const p={...data,id:'test'+s.created.length};s.created.push(p);return p;}},supplierPaymentPlanEvent:{create:async()=>({id:'event'})}}; export const prisma={$transaction:async fn=>fn(tx)};`,
    'procurement-request-catalogue': `export const fetchRequestOrderCatalogue=async()=>({complete:globalThis.debtRouteTest.complete,rows:[{ref:'order',number:'397',date:'2026-09-24',supplierPartner:'Курбан',supplierCounterparty:'',manager:'Астемир',orderPaymentGap:globalThis.debtRouteTest.orderGap||0,planningState:'receipt_debt'}]});`,
    'procurement-payment-source': `export const fetchSupplierOrderFinance=async()=>({complete:globalThis.debtRouteTest.complete,rows:[{ref:'order',number:'397',supplierPartner:'Курбан',supplierCounterparty:'',orderPaymentGap:globalThis.debtRouteTest.orderGap||0}]});export const ordersForManager=x=>x;export const ordersRequiringPayment=x=>x.filter(o=>o.orderPaymentGap>0);export const normalizeSupplierOrder=x=>({ref:x.ref,number:x.number||'',supplierPartner:x.supplierPartner||x.supplier_partner||'',supplierCounterparty:x.supplierCounterparty||x.supplier_counterparty||'',manager:x.manager||''});`,
    'procurement-supplier-settlements': `export const fetchSupplierSettlements=async()=>({complete:true,rows:[]});export const summarizeSupplierSettlements=()=>({bySupplier:{Курбан:{debt:657000,advance:0,closingBalance:-657000,reviewRequired:!!globalThis.debtRouteTest.review}},unsupportedCurrencyRows:0});`,
    'procurement-supplier-roster': `export const fetchManagerSupplierNames=async()=>['Курбан'];`,
    'procurement-plan-revision-server': 'export const freshEvidence=async()=>new Map();',
    'procurement-usdt-rate': 'export const getLatestProcurementUsdtRate=async()=>({rate:89.5});',
    'expense-request-source': 'export const expenseRequestMoscowCalendarDate=()=>"2026-09-21";',
    'procurement-payment-notifications': 'export const notifyAdminsAboutProcurementPlans=async()=>{};',
    'procurement-planning-submit': 'export const planningSubmissionError=async()=>globalThis.debtRouteTest.verificationError||null;',
  };
  const output = await build({ entryPoints: ['app/api/procurement/payment-plans/batch/route.ts'], bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external', plugins: [{ name: 'test-boundaries', setup(b) {
    b.onResolve({ filter: /^@\/lib\// }, a => mocks[a.path.slice(6)] ? { path: a.path.slice(6), namespace: 'mock' } : null);
    b.onLoad({ filter: /.*/, namespace: 'mock' }, a => ({ contents: mocks[a.path], loader: 'js' }));
  } }] });
  const module = { exports: {} as any };
  new Function('require', 'module', 'exports', output.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
  const send = (rows: any[]) => module.exports.POST(new Request('http://localhost/test', { method: 'POST', body: JSON.stringify({ plannedDate: '2026-09-22', rows }) }));
  const row = { basis: 'DEBT', supplierPartner: 'Курбан', plannedAmount: 200000, paymentMethod: 'CASH' };
  const user = state.user;
  state.user = null; assert.equal((await send([row])).status, 401);
  state.user = { ...user, role: 'ADMIN' }; assert.equal((await send([row])).status, 403);
  state.user = user;
  state.review=true;assert.equal((await send([row])).status,400);assert.equal(state.created.length,0);state.review=false;
  assert.equal((await send([null])).status, 400);
  assert.equal((await send([])).status, 400);
  assert.equal((await send([{ ...row, supplierPartner: 'Чужой' }])).status, 400);
  assert.equal((await send([{ ...row, orderRef: 'fake' }])).status, 400);
  assert.equal((await send([row, row])).status, 400);
  state.complete = false; assert.equal((await send([row])).status, 503); state.complete = true;
  state.orderGap = 200000;
  const orderRow = { ...row, basis: 'ORDER', orderRef: 'order', supplierPartner: 'Подменённое имя' };
  for (const rows of [[row, orderRow], [orderRow, row]]) {
    assert.equal((await send(rows)).status, 409);
    assert.equal(state.created.length, 0, 'reject the whole batch before any writes');
  }
  state.orderGap = 0;
  state.orderGap = 200000; state.verificationError = 'Оплата уже погашена';
  assert.equal((await send([orderRow])).status, 409);
  assert.equal(state.created.length, 0, 'changed 1C evidence blocks the entire submission');
  state.verificationError = null; state.orderGap = 0;
  assert.equal((await send([row])).status, 201);
  assert.deepEqual(state.created[0].orderRefs, []);
  assert.deepEqual(state.created[0].orderNumbers, []);
  assert.equal(state.created[0].condition, 'В счёт долга поставщику');
  state.existing = [{ ...state.created[0], status: 'APPROVED' }];
  assert.equal((await send([row])).status, 409);
  state.existing = [];
  assert.equal((await send([{ ...row, paymentMethod: 'USDT', plannedAmount: '', foreignAmount: 1000 }])).status, 201);
  assert.equal(Number(state.created[1].plannedAmount), 89500);
});
