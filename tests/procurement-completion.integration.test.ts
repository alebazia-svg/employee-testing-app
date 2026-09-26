import test from 'node:test';
import assert from 'node:assert/strict';
import {PrismaClient} from '@prisma/client';
import {build} from 'esbuild';
import {createRequire} from 'node:module';

test('completion is ADMIN-only, fresh, atomic, reversible, audited and never changes original amount',async()=>{
  assert.equal(process.env.DATABASE_URL,'postgresql://postgres:local-test-only@127.0.0.1:55437/payment_test');
  const db=new PrismaClient(),marker=`completion-${Date.now()}`;
  const employee=await db.user.create({data:{name:marker,login:marker,passwordHash:'not-login',role:'EMPLOYEE',portalArea:'PROCUREMENT'}});
  const admin=await db.user.create({data:{name:marker+'admin',login:marker+'admin',passwordHash:'not-login',role:'ADMIN'}});
  const paid={state:'PARTIALLY_ISSUED',issuedAmount:999,paidAmount:0,paidForeignAmount:0,remainingAmount:1,remainingForeignAmount:null,actualExchangeRate:null,cashOrders:[{ref:'rko',number:'DEMO',date:'26.09.2026 12:00:00',amount:999,cashbox:''}],currencyPayments:[]};
  const state:any={db,user:null,paid,available:true};(globalThis as any).completionTest=state;
  const mocks:Record<string,string>={
    auth:'export const getCurrentUser=async()=>globalThis.completionTest.user;',
    prisma:'export const prisma=globalThis.completionTest.db;',
    'procurement-plan-revision-server':`export async function freshEvidence(){const s=globalThis.completionTest;if(!s.available)throw Error('Источник недоступен.');const rows=await s.db.supplierPaymentPlan.findMany();return Object.assign(new Map(rows.map(p=>[p.id,s.paid])),{versions:new Map(rows.map(p=>[p.id,p.updatedAt.toISOString()]))});}`,
  };
  try{
    const output=await build({entryPoints:['app/api/admin/procurement/payment-plans/[id]/completion/route.ts'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',plugins:[{name:'isolated',setup(b){b.onResolve({filter:/^(?:@\/lib\/|\.\/)/},a=>{const key=a.path.replace(/^@\/lib\/|^\.\//,'');return mocks[key]?{path:key,namespace:'mock'}:null;});b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path]}));}}]});
    const module={exports:{} as any};new Function('require','module','exports',output.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);const route=module.exports;
    const data={managerUserId:employee.id,planCode:marker,supplierPartner:marker,orderRefs:['order'],orderNumbers:['DEMO'],plannedDate:new Date(),plannedAmount:1000,condition:'Не менять',paymentMethod:'CASH',status:'APPROVED',oneCCashEvidence:{manualRubleLinks:[],other:'preserve'}};
    const plan=await db.supplierPaymentPlan.create({data});const props={params:Promise.resolve({id:plan.id})};
    const read=()=>db.supplierPaymentPlan.findUniqueOrThrow({where:{id:plan.id}});
    const preview=(action='COMPLETE')=>route.GET(new Request(`http://localhost/preview?action=${action}`),props);
    const send=(quote:string,action='COMPLETE',reason='Согласована окончательная сумма')=>route.POST(new Request('http://localhost/complete',{method:'POST',body:JSON.stringify({quote,action,reason})}),props);
    assert.equal((await preview()).status,401);state.user=employee;assert.equal((await preview()).status,403);assert.equal((await send('')).status,403);state.user=admin;
    state.available=false;assert.equal((await preview()).status,409);state.available=true;
    state.paid={...paid,state:'NEEDS_REVIEW'};assert.equal((await preview()).status,409);state.paid=paid;
    let q=await (await preview()).json();assert.equal(q.remainingAmount,1);assert.equal((await send(q.quote,'COMPLETE','')).status,409);
    state.paid={...paid,issuedAmount:998};assert.equal((await send(q.quote)).status,409);state.paid=paid;
    await db.supplierPaymentPlan.update({where:{id:plan.id},data:{condition:'Новая версия'}});assert.equal((await send(q.quote)).status,409);
    q=await (await preview()).json();const results=await Promise.all([send(q.quote),send(q.quote)]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
    const closed=await read();assert.equal(closed.status,'COMPLETED_WITHOUT_TOPUP');assert.equal(Number(closed.plannedAmount),1000);assert.equal((closed.oneCCashEvidence as any).other,'preserve');assert.deepEqual((closed.oneCCashEvidence as any).completion.paymentRefs,['rko']);
    const other=await db.supplierPaymentPlan.create({data:{...data,planCode:marker+'other'}});
    q=await(await preview('REOPEN')).json();assert.equal((await send(q.quote,'REOPEN','Нужна доплата')).status,409);
    await db.supplierPaymentPlan.delete({where:{id:other.id}});
    q=await(await preview('REOPEN')).json();assert.equal((await send(q.quote,'REOPEN','Нужна доплата')).status,200);
    assert.equal((await read()).status,'APPROVED');assert.equal((await read()).condition,'Новая версия');
    const events=await db.supplierPaymentPlanEvent.findMany({where:{planId:plan.id},orderBy:{createdAt:'asc'}});
    assert.deepEqual(events.map(e=>e.action),['COMPLETED_WITHOUT_TOPUP','REOPENED']);assert.ok(events.every(e=>e.actorUserId===admin.id));
  }finally{await db.supplierPaymentPlan.deleteMany({where:{managerUserId:employee.id}});await db.user.deleteMany({where:{id:{in:[employee.id,admin.id]}}});await db.$disconnect();delete (globalThis as any).completionTest;}
});
