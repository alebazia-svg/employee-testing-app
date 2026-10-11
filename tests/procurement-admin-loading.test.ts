import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';
import {buildAdminProcurementForecast,type AdminForecastInput} from '../lib/procurement-admin-forecast';

const input:AdminForecastInput={todayKey:'2026-10-11',plansComplete:true,ordersComplete:true,
  plansWithOrderContext:[{id:'pending',status:'SUBMITTED',supplierPartner:'Supplier',paymentMethod:'CASH',plannedDate:'2026-10-12',plannedAmount:'100000',foreignAmount:null,evidence:{state:'NO_EVIDENCE',issuedAmount:0,paidAmount:0}}],
  scopedOrders:[],managerOrders:[],usdtBalance:{balance:null},accountableBalance:{balance:null}};

test('unknown forecast sources never imply zero debts, available money or covered requests',()=>{
  const result=buildAdminProcurementForecast(input,null);
  assert.equal(result.forecast30Days.safeMinor,null);
  assert.equal(result.forecast30Days.coverageReady,false);
  assert.equal(result.debtAllocation.resourcesMinor,null);
  assert.equal(result.debtReserveBreakdown.salaryMinor,null);
  assert.equal(result.requestFundingAssessments[0].state,'unavailable');
  assert.equal(result.forecast30Days.rows.find(row=>row.date==='2026-10-12')?.items[0].amountMinor,10_000_000);
});

test('first page streams verification separately and never starts forecast-only sources',()=>{
  const page=readFileSync('app/(dashboard)/admin/procurement/page.tsx','utf8');
  const live=readFileSync('app/(dashboard)/admin/procurement/AdminProcurementLive.tsx','utf8');
  for(const name of ['loadOwnerCashForecastShadow','fetchPayrollForecastEvidence','fetchTBankOwnerTransferControl','loadProcurementForecastHistory','fetchProcurementPriorityDebts'])assert.ok(!page.includes(name),name);
  for(const name of ['matchProcurementPaymentEvidence','preservePaymentEvidenceViews','fetchSupplierCurrencyPaymentSnapshot','historyConcurrency: 2'])assert.ok(live.includes(name),name);
  assert.ok(live.includes('Promise.resolve(initialPlans)'));
  assert.ok(page.includes('<Suspense fallback={null}>'));
  assert.ok(page.includes('adminInitialView(plans,'));
  assert.ok(!page.includes('await AdminProcurementLive'));
  assert.ok(page.indexOf('getCurrentUser()')<page.indexOf('await readAdminPlans()'));
  const client=readFileSync('app/(dashboard)/admin/procurement/AdminProcurementClient.tsx','utf8');
  assert.ok(client.includes("forecastRequested||tab==='plan'"));
  assert.ok(client.includes('onOpen={()=>setForecastRequested(true)}'));
  assert.ok(client.includes('tab !== "plan" || !!forecastStatus'));
  assert.ok(client.includes('!forecastStatus && funding'));
});

async function route(status:number,unavailable=false){
  let reads=0;
  const mocks:Record<string,unknown>={
    '@/lib/admin-api-auth':{requireAdminApi:async()=>({ok:status===200,response:new Response(null,{status})})},
    '@/lib/expense-request-source':{expenseRequestMoscowCalendarDate:()=>input.todayKey},
    '@/lib/procurement-admin-forecast-source':{loadAdminForecastSources:async()=>{reads++;return {asOf:input.todayKey,owner:{money:unavailable?null:{complete:true}},payroll:null,tbank:{status:'unavailable'},debts:null,history:null};}},
  };
  const output=await build({entryPoints:['app/api/admin/procurement/forecast/route.ts'],bundle:true,write:false,platform:'node',format:'cjs',plugins:[{name:'mock',setup(b){b.onResolve({filter:/^@\/lib\//},a=>({path:a.path,external:true}));}}]});
  const mod={exports:{} as {GET:()=>Promise<Response>}};
  new Function('require','module','exports',output.outputFiles[0].text)((name:string)=>mocks[name],mod,mod.exports);
  return {GET:mod.exports.GET,reads:()=>reads};
}
test('deferred forecast stays admin-only and does not read sources before authorization',async()=>{
  for(const status of [401,403]){const r=await route(status);assert.equal((await r.GET()).status,status);assert.equal(r.reads(),0);}
  const r=await route(200),response=await r.GET();assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(r.reads(),1);
  const failed=await route(200,true);assert.equal((await failed.GET()).status,503);
});
