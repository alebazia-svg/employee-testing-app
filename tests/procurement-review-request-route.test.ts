import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';

test('request keeps real order reference, allows unclear/settled orders without required explanation', async t => {
  const mode = process.env.PROCUREMENT_PLANNING_MODE;
  process.env.PROCUREMENT_PLANNING_MODE = 'snapshot';
  t.after(() => { if (mode === undefined) delete process.env.PROCUREMENT_PLANNING_MODE; else process.env.PROCUREMENT_PLANNING_MODE = mode; delete (globalThis as any).reviewRoute; });
  const state: any = { created: [], debt: 464, notified: [], row: { ref: 'real-order', number: '000123', supplierPartner: 'Поставщик', supplierCounterparty: '', planningState: 'needs_review', planningReason: 'Есть авансы', orderPaymentGap: 0 } };
  (globalThis as any).reviewRoute = state;
  state.row.date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const mocks: Record<string, string> = {
    auth: `export const getCurrentUser=async()=>({id:10,name:'Закупщик',role:'EMPLOYEE',portalArea:'PROCUREMENT'});`,
    prisma: `const s=globalThis.reviewRoute;const tx={$executeRaw:async()=>{},supplierPaymentPlan:{findMany:async()=>[],create:async({data})=>{const p={...data,id:'test'};s.created.push(p);return p;}},supplierPaymentPlanEvent:{create:async()=>({id:'event'})}};export const prisma={$transaction:async fn=>fn(tx)};`,
    'procurement-payment-source': `export const fetchSupplierOrderFinance=async()=>({complete:true,rows:[globalThis.reviewRoute.row]});export const ordersForManager=x=>x;export const ordersRequiringPayment=x=>x;`,
    'procurement-request-catalogue': `export const fetchRequestOrderCatalogue=async()=>({complete:true,rows:[globalThis.reviewRoute.row]});`,
    'procurement-supplier-settlements': `export const fetchSupplierSettlements=async()=>({complete:true,rows:[]});export const summarizeSupplierSettlements=()=>({bySupplier:{Поставщик:{debt:globalThis.reviewRoute.debt}},unsupportedCurrencyRows:0});`,
    'procurement-plan-revision-server': 'export const freshEvidence=async()=>new Map();',
    'procurement-usdt-rate': 'export const getLatestProcurementUsdtRate=async()=>({rate:90});',
    'expense-request-source': 'export const expenseRequestMoscowCalendarDate=()=>"2026-09-24";',
    'procurement-payment-notifications': 'export const notifyAdminsAboutProcurementPlans=async({plans})=>{globalThis.reviewRoute.notified.push(...plans)};',
    'procurement-planning-sync': 'export const verifySelectedPlanningOrders=async()=>[globalThis.reviewRoute.row];',
  };
  const output = await build({ entryPoints: ['app/api/procurement/payment-plans/batch/route.ts'], bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external', plugins: [{name:'boundaries',setup(b){
    b.onResolve({filter: /procurement-planning-sync$/},()=>({path:'procurement-planning-sync',namespace:'mock'}));
    b.onResolve({filter:/^@\/lib\//},a=>mocks[a.path.slice(6)]?{path:a.path.slice(6),namespace:'mock'}:null);
    b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path],loader:'js'}));
  }}] });
  const module = { exports: {} as any };
  new Function('require','module','exports',output.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);
  const send = (patch = {}) => module.exports.POST(new Request('http://localhost/test',{method:'POST',body:JSON.stringify({plannedDate:'2026-09-25',rows:[{basis:'ORDER',orderRef:'real-order',plannedAmount:50000,paymentMethod:'CASH',...patch}]})}));
  assert.equal((await send()).status,201);
  assert.equal(state.created.length,1);
  assert.equal((await send({condition:'Счёт на дополнительную поставку'})).status,201);
  assert.deepEqual(state.created[0].orderRefs,['real-order']);
  assert.deepEqual(state.created[0].orderNumbers,['000123']);
  assert.match(state.created[0].condition,/Нужна сверка перед оплатой/);
  assert.match(state.created[1].condition,/Счёт на дополнительную поставку/);
  assert.equal(state.notified[0].condition,state.created[0].condition);
  assert.equal((await send({basis:'DEBT',orderRef:'',supplierPartner:'Поставщик'})).status,400);
  state.row.planningState='settled';
  assert.equal((await send({condition:'повторная оплата'})).status,201);
});
