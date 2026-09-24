import test from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { build } from 'esbuild';

test('revision routes enforce roles, ownership, reason and repeat approval with real persistence', async () => {
  assert.equal(process.env.DATABASE_URL, 'postgresql://postgres:local-test-only@127.0.0.1:55437/payment_test');
  const db = new PrismaClient();
  const g = globalThis as any;
  g.revisionRouteDb = db;
  g.revisionRouteUser = null;
  const marker = `revision-route-${Date.now()}`;
  const employee = await db.user.create({data:{name:marker,login:marker,passwordHash:'not-login',role:'EMPLOYEE',portalArea:'PROCUREMENT'}});
  const admin = await db.user.create({data:{name:marker+'admin',login:marker+'admin',passwordHash:'not-login',role:'ADMIN'}});
  const plan = await db.supplierPaymentPlan.create({data:{planCode:marker,managerUserId:employee.id,supplierPartner:'Remax',orderRefs:['order'],orderNumbers:['358'],plannedDate:new Date('2026-09-19'),plannedAmount:700000,condition:'',paymentMethod:'USDT',currency:'USDT',status:'APPROVED'}});
  try {
    const mocks: Record<string,string> = {
      auth:'export const getCurrentUser=async()=>globalThis.revisionRouteUser;',
      prisma:'export const prisma=globalThis.revisionRouteDb;',
      'procurement-currency-payment-source':'export const fetchSupplierCurrencyPaymentSnapshot=async()=>({complete:true,payments:[],conversions:[]});',
      'expense-request-source':'export const fetchExpenseRequestSnapshot=async()=>({complete:true,rows:[]});export const expenseRequestMoscowCalendarDate=()=>"2026-09-17";',
      'procurement-payment-source':'export const fetchSupplierOrderFinance=async()=>({complete:true,rows:[]});export const ordersForManager=x=>x;export const ordersRequiringPayment=x=>x;',
      'procurement-request-catalogue':'export const fetchRequestOrderCatalogue=async()=>({complete:true,rows:[]});',
      'procurement-planning-sync':'export const verifySelectedPlanningOrders=async x=>x;',
      'procurement-usdt-rate':'export const getLatestProcurementUsdtRate=async()=>({rate:89});',
      'procurement-payment-notifications':'export const notifyAdminsAboutProcurementPlans=async()=>{};export const notifyProcurementManagerAboutDecision=async()=>{};',
    };
    async function route(entry:string) {
      const output=await build({entryPoints:[entry],bundle:true,write:false,platform:'node',format:'esm',packages:'external',plugins:[{name:'isolated-boundaries',setup(b){
        b.onResolve({filter:/^(?:@\/lib\/|\.\/)/},a=>{const key=a.path.replace(/^@\/lib\/|^\.\//,'');return mocks[key]?{path:key,namespace:'mock'}:null;});
        b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path],loader:'js'}));
      }}]});
      // CJS permits resolving Prisma from this test's dependency tree.
      const cjs=await build({stdin:{contents:output.outputFiles[0].text,resolveDir:process.cwd()},bundle:false,write:false,format:'cjs',platform:'node'});
      const {createRequire}=await import('node:module');
      const module={exports:{} as any};
      new Function('require','module','exports',cjs.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);
      return module.exports;
    }
    const employeeRoute=await route('app/api/procurement/payment-plans/[id]/route.ts');
    const adminRoute=await route('app/api/admin/procurement/payment-plans/[id]/revision/route.ts');
    const send=async(body:any)=>employeeRoute.PATCH(new Request('http://localhost/test',{method:'PATCH',body:JSON.stringify(body)}),{params:Promise.resolve({id:plan.id})});
    const decide=async(body:any)=>adminRoute.POST(new Request('http://localhost/test',{method:'POST',body:JSON.stringify(body)}),{params:Promise.resolve({id:plan.id})});
    const payload={supplierPartner:'Remax',orderRefs:['order'],orderNumbers:['358'],plannedDate:'2026-09-21',plannedAmount:750000,paymentMethod:'USDT',changeReason:'Поставщик уточнил сумму',version:plan.updatedAt.toISOString()};
    assert.equal((await send(payload)).status,401);
    assert.equal((await decide({})).status,401);
    g.revisionRouteUser=admin;
    assert.equal((await send(payload)).status,403);
    g.revisionRouteUser={...employee,id:admin.id};
    assert.equal((await send(payload)).status,404);
    g.revisionRouteUser=employee;
    assert.equal((await decide({})).status,403);
    assert.equal((await send({...payload,changeReason:''})).status,409);
    const response=await send(payload);
    assert.equal(response.status,200);
    const pending=await response.json();
    assert.ok(pending.revision.id);
    assert.equal(Number((await db.supplierPaymentPlan.findUniqueOrThrow({where:{id:plan.id}})).plannedAmount),700000);
    g.revisionRouteUser=admin;
    assert.equal((await decide({action:'REJECT',revisionId:pending.revision.id,reason:''})).status,409);
    assert.equal((await decide({action:'APPROVE',revisionId:pending.revision.id})).status,200);
    assert.equal(Number((await db.supplierPaymentPlan.findUniqueOrThrow({where:{id:plan.id}})).plannedAmount),750000);
    assert.equal((await decide({action:'APPROVE',revisionId:pending.revision.id})).status,409);
  } finally {
    await db.supplierPaymentPlan.delete({where:{id:plan.id}});
    await db.user.deleteMany({where:{id:{in:[employee.id,admin.id]}}});
    await db.$disconnect();
  }
});
