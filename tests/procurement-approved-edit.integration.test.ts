import test from 'node:test';
import assert from 'node:assert/strict';
import {PrismaClient} from '@prisma/client';
import {build} from 'esbuild';
import {createRequire} from 'node:module';

test('admin edits preserve links, audit and notify; roles, races, paid and 1C collection states are protected',async()=>{
  assert.equal(process.env.DATABASE_URL,'postgresql://postgres@127.0.0.1:55439/procurement_receipts_current_test');
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
  }finally{await db.supplierPaymentPlan.delete({where:{id:plan.id}});await db.user.deleteMany({where:{id:{in:[employee.id,admin.id]}}});await db.$disconnect();delete g.approvedEditTest;}
});
