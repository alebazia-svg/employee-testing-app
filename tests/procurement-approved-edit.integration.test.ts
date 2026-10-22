import test from 'node:test';
import assert from 'node:assert/strict';
import {PrismaClient} from '@prisma/client';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {paymentPreparationDate} from '../lib/procurement-schedule';

test('admin edits preserve links, audit and notify; roles, races, paid and 1C collection states are protected',async()=>{
  assert.ok(['postgresql://postgres@127.0.0.1:55439/procurement_receipts_current_test','postgresql://postgres:local-test-only@127.0.0.1:55451/funding_schedule_test'].includes(process.env.DATABASE_URL||''),'isolated local database required');
  const db=new PrismaClient(),g=globalThis as any,marker=`approved-edit-${Date.now()}`;
  const employee=await db.user.create({data:{name:marker,login:marker,passwordHash:'not-login',role:'EMPLOYEE',portalArea:'PROCUREMENT'}});
  const admin=await db.user.create({data:{name:marker+'admin',login:marker+'admin',passwordHash:'not-login',role:'ADMIN'}});
  const plan=await db.supplierPaymentPlan.create({data:{planCode:marker,managerUserId:employee.id,supplierPartner:'Luxo',supplierCounterparty:'supplier',orderRefs:['order423'],orderNumbers:['423'],condition:'',plannedDate:new Date('2026-10-12'),plannedAmount:731483,foreignAmount:8173,exchangeRate:89.5,paymentMethod:'USDT',currency:'USDT',status:'APPROVED',oneCCashEvidence:{untouched:'sentinel'},approvedAt:new Date(),approvedById:admin.id}});
  const state:any=g.approvedEditTest={db,user:null,paid:{state:'NO_EVIDENCE',issuedAmount:0,paidAmount:0,paidForeignAmount:0},fail:false,stale:false};
  try{
    const mocks:Record<string,string>={
      auth:'export const getCurrentUser=async()=>globalThis.approvedEditTest.user;',prisma:'export const prisma=globalThis.approvedEditTest.db;',
      'expense-request-source':'export const expenseRequestMoscowCalendarDate=()=>"2026-10-12";',
      'procurement-plan-revision-server':`export async function freshEvidence(){const s=globalThis.approvedEditTest;if(s.fail)throw Error('Сверка недоступна.');const plans=await s.db.supplierPaymentPlan.findMany();return Object.assign(new Map(plans.map(p=>[p.id,s.paid])),{versions:new Map(plans.map(p=>[p.id,s.stale?'old':p.updatedAt.toISOString()]))});}`,
    };
    const out=await build({entryPoints:['app/api/admin/procurement/payment-plans/[id]/edit/route.ts'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',plugins:[{name:'isolated',setup(b){b.onResolve({filter:/^(?:@\/lib\/|\.\/)/},a=>{const key=a.path.replace(/^@\/lib\/|^\.\//,'');return mocks[key]?{path:key,namespace:'mock'}:null;});b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path],loader:'js'}));}}]});
    const mod={exports:{} as any};new Function('require','module','exports',out.outputFiles[0].text)(createRequire(import.meta.url),mod,mod.exports);
    const current=()=>db.supplierPaymentPlan.findUniqueOrThrow({where:{id:plan.id}});
    const send=async(patch:any={})=>mod.exports.PATCH(new Request('http://localhost/test',{method:'PATCH',body:JSON.stringify({plannedDate:'2026-10-13',reason:'Поставщик перенёс отгрузку',version:(await current()).updatedAt.toISOString(),...patch})}),{params:Promise.resolve({id:plan.id})});
    assert.equal((await send()).status,401);state.user=employee;assert.equal((await send()).status,403);state.user=admin;
    await db.workdayNotification.create({data:{userId:employee.id,fingerprint:`procurement-payment:${plan.id}:approved:old`,kind:'procurement_payment_approved',title:'Старая дата',body:'12 октября',scheduledAt:new Date()}});
    assert.equal((await send()).status,200);
    const changed=await current();assert.equal(changed.plannedDate.toISOString().slice(0,10),'2026-10-13');assert.equal(Number(changed.plannedAmount),731483);
    assert.deepEqual(changed.orderRefs,['order423']);assert.deepEqual(changed.oneCCashEvidence,{untouched:'sentinel'});assert.equal(changed.status,'APPROVED');assert.equal(changed.approvedAt?.getTime(),plan.approvedAt?.getTime());
    const notices=await db.workdayNotification.findMany({where:{userId:employee.id},orderBy:{id:'asc'}});
    assert.equal(notices[0].status,'cancelled');assert.equal(notices[1].title,'Дата оплаты изменена');assert.match(notices[1].body,/13 октября/);
    assert.equal(await db.supplierPaymentPlanEvent.count({where:{planId:plan.id}}),1);
    assert.equal((await send({plannedDate:'2026-10-14',version:plan.updatedAt.toISOString()})).status,409);
    state.stale=true;assert.equal((await send({plannedDate:'2026-10-14'})).status,409);state.stale=false;
    state.fail=true;assert.equal((await send({plannedDate:'2026-10-14'})).status,409);state.fail=false;
    state.paid={...state.paid,state:'PAID_BY_ONE_C'};assert.equal((await send({plannedDate:'2026-10-14'})).status,409);
    state.paid={state:'PARTIALLY_ISSUED',issuedAmount:400000,paidAmount:0,paidForeignAmount:0};
    assert.equal((await send({plannedAmount:300000,foreignAmount:null,exchangeRate:null})).status,409);
    assert.equal((await send({paymentMethod:'BANK'})).status,409);
    state.paid={state:'NO_EVIDENCE',issuedAmount:0,paidAmount:0,paidForeignAmount:0,collection:{state:'ready'}};
    assert.equal((await send({plannedDate:'2026-10-14'})).status,409);
    state.paid={state:'NO_EVIDENCE',issuedAmount:0,paidAmount:0,paidForeignAmount:0};
    await db.supplierPaymentPlan.update({where:{id:plan.id},data:{oneCCashEvidence:{untouched:'sentinel',pendingRevision:{id:'pending',data:{},changes:[]}}}});
    assert.equal((await send({plannedDate:'2026-10-14'})).status,409);
    assert.equal((await current()).plannedDate.toISOString().slice(0,10),'2026-10-13');
    // A pending request can be corrected, but only a separate approval action
    // may authorize payment. Keep every existing supplier/order identity.
    await db.supplierPaymentPlan.update({where:{id:plan.id},data:{status:'SUBMITTED',approvedAt:null,approvedById:null,oneCCashEvidence:{untouched:'sentinel'}}});
    const pendingBefore=await current();
    assert.equal((await send({plannedDate:'2026-10-15',foreignAmount:8000,exchangeRate:90,plannedAmount:720000,reason:''})).status,200);
    const pendingAfter=await current();
    assert.equal(pendingAfter.status,'SUBMITTED');assert.equal(pendingAfter.approvedAt,null);assert.equal(pendingAfter.approvedById,null);
    assert.equal(Number(pendingAfter.plannedAmount),720000);assert.equal(Number(pendingAfter.foreignAmount),8000);
    for(const key of ['supplierPartner','supplierCounterparty','orderRefs','orderNumbers','oneCCashEvidence'] as const)assert.deepEqual(pendingAfter[key],pendingBefore[key]);
    const pendingNotices=await db.workdayNotification.findMany({where:{userId:employee.id,kind:'procurement_payment_updated'}});
    assert.equal(pendingNotices.length,1);assert.equal(pendingNotices[0].title,'Заявка изменена администратором');assert.match(pendingNotices[0].body,/ещё на согласовании/);
    state.paid={...state.paid,state:'SOURCE_UNAVAILABLE'};
    assert.equal((await send({plannedDate:'2026-10-16'})).status,409);state.paid={...state.paid,state:'NO_EVIDENCE'};
    const approvalBuild=await build({entryPoints:['app/api/admin/procurement/payment-plans/[id]/route.ts'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',plugins:[{name:'isolated',setup(b){b.onResolve({filter:/^(?:@\/lib\/|\.\/)/},a=>{const key=a.path.replace(/^@\/lib\/|^\.\//,'');return mocks[key]?{path:key,namespace:'mock'}:null;});b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path],loader:'js'}));}}]});
    const approval={exports:{} as any};new Function('require','module','exports',approvalBuild.outputFiles[0].text)(createRequire(import.meta.url),approval,approval.exports);
    const approve=(version:string)=>approval.exports.PATCH(new Request('http://localhost/test',{method:'PATCH',body:JSON.stringify({action:'APPROVE',version})}),{params:Promise.resolve({id:plan.id})});
    assert.equal((await approve(pendingBefore.updatedAt.toISOString())).status,409);
    assert.equal((await current()).status,'SUBMITTED');
    assert.equal((await approve(pendingAfter.updatedAt.toISOString())).status,200);
    const approvedAfter=await current();assert.equal(approvedAfter.status,'APPROVED');assert.equal(approvedAfter.approvedById,admin.id);assert.equal(Number(approvedAfter.plannedAmount),720000);
    assert.equal((await db.workdayNotification.findUniqueOrThrow({where:{id:pendingNotices[0].id}})).status,'cancelled');
    // Exercise real persistence across both endpoints: defer while pending,
    // then approve separately. Approval must retain the funding decision and
    // never send the original date as a promise when funding is unknown.
    const scheduleBuild=await build({entryPoints:['app/api/procurement/payment-plans/[id]/schedule/route.ts'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',plugins:[{name:'isolated',setup(b){b.onResolve({filter:/^(?:@\/lib\/|\.\/)/},a=>{const key=a.path.replace(/^@\/lib\/|^\.\//,'');return mocks[key]?{path:key,namespace:'mock'}:null;});b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path],loader:'js'}));}}]});
    const schedule={exports:{} as any};new Function('require','module','exports',scheduleBuild.outputFiles[0].text)(createRequire(import.meta.url),schedule,schedule.exports);
    for(const date of ['', '2026-10-25']) {
      await db.supplierPaymentPlan.update({where:{id:plan.id},data:{status:'SUBMITTED',approvedAt:null,approvedById:null,oneCCashEvidence:{untouched:'sentinel'}}});
      const beforeDeferral=await current();
      const response=await schedule.exports.PATCH(new Request('http://localhost/test',{method:'PATCH',body:JSON.stringify({action:'DEFER',version:beforeDeferral.updatedAt.toISOString(),date,comment:''})}),{params:Promise.resolve({id:plan.id})});
      assert.equal(response.status,200);
      const deferred=await current();
      assert.equal(deferred.status,'SUBMITTED');assert.equal(deferred.approvedAt,null);
      assert.equal(paymentPreparationDate({...deferred,plannedDate:deferred.plannedDate.toISOString()}),date||null);
      assert.equal((await approve(beforeDeferral.updatedAt.toISOString())).status,409);
      assert.equal((await approve(deferred.updatedAt.toISOString())).status,200);
      const approved=await current();
      assert.equal(approved.status,'APPROVED');assert.equal(approved.approvedById,admin.id);
      for(const field of ['oneCCashEvidence','plannedDate','plannedAmount','foreignAmount','exchangeRate','orderRefs','orderNumbers','supplierCounterparty'] as const)assert.deepEqual(approved[field],deferred[field],field);
      const notification=await db.workdayNotification.findFirstOrThrow({where:{userId:employee.id,kind:'procurement_payment_approved',status:'pending'},orderBy:{id:'desc'}});
      assert.equal(notification.title,'Оплата согласована');
      assert.ok(notification.body.endsWith(date?'к 25 октября':'Дата подготовки денег уточняется'));
      assert.equal(await db.workdayNotification.count({where:{userId:employee.id,kind:'procurement_payment_updated',status:'pending'}}),0);
    }
  }finally{await db.supplierPaymentPlan.delete({where:{id:plan.id}});await db.user.deleteMany({where:{id:{in:[employee.id,admin.id]}}});await db.$disconnect();delete g.approvedEditTest;}
});
