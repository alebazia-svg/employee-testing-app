import test from 'node:test';
import assert from 'node:assert/strict';
import {PrismaClient} from '@prisma/client';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {singlePaymentRequest} from '../lib/procurement-single-payment';

test('new single-payment payload persists order/debt and edits without changing recorded links',async()=>{
  assert.equal(process.env.DATABASE_URL,'postgresql://postgres@127.0.0.1:55439/procurement_receipts_current_test');
  const db=new PrismaClient();const g=globalThis as any;
  const marker='create-'+randomUUID();
  const user=await db.user.create({data:{name:marker,login:marker,passwordHash:'NO_LOGIN',role:'EMPLOYEE',portalArea:'PROCUREMENT'}});
  g.createTestDb=db;g.createTestUser=user;g.createTestNotices=[];
  const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const order={ref:marker,number:'TEST-425',date:day,supplierPartner:marker,supplierCounterparty:marker+' legal',manager:marker,amount:10000,orderPaymentGap:10000};
  g.createTestOrders=[order];
  const mocks:Record<string,string>={
    auth:'export const getCurrentUser=async()=>globalThis.createTestUser;',
    prisma:'export const prisma=globalThis.createTestDb;',
    'procurement-request-catalogue':'export const fetchRequestOrderCatalogue=async()=>({complete:true,rows:globalThis.createTestOrders});',
    'procurement-planning-sync':'export const verifySelectedPlanningOrders=async x=>x;',
    'procurement-supplier-roster':'export const fetchManagerSupplierNames=async()=>[globalThis.createTestOrders[0].supplierPartner];',
    'procurement-supplier-settlements':'export const fetchSupplierSettlements=async()=>({complete:true,rows:[]});export const summarizeSupplierSettlements=()=>({unsupportedCurrencyRows:0,bySupplier:{[globalThis.createTestOrders[0].supplierPartner]:{debt:10000,advance:0,closingBalance:-10000,reviewRequired:false}}});',
    'procurement-plan-revision-server':'export const freshEvidence=async()=>Object.assign(new Map(),{versions:new Map()});export const proposeApprovedRevision=()=>{throw Error("Unexpected approved revision");};',
    'procurement-payment-notifications':'export const notifyAdminsAboutProcurementPlans=async x=>globalThis.createTestNotices.push(x.action);',
  };
  async function route(entry:string){
    const output=await build({entryPoints:[entry],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',plugins:[{name:'local-boundaries',setup(b){
      b.onResolve({filter:/^(?:@\/lib\/|\.\/)/},a=>{const key=a.path.replace(/^@\/lib\/|^\.\//,'');return mocks[key]?{path:key,namespace:'mock'}:null;});
      b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path],loader:'js'}));
    }}]});
    const module={exports:{} as any};new Function('require','module','exports',output.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);return module.exports;
  }
  try{
    const create=await route('app/api/procurement/payment-plans/route.ts');
    const batch=await route('app/api/procurement/payment-plans/batch/route.ts');
    const edit=await route('app/api/procurement/payment-plans/[id]/route.ts');
    const request=(body:unknown,method='POST')=>new Request('http://localhost/test',{method,body:JSON.stringify(body)});
    const draft={plannedDate:day,plannedAmount:'1360',paymentMethod:'CNY',foreignAmount:'100',exchangeRate:'13.6',fundingSource:'',condition:'TEST'};
    const selected=singlePaymentRequest([order],draft);
    const response=await create.POST(request(selected.body));assert.equal(response.status,201,JSON.stringify(await response.clone().json()));
    const created=await response.json();
    let stored=await db.supplierPaymentPlan.findUniqueOrThrow({where:{id:created.id}});
    assert.deepEqual(stored.orderRefs,[order.ref]);assert.deepEqual(stored.orderNumbers,['TEST-425']);
    assert.equal(Number(stored.plannedAmount),1360);assert.equal(stored.currency,'CNY');assert.equal(stored.fundingSource,null);
    assert.equal((await create.POST(request(selected.body))).status,409);
    const links={manualRubleLinks:[{ref:'TEST-RKO',fingerprint:'TEST-FINGERPRINT'}],paymentMatchFrom:'2026-10-10T00:00:00Z'};
    stored=await db.supplierPaymentPlan.update({where:{id:created.id},data:{oneCCashEvidence:links}});
    const changed=await edit.PATCH(request({...selected.body,condition:'TEST amended',version:stored.updatedAt.toISOString()},'PATCH'),{params:Promise.resolve({id:created.id})});
    assert.equal(changed.status,200,JSON.stringify(await changed.clone().json()));
    stored=await db.supplierPaymentPlan.findUniqueOrThrow({where:{id:created.id}});
    assert.deepEqual(stored.oneCCashEvidence,links);assert.deepEqual(stored.orderRefs,[order.ref]);assert.equal(Number(stored.plannedAmount),1360);
    // Cancellation only of this test's request frees the supplier for the debt scenario.
    await db.supplierPaymentPlan.update({where:{id:created.id},data:{status:'CANCELLED'}});
    const debt=singlePaymentRequest([{...order,ref:'debt:'+marker}],{...draft,paymentMethod:'USDT',foreignAmount:'',exchangeRate:'',plannedAmount:'731483'});
    const debtResponse=await batch.POST(request(debt.body));assert.equal(debtResponse.status,201,JSON.stringify(await debtResponse.clone().json()));
    const debtPlan=(await debtResponse.json()).plans[0];
    assert.equal(Number(debtPlan.plannedAmount),731483);assert.deepEqual(debtPlan.orderRefs,[]);assert.equal(debtPlan.foreignAmount,null);assert.equal(debtPlan.exchangeRate,null);
    assert.equal((await batch.POST(request(debt.body))).status,409);
    assert.deepEqual(g.createTestNotices,['SUBMITTED','UPDATED','SUBMITTED']);
  }finally{
    await db.supplierPaymentPlan.updateMany({where:{managerUserId:user.id},data:{status:'CANCELLED'}});
    await db.$disconnect();delete g.createTestDb;delete g.createTestUser;delete g.createTestNotices;delete g.createTestOrders;
  }
});
