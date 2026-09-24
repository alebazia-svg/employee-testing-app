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
    'procurement-payment-source': `export const fetchSupplierOrderFinance=async()=>({complete:true,rows:[globalThis.reviewRoute.row]});export const ordersForManager=x=>x;export const ordersRequiringPayment=x=>x;export const normalizeSupplierOrder=x=>({ref:x.ref,number:x.number||'',supplierPartner:x.supplierPartner||x.supplier_partner||'',supplierCounterparty:x.supplierCounterparty||x.supplier_counterparty||'',manager:x.manager||''});`,
    'procurement-request-catalogue': `export const fetchRequestOrderCatalogue=async()=>({complete:true,rows:[globalThis.reviewRoute.row]});`,
    'procurement-supplier-settlements': `export const fetchSupplierSettlements=async()=>({complete:!globalThis.reviewRoute.incomplete,rows:[]});export const summarizeSupplierSettlements=()=>({bySupplier:{Поставщик:{debt:globalThis.reviewRoute.debt,advance:0,closingBalance:-globalThis.reviewRoute.debt,reviewRequired:false}},unsupportedCurrencyRows:0});`,
    'procurement-supplier-roster': 'export const fetchManagerSupplierNames=async()=>[];',
    'procurement-plan-revision-server': 'export const freshEvidence=async()=>new Map();',
    'procurement-usdt-rate': 'export const getLatestProcurementUsdtRate=async()=>({rate:90});',
    'expense-request-source': 'export const expenseRequestMoscowCalendarDate=()=>"2026-09-24";',
    'procurement-payment-notifications': 'export const notifyAdminsAboutProcurementPlans=async({plans})=>{globalThis.reviewRoute.notified.push(...plans)};',
    'procurement-planning-sync': 'export const verifySelectedPlanningOrders=async()=>[globalThis.reviewRoute.row];',
  };
  const loadRoute = async (entry: string) => {
  const output = await build({ entryPoints: [entry], bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external', plugins: [{name:'boundaries',setup(b){
    b.onResolve({filter: /procurement-planning-sync$/},()=>({path:'procurement-planning-sync',namespace:'mock'}));
    b.onResolve({filter:/^@\/lib\//},a=>mocks[a.path.slice(6)]?{path:a.path.slice(6),namespace:'mock'}:null);
    b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path],loader:'js'}));
  }}] });
  const module = { exports: {} as any };
  new Function('require','module','exports',output.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);
  return module;
  };
  const module = await loadRoute('app/api/procurement/payment-plans/batch/route.ts');
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
  state.row.date='2023-10-28';state.row.planningState='needs_review';
  assert.equal((await send()).status,400,'old nominal order alone is not admitted');
  state.row.outstandingAcquisitions={checkedAt:new Date().toISOString()};
  assert.equal((await send()).status,201,'old discovered acquisition can be planned through the actual server handler');
  assert.deepEqual(state.created.at(-1).orderRefs,['real-order']);
  state.debt=0;
  assert.equal((await send()).status,400,'old order without supplier debt cannot be submitted by bypassing the picker');
  state.row.date=new Date().toISOString().slice(0,10);
  delete state.row.outstandingAcquisitions;
  state.row.noAcquisitions={checkedAt:new Date().toISOString()};
  assert.equal((await send()).status,201,'an explicit prepayment remains possible without supplier debt');
  const single = await loadRoute('app/api/procurement/payment-plans/route.ts');
  const sendSingle = () => single.exports.POST(new Request('http://localhost/test',{method:'POST',body:JSON.stringify({supplierPartner:'Поставщик',orderRefs:['real-order'],orderNumbers:['000123'],plannedDate:'2026-09-25',plannedAmount:50000,paymentMethod:'CASH'})}));
  delete state.row.noAcquisitions;
  const before = state.created.length;
  assert.equal((await sendSingle()).status,400,'single request route cannot bypass the same zero-debt rule');
  assert.equal(state.created.length,before);
  state.incomplete=true;
  assert.equal((await sendSingle()).status,503,'incomplete settlements never become zero');
  assert.equal((await send()).status,503);
  state.incomplete=false;state.debt=464;
  assert.equal((await sendSingle()).status,201,'single route still permits an order with verified supplier debt');
});
