import test from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { build } from 'esbuild';
import { createRequire } from 'node:module';

test('basis changes keep one plan, preserve terms, reapprove and reject paid/stale/overlapping targets', async () => {
  assert.equal(process.env.DATABASE_URL, 'postgresql://postgres:local-test-only@127.0.0.1:55437/payment_test');
  const db = new PrismaClient();
  const marker = `basis-change-${Date.now()}`;
  const user = await db.user.create({data:{name:marker,login:marker,passwordHash:'not-login',role:'EMPLOYEE',portalArea:'PROCUREMENT'}});
  const admin = await db.user.create({data:{name:marker+'admin',login:marker+'admin',passwordHash:'not-login',role:'ADMIN'}});
  const today = new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow'}).format(new Date());
  const none = {state:'NO_EVIDENCE',issuedAmount:0,paidAmount:0,paidForeignAmount:0};
  const state:any = {db,user,admin,supplier:marker,complete:true,debt:500000,paid:none,orders:[
    {ref:'basis-order',number:'DEMO-334',date:today,supplierPartner:marker,supplierCounterparty:'',manager:marker,
      amount:250000,orderPaymentGap:100000,planningState:'receipt_debt'},
    {ref:'foreign-order',number:'FOREIGN',date:today,supplierPartner:'Other',supplierCounterparty:'',manager:'Other',orderPaymentGap:100000,planningState:'receipt_debt'},
  ]};
  (globalThis as any).basisChangeTest = state;
  const mocks:Record<string,string> = {
    'admin-api-auth':'export const requireAdminApi=async()=>({ok:true,user:globalThis.basisChangeTest.admin});',
    'procurement-qr-funding-source':'export const readQrFunding=async plans=>new Map(plans.map(p=>[p.id,{state:globalThis.basisChangeTest.qrState||"none"}]));',
    auth:'export const getCurrentUser=async()=>globalThis.basisChangeTest.user;',
    prisma:'export const prisma=globalThis.basisChangeTest.db;',
    'procurement-request-catalogue':'export const fetchRequestOrderCatalogue=async()=>({complete:globalThis.basisChangeTest.complete,rows:globalThis.basisChangeTest.orders});',
    'procurement-payment-source':'export const ordersForManager=(rows,name)=>rows.filter(r=>r.manager===name);',
    'procurement-supplier-roster':'export const fetchManagerSupplierNames=async()=>[globalThis.basisChangeTest.supplier];',
    'procurement-supplier-settlements':'export const fetchSupplierSettlements=async()=>({complete:globalThis.basisChangeTest.complete,rows:[]});export const summarizeSupplierSettlements=()=>({bySupplier:{[globalThis.basisChangeTest.supplier]:{debt:globalThis.basisChangeTest.debt,advance:0,closingBalance:-globalThis.basisChangeTest.debt,reviewRequired:false}},unsupportedCurrencyRows:0});',
    'procurement-planning-sync':'export const verifySelectedPlanningOrders=async rows=>rows;',
    'procurement-currency-payment-source':'export const fetchSupplierCurrencyPaymentSnapshot=async()=>({complete:globalThis.basisChangeTest.complete,rubPaymentsSupported:true,payments:[],conversions:[]});',
    'expense-request-source':'export const expenseRequestMoscowDayEnd=()=>new Date("2026-09-26T00:00:00+03:00");export const fetchExpenseRequestSnapshot=async()=>({complete:globalThis.basisChangeTest.complete,rows:[]});export const expenseRequestMoscowCalendarDate=()=>"2026-09-25";',
    'procurement-currency-payment-evidence':'export const matchProcurementPaymentEvidence=plans=>new Map(plans.map(p=>[p.id,globalThis.basisChangeTest.paid]));',
    'procurement-usdt-rate':'export const getLatestProcurementUsdtRate=async()=>({rate:90});',
    'procurement-payment-notifications':'export const notifyProcurementManagerAboutPendingEdit=async()=>{};export const notifyAdminsAboutProcurementPlans=async()=>{};export const notifyProcurementManagerAboutDecision=async()=>{};',
  };
  async function load(entry:string) {
    const result=await build({entryPoints:[entry],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',plugins:[{name:'test-io',setup(b){
      b.onResolve({filter:/^(?:@\/lib\/|\.\/)/},a=>{const key=a.path.replace(/^@\/lib\/|^\.\//,'');return mocks[key]?{path:key,namespace:'mock'}:null;});
      b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path]}));
    }}]});
    const module={exports:{} as any};new Function('require','module','exports',result.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);
    return module.exports;
  }
  try {
    const route=await load('app/api/procurement/payment-plans/[id]/route.ts');
    const revisions=await load('lib/procurement-plan-revision-server.ts');
    const plan=await db.supplierPaymentPlan.create({data:{managerUserId:user.id,planCode:marker,supplierPartner:marker,
      orderRefs:[],orderNumbers:[],plannedDate:new Date(`${today}T00:00:00Z`),plannedAmount:12345,condition:'Не менять комментарий',
      paymentMethod:'CASH',currency:'RUB',status:'SUBMITTED'}});
    const read=()=>db.supplierPaymentPlan.findUniqueOrThrow({where:{id:plan.id}});
    const payload=async(basis:'ORDER'|'DEBT'|'ADVANCE', extra:any={})=>({...await read(),basis,orderRefs:basis==='ORDER'?['basis-order']:[],
      orderNumbers:[],plannedDate:today,plannedAmount:12345,version:(await read()).updatedAt.toISOString(),...extra});
    const send=async(body:any)=>route.PATCH(new Request('http://localhost/test',{method:'PATCH',body:JSON.stringify(body)}),{params:Promise.resolve({id:plan.id})});
    const expectStatus=async(body:any,status:number)=>{const response=await send(body);const value=await response.json();assert.equal(response.status,status,JSON.stringify(value));return value;};
    await expectStatus(await payload('ORDER',{supplierPartner:'Other'}),400);
    await expectStatus(await payload('ORDER',{orderRefs:['foreign-order']}),409);
    await expectStatus(await payload('ORDER',{orderRefs:['basis-order','basis-order']}),409);
    await expectStatus(await payload('ORDER',{version:'stale'}),409);
    state.complete=false;await expectStatus(await payload('ORDER'),409);state.complete=true;
    state.paid={...none,state:'PARTIALLY_ISSUED',issuedAmount:100};await expectStatus(await payload('ORDER'),409);state.paid=none;
    await db.supplierPaymentPlan.update({where:{id:plan.id},data:{oneCCashEvidence:{manualRubleLinks:[{ref:'old-rko',fingerprint:'proof'}]}}});
    await expectStatus(await payload('ORDER'),409);
    await db.supplierPaymentPlan.update({where:{id:plan.id},data:{oneCCashEvidence:{}}});
    const collision=await db.supplierPaymentPlan.create({data:{managerUserId:user.id,planCode:marker+'other',supplierPartner:marker,
      orderRefs:['basis-order'],orderNumbers:['DEMO-334'],plannedDate:new Date(`${today}T00:00:00Z`),plannedAmount:500,condition:'other',paymentMethod:'CASH',status:'SUBMITTED'}});
    await expectStatus(await payload('ORDER'),409);
    await db.supplierPaymentPlan.delete({where:{id:collision.id}});
    const first=await expectStatus(await payload('ORDER',{orderNumbers:['forged']}),200);
    assert.equal(first.id,plan.id);assert.deepEqual(first.orderNumbers,['DEMO-334']);
    assert.equal(Number(first.plannedAmount),12345);assert.equal(first.condition,'Не менять комментарий');assert.equal(first.plannedDate.slice(0,10),today);
    assert.equal(await db.supplierPaymentPlan.count({where:{managerUserId:user.id}}),1);
    state.debt=0;await expectStatus(await payload('DEBT'),409);state.debt=500000;
    await expectStatus(await payload('DEBT'),200);
    assert.deepEqual((await read()).orderRefs,[]);
    const racePayload=await payload('ORDER');
    const races=await Promise.all([send(racePayload),send(racePayload)]);
    assert.deepEqual(races.map(r=>r.status).sort(),[200,409]);
    await expectStatus(await payload('DEBT'),200);
    await db.supplierPaymentPlan.update({where:{id:plan.id},data:{status:'APPROVED',approvedById:admin.id,approvedAt:new Date()}});
    const propose=()=>payload('ORDER',{changeReason:'Уточнили заказ поставщика'}).then(body=>expectStatus(body,200));
    const pending=await propose();
    assert.deepEqual((await read()).orderRefs,[],'original debt basis remains effective until approval');
    assert.match(JSON.stringify(pending.revision.changes),/Основание оплаты/);
    state.paid={...none,state:'PARTIALLY_PAID_BY_ONE_C',paidForeignAmount:1};
    await assert.rejects(()=>revisions.decideApprovedRevision(plan.id,admin.id,pending.revision.id,true,''),/частичной оплаты/);
    state.paid=none;
    state.orders[0].receiptSettlement={debtRub:0,receipts:[{ref:'receipt',remainingRub:0}]};
    await assert.rejects(()=>revisions.decideApprovedRevision(plan.id,admin.id,pending.revision.id,true,''),/не предлагается/);
    delete state.orders[0].receiptSettlement;
    const lateCollision=await db.supplierPaymentPlan.create({data:{managerUserId:user.id,planCode:marker+'late',supplierPartner:marker,
      orderRefs:['basis-order'],orderNumbers:['DEMO-334'],plannedDate:new Date(`${today}T00:00:00Z`),plannedAmount:500,condition:'other',paymentMethod:'CASH',status:'SUBMITTED'}});
    await assert.rejects(()=>revisions.decideApprovedRevision(plan.id,admin.id,pending.revision.id,true,''),/другую незавершённую/);
    await db.supplierPaymentPlan.delete({where:{id:lateCollision.id}});
    await revisions.decideApprovedRevision(plan.id,admin.id,pending.revision.id,false,'Оставить долг');
    assert.deepEqual((await read()).orderRefs,[]);
    const accepted=await propose();
    const approvalStarted=Date.now();
    await revisions.decideApprovedRevision(plan.id,admin.id,accepted.revision.id,true,'');
    assert.deepEqual((await read()).orderRefs,['basis-order']);
    assert.ok(Date.parse(((await read()).oneCCashEvidence as any).paymentMatchFrom)>=approvalStarted,'older RKO are not rebound to the newly approved basis');
    const toDebt=await expectStatus(await payload('DEBT',{changeReason:'Оплата общим долгом'}),200);
    state.debt=0;
    await assert.rejects(()=>revisions.decideApprovedRevision(plan.id,admin.id,toDebt.revision.id,true,''),/долга поставщику нет/);
    state.debt=500000;
    await revisions.decideApprovedRevision(plan.id,admin.id,toDebt.revision.id,true,'');
    assert.deepEqual((await read()).orderRefs,[]);
    state.paid={...none,state:'ISSUED_BY_ONE_C',issuedAmount:12345};
    await expectStatus(await payload('ORDER',{changeReason:'Нельзя после оплаты'}),409);
    const events=await db.supplierPaymentPlanEvent.findMany({where:{planId:plan.id}});
    assert.ok(events.some(event=>event.action==='UPDATED' && (event.snapshot as any).before?.orderRefs.length===0));
    assert.ok(events.some(event=>event.action==='REVISION_REJECTED'));
    assert.equal(Number((await read()).plannedAmount),12345);
    assert.equal((await read()).condition,'Не менять комментарий');
    assert.equal(await db.supplierPaymentPlan.count({where:{managerUserId:user.id}}),1);

    state.paid=none;
    const advance=await expectStatus(await payload('ADVANCE',{paymentPurpose:'SUPPLIER_ADVANCE',changeReason:'Аванс поставщику'}),200);
    assert.equal((await read()).paymentPurpose,'GOODS');
    await revisions.decideApprovedRevision(plan.id,admin.id,advance.revision.id,true,'');
    assert.equal((await read()).paymentPurpose,'SUPPLIER_ADVANCE');
    const edit=await load('app/api/admin/procurement/payment-plans/[id]/edit/route.ts');
    const params={params:Promise.resolve({id:plan.id})};
    const adminEdit=async(basis:string,refs:string[])=>edit.PATCH(new Request('http://localhost/test',{method:'PATCH',body:JSON.stringify({basis,orderRefs:refs,version:(await read()).updatedAt.toISOString()})}),params);
    assert.equal((await adminEdit('ORDER',['basis-order'])).status,200);
    assert.deepEqual((await read()).orderNumbers,['DEMO-334']);
    state.debt=0;
    assert.equal((await adminEdit('DEBT',[])).status,409);
    assert.equal((await adminEdit('ADVANCE',[])).status,200);
    assert.equal((await read()).paymentPurpose,'SUPPLIER_ADVANCE');
    const req=await db.supplierPaymentReceipt.create({data:{planId:plan.id,authorUserId:user.id,originalName:'fixture',storageKey:marker,mimeType:'image/png',size:1,sha256:marker,purpose:'RECEIPT'}});
    const cancel=await load('app/api/procurement/payment-plans/[id]/cancel/route.ts');
    const asBuyer=async(version:string)=>cancel.POST(new Request('http://localhost/test',{method:'POST',body:JSON.stringify({version})}),params);
    const version=async()=>(await read()).updatedAt.toISOString();
    assert.equal((await asBuyer(await version())).status,409,'payment receipt protects the plan');
    await db.supplierPaymentReceipt.update({where:{id:req.id},data:{purpose:'REQUISITES'}});
    state.user={...user,id:admin.id};
    assert.equal((await asBuyer(await version())).status,409,'other buyers cannot cancel');
    state.user=user;
    await db.supplierPaymentPlan.update({where:{id:plan.id},data:{paymentMethod:'ACCOUNTABLE_QR'}});
    for(const qrState of ['confirmed','unavailable']){
      state.qrState=qrState;
      assert.equal((await asBuyer(await version())).status,409);
      assert.equal((await adminEdit('ORDER',['basis-order'])).status,409);
    }
    state.qrState='none';
    assert.equal((await asBuyer('stale')).status,409);
    const v=await version();
    const concurrent=await Promise.all([asBuyer(v),asBuyer(v)]);
    assert.deepEqual(concurrent.map(r=>r.status).sort(),[200,409]);
    assert.equal((await read()).status,'CANCELLED');
    assert.equal(await db.supplierPaymentReceipt.count({where:{planId:plan.id}}),1);
    const cancellation=await db.supplierPaymentPlanEvent.findFirstOrThrow({where:{planId:plan.id,action:'CANCELLED'}});
    assert.equal((cancellation.snapshot as any).actorName,user.name);
    const adminCancel=await load('app/api/admin/procurement/payment-plans/[id]/route.ts');
    for(const status of ['SUBMITTED','APPROVED']){
      await db.supplierPaymentPlan.update({where:{id:plan.id},data:{status}});
      const sendCancel=async()=>adminCancel.PATCH(new Request('http://localhost/test',{method:'PATCH',body:JSON.stringify({action:'CANCEL',version:await version()})}),params);
      state.paid={...none,state:'PAID_BY_ONE_C',paidAmount:12345};
      assert.equal((await sendCancel()).status,409);
      state.paid=none;
      assert.equal((await sendCancel()).status,200);
    }
  } finally {
    await db.supplierPaymentReceipt.deleteMany({where:{authorUserId:user.id}});
    await db.supplierPaymentPlan.deleteMany({where:{managerUserId:user.id}});
    await db.user.deleteMany({where:{id:{in:[user.id,admin.id]}}});
    await db.$disconnect();delete (globalThis as any).basisChangeTest;
  }
});
