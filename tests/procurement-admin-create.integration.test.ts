import test from 'node:test';
import assert from 'node:assert/strict';
import {PrismaClient} from '@prisma/client';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {matchProcurementPaymentEvidence} from '../lib/procurement-currency-payment-evidence';

// Hard boundary: this test must never connect to a working portal database.
const expected='postgresql://postgres@127.0.0.1:55716/procurement_admin_create_test';
test('admin and buyer create dated requests through the real routes, transaction, audit and notification tables',async t=>{
  assert.equal(process.env.DATABASE_URL,expected);
  const db=new PrismaClient();t.after(()=>db.$disconnect());
  const marker='admin-create-'+randomUUID();
  const buyer=await db.user.create({data:{login:marker+'-buyer',passwordHash:'NO_LOGIN',name:'Test Buyer',oneCManagerName:'Buyer in 1C',role:'EMPLOYEE',portalArea:'PROCUREMENT'}});
  const admin=await db.user.create({data:{login:marker+'-admin',passwordHash:'NO_LOGIN',name:'Test Admin',role:'ADMIN'}});
  const other=await db.user.create({data:{login:marker+'-other',passwordHash:'NO_LOGIN',name:'Other Buyer',role:'EMPLOYEE',portalArea:'PROCUREMENT'}});
  const supplier=marker+' Supplier';
  const state:any={db,actor:admin,complete:true,planningError:null,orders:[{ref:marker+'-order',number:'TEST-497',date:'2026-11-16',supplierPartner:supplier,supplierCounterparty:supplier+' legal',manager:buyer.oneCManagerName,amount:10000,orderPaymentGap:10000,receiptAmount:10000,paymentAmount:0,supplierDebt:100000,orderComment:'',noAcquisitions:{checkedAt:'2026-11-16'},planningState:'prepayment'}]};
  state.readEvidence=async()=>{
    const plans=await db.supplierPaymentPlan.findMany({include:{manager:true}});
    return Object.assign(matchProcurementPaymentEvidence(plans.map(p=>({...p,orderRefs:p.orderRefs as string[],plannedAmount:Number(p.plannedAmount),foreignAmount:p.foreignAmount==null?null:Number(p.foreignAmount),plannedDate:p.plannedDate.toISOString(),createdAt:p.createdAt.toISOString()})),[],[],[]),{versions:new Map(plans.map(p=>[p.id,p.updatedAt.toISOString()]))});
  };
  (globalThis as any).adminCreateTest=state;
  t.after(()=>{delete (globalThis as any).adminCreateTest;});
  const mocks:Record<string,string>={
    auth:'export const getCurrentUser=async()=>globalThis.adminCreateTest.actor;',
    prisma:'export const prisma=globalThis.adminCreateTest.db;',
    'procurement-request-catalogue':'export const fetchRequestOrderCatalogue=async()=>({complete:globalThis.adminCreateTest.complete,rows:globalThis.adminCreateTest.orders});',
    'procurement-supplier-roster':`export const fetchManagerSupplierNames=async manager=>manager==='Buyer in 1C'?[globalThis.adminCreateTest.orders[0].supplierPartner]:[];`,
    'procurement-supplier-settlements':`export const fetchSupplierSettlements=async()=>({complete:globalThis.adminCreateTest.complete,rows:[]});export const summarizeSupplierSettlements=(rows,names)=>({bySupplier:Object.fromEntries(names.map(name=>[name,{debt:100000,advance:0,closingBalance:-100000,reviewRequired:false}])),unsupportedCurrencyRows:0});`,
    'procurement-plan-revision-server':'export const freshEvidence=()=>globalThis.adminCreateTest.readEvidence();',
    'procurement-planning-submit':'export const planningSubmissionError=async()=>globalThis.adminCreateTest.planningError;',
    'procurement-usdt-funding-server':'export const readFundingBalance=async()=>null;export const assertFundingBalance=async()=>{};',
    'procurement-usdt-rate':`export const getLatestProcurementUsdtRate=async()=>({rate:88,checkedAt:'2026-11-16',sourceLabel:'Test conversion'});`,
    'procurement-cny-rate':'export const getProcurementCnyRate=async()=>undefined;',
    'procurement-currency-balance':`export const getProcurementUsdtBalance=async()=>({balance:0,error:''});`,
  };
  async function load(entry:string){
    const output=await build({entryPoints:[entry],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',plugins:[{name:'read-boundaries',setup(b){
      b.onResolve({filter:/^(?:@\/lib\/|\.\/)/},a=>{const name=a.path.split('/').at(-1)!;return mocks[name]?{path:name,namespace:'test-read'}:null;});
      b.onLoad({filter:/.*/,namespace:'test-read'},a=>({contents:mocks[a.path],loader:'js'}));
    }}]});
    const m={exports:{} as any};new Function('require','module','exports',output.outputFiles[0].text)(createRequire(import.meta.url),m,m.exports);return m.exports;
  }
  const batch=await load('app/api/procurement/payment-plans/batch/route.ts');
  const single=await load('app/api/procurement/payment-plans/route.ts');
  const context=await load('app/api/admin/procurement/create-context/route.ts');
  const debt={basis:'DEBT',supplierPartner:supplier,plannedAmount:10000,paymentMethod:'CASH'};
  const send=(date:string,patch:any={})=>batch.POST(new Request('http://localhost/test',{method:'POST',body:JSON.stringify({managerUserId:buyer.id,plannedDate:date,rows:[{...debt,...patch}]})}));
  let response=await send('2026-11-20');assert.equal(response.status,201,JSON.stringify(await response.clone().json()));const first=(await response.json()).plans[0];
  const stored=await db.supplierPaymentPlan.findUniqueOrThrow({where:{id:first.id},include:{events:true}});
  assert.equal(stored.managerUserId,buyer.id);assert.equal(stored.events[0].actorUserId,admin.id);assert.equal(stored.status,'SUBMITTED');
  assert.deepEqual(stored.orderRefs,[]);
  const notice=await db.adminInboxEvent.findFirstOrThrow({where:{sourceId:first.id}});assert.match(notice.body,/Test Admin/);
  assert.equal(await db.adminInboxReceipt.count({where:{eventId:notice.id,userId:admin.id}}),1);
  assert.equal((await send('2026-11-20')).status,409,'same-day retry does not create another supplier-wide payment');
  response=await send('2026-11-16');assert.equal(response.status,201,'future Luxo-style request does not block today');
  assert.equal(await db.supplierPaymentPlan.count({where:{managerUserId:buyer.id}}),2);
  const races=await Promise.all([send('2026-11-21'),send('2026-11-21')]);assert.deepEqual(races.map(r=>r.status).sort(),[201,409]);
  assert.equal((await send('2026-11-22',{basis:'ADVANCE',paymentPurpose:'SUPPLIER_ADVANCE'})).status,201);
  assert.equal((await send('2026-11-23',{supplierPartner:'Not assigned'})).status,400);
  state.complete=false;assert.equal((await send('2026-11-23')).status,503);state.complete=true;
  state.planningError='Оплата уже погашена';
  const orderPayload={managerUserId:buyer.id,supplierPartner:supplier,orderRefs:[state.orders[0].ref],orderNumbers:['forged-number'],plannedDate:'2026-11-24',plannedAmount:3000,paymentMethod:'BANK'};
  const sendOrder=(patch:any={})=>single.POST(new Request('http://localhost/test',{method:'POST',body:JSON.stringify({...orderPayload,...patch})}));
  assert.equal((await sendOrder()).status,409);state.planningError=null;
  response=await sendOrder();assert.equal(response.status,201);const orderPlan=await response.json();
  assert.deepEqual(orderPlan.orderNumbers,['TEST-497'],'1C remains authoritative for order identity');
  assert.equal((await sendOrder({plannedDate:'2026-11-25'})).status,409,'one explicit order is still not duplicated');
  const actual=await db.supplierPaymentPlan.findUniqueOrThrow({where:{id:orderPlan.id},include:{events:true}});assert.equal(actual.events[0].actorUserId,admin.id);
  assert.equal((await sendOrder({managerUserId:other.id})).status,400,'admin cannot put another manager’s 1C order under this buyer');
  await db.user.update({where:{id:buyer.id},data:{isActive:false}});assert.equal((await send('2026-11-25')).status,403);await db.user.update({where:{id:buyer.id},data:{isActive:true}});
  state.actor=buyer;
  assert.equal((await send('2026-11-25')).status,403,'employee cannot supply an admin manager selector');
  assert.equal((await context.GET(new Request('http://localhost/test'))).status,403);
  const normal=await batch.POST(new Request('http://localhost/test',{method:'POST',body:JSON.stringify({plannedDate:'2026-11-25',rows:[debt]})}));assert.equal(normal.status,201,'ordinary buyer entry point remains available');
  const normalId=(await normal.json()).plans[0].id;assert.equal((await db.supplierPaymentPlanEvent.findFirstOrThrow({where:{planId:normalId}})).actorUserId,buyer.id);
  state.actor=admin;
  response=await context.GET(new Request(`http://localhost/test?managerUserId=${buyer.id}`));assert.equal(response.status,200);
  const view=await response.json();assert.ok(view.supplierBalances[supplier]);assert.ok(view.activeOrderRefs.includes(state.orders[0].ref));
  assert.equal((await context.GET(new Request('http://localhost/test?managerUserId=not-an-id'))).status,400);
  await db.user.update({where:{id:buyer.id},data:{oneCManagerName:'Тохов Астемир'}});
  const cargo={managerUserId:buyer.id,paymentPurpose:'DELIVERY',supplierPartner:'Карго Юра',orderRefs:[],orderNumbers:[],plannedDate:'2026-11-26',plannedAmount:2500,paymentMethod:'CASH'};
  const sendCargo=(date:string)=>single.POST(new Request('http://localhost/test',{method:'POST',body:JSON.stringify({...cargo,plannedDate:date})}));
  response=await sendCargo('2026-11-26');assert.equal(response.status,201);const cargoId=(await response.json()).id;
  const storedCargo=await db.supplierPaymentPlan.findUniqueOrThrow({where:{id:cargoId},include:{events:true}});
  assert.equal(storedCargo.managerUserId,buyer.id);assert.equal(storedCargo.events[0].actorUserId,admin.id);assert.equal(storedCargo.supplierPartner,'Карго Юра');
  assert.equal((await sendCargo('2026-11-26')).status,409);assert.equal((await sendCargo('2026-11-27')).status,201);
  await db.user.update({where:{id:buyer.id},data:{oneCManagerName:buyer.oneCManagerName}});
  const countBefore=await db.supplierPaymentPlan.count();state.actor=null;assert.equal((await send('2026-11-26')).status,401);assert.equal(await db.supplierPaymentPlan.count(),countBefore);
});
