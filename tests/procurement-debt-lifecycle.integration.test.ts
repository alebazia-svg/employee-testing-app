import test from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { matchProcurementPaymentEvidence } from '../lib/procurement-currency-payment-evidence';
import { manualPaymentLinks } from '../lib/procurement-manual-payment-links';

test('supplier debt: real DB create, duplicate, edit, approve, partial/full payment and history evidence', async () => {
  assert.equal(process.env.DATABASE_URL, 'postgresql://postgres:local-test-only@127.0.0.1:55437/payment_test');
  const db = new PrismaClient();
  const marker = `debt-lifecycle-${Date.now()}`;
  const employee = await db.user.create({data:{name:marker,login:marker,passwordHash:'not-login',role:'EMPLOYEE',portalArea:'PROCUREMENT'}});
  const admin = await db.user.create({data:{name:marker+'admin',login:marker+'admin',passwordHash:'not-login',role:'ADMIN'}});
  const state: any = { db, user: employee, supplier: marker, payments: [] };
  (globalThis as any).debtLifecycle = state;
  const mocks: Record<string,string> = {
    auth:'export const getCurrentUser=async()=>globalThis.debtLifecycle.user;',
    'admin-api-auth':`export const requireAdminApi=async()=>{const user=globalThis.debtLifecycle.user;return user?.role==='ADMIN'?{ok:true,user}:{ok:false,response:Response.json({}, {status:403})}};`,
    prisma:'export const prisma=globalThis.debtLifecycle.db;',
    'procurement-payment-source':`export const ordersForManager=x=>x;export const normalizeSupplierOrder=x=>({ref:x.ref,number:'',supplierPartner:x.supplier_partner,supplierCounterparty:'',manager:x.manager});`,
    'procurement-request-catalogue':`export const fetchRequestOrderCatalogue=async()=>({complete:true,rows:[]});`,
    'procurement-planning-sync':`export const verifySelectedPlanningOrders=async x=>x;`,
    'procurement-supplier-roster':`export const fetchManagerSupplierNames=async()=>[globalThis.debtLifecycle.supplier];`,
    'procurement-supplier-settlements':`export const fetchSupplierSettlements=async()=>({complete:true,rows:[]});export const summarizeSupplierSettlements=()=>({bySupplier:{[globalThis.debtLifecycle.supplier]:{debt:657000,advance:0,closingBalance:-657000,reviewRequired:false}},unsupportedCurrencyRows:0});`,
    'procurement-currency-payment-source':'export const fetchSupplierCurrencyPaymentSnapshot=async()=>({complete:true,payments:globalThis.debtLifecycle.payments,conversions:[]});',
    'expense-request-source':'export const fetchExpenseRequestSnapshot=async()=>({complete:true,rows:[]});export const expenseRequestMoscowCalendarDate=()=>"2026-09-21";',
    'procurement-usdt-rate':'export const getLatestProcurementUsdtRate=async()=>({rate:89.5});',
    'procurement-payment-notifications':'export const notifyAdminsAboutProcurementPlans=async()=>{};export const notifyProcurementManagerAboutDecision=async()=>{};',
  };
  async function route(entry:string) {
    const output=await build({entryPoints:[entry],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',plugins:[{name:'isolated-boundaries',setup(b){
      b.onResolve({filter:/^(?:@\/lib\/|\.\/)/},a=>{const key=a.path.replace(/^@\/lib\/|^\.\//,'');return mocks[key]?{path:key,namespace:'mock'}:null;});
      b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path],loader:'js'}));
    }}]});
    const module={exports:{} as any};
    new Function('require','module','exports',output.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);
    return module.exports;
  }
  try {
    const batch = await route('app/api/procurement/payment-plans/batch/route.ts');
    const edit = await route('app/api/procurement/payment-plans/[id]/route.ts');
    const approve = await route('app/api/admin/procurement/payment-plans/[id]/route.ts');
    const link = await route('app/api/admin/procurement/payment-plans/[id]/payment-link/route.ts');
    const req = (body:any,method='POST')=>new Request('http://localhost/test',{method,body:JSON.stringify(body)});
    const body = {plannedDate:'2026-09-22', rows:[{basis:'DEBT',supplierPartner:marker,paymentMethod:'CASH',plannedAmount:200000}]};
    const attempts=await Promise.all([batch.POST(req(body)),batch.POST(req(body))]);
    assert.deepEqual(attempts.map(r=>r.status).sort(),[201,409]);
    const plan=(await attempts.find(r=>r.status===201)!.json()).plans[0];
    const params={params:Promise.resolve({id:plan.id})};
    assert.deepEqual(plan.orderRefs,[]);
    const data={supplierPartner:marker,orderRefs:[],orderNumbers:[],plannedDate:'2026-09-22',plannedAmount:250000,paymentMethod:'CASH'};
    assert.equal((await edit.PATCH(req({...data,supplierPartner:'Other'},'PATCH'),params)).status,400);
    assert.equal((await edit.PATCH(req(data,'PATCH'),params)).status,200);
    state.user=admin;
    assert.equal((await approve.PATCH(req({action:'APPROVE'},'PATCH'),params)).status,200);
    const read=()=>db.supplierPaymentPlan.findUniqueOrThrow({where:{id:plan.id}});
    assert.equal((await read()).status,'APPROVED');
    state.user=employee;
    assert.equal((await edit.PATCH(req({...data,plannedAmount:260000,changeReason:'',version:(await read()).updatedAt.toISOString()},'PATCH'),params)).status,409);
    state.user=admin;
    const date=new Date(Date.now()+60000);
    const d=new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(date).replace(',','');
    state.payments=[{ref:'11111111-1111-1111-1111-111111111111',number:'DEBT-TEST',date:d,posted:true,deleted:false,documentCurrency:'РУБ',documentAmount:100000,baseDocumentRef:'',supplier:marker}];
    assert.equal((await link.POST(req({ref:state.payments[0].ref,action:'LINK'}),params)).status,200);
    async function evidence() {const p=await read(); return matchProcurementPaymentEvidence([{...p,orderRefs:[],plannedAmount:Number(p.plannedAmount),foreignAmount:null,createdAt:p.createdAt.toISOString(),plannedDate:p.plannedDate.toISOString(),manualRubleLinks:manualPaymentLinks(p.oneCCashEvidence)}],[],state.payments,[]).get(p.id)!;}
    assert.equal((await evidence()).remainingAmount,150000);
    state.payments.push({...state.payments[0],ref:'22222222-2222-2222-2222-222222222222',documentAmount:150000});
    assert.equal((await link.POST(req({ref:state.payments[1].ref,action:'LINK'}),params)).status,200);
    assert.equal((await evidence()).state,'ISSUED_BY_ONE_C');
    assert.equal((await evidence()).remainingAmount,0);
    state.payments[1].deleted=true;
    assert.equal((await evidence()).state,'PARTIALLY_ISSUED');
    assert.equal((await evidence()).remainingAmount,150000,'cancelled document reopens the remaining payment');
    state.payments[1].deleted=false;
    state.payments[1].posted=false;
    assert.equal((await evidence()).remainingAmount,150000);
    state.payments[1].posted=true;
    assert.equal((await evidence()).remainingAmount,0);
    assert.equal(await db.supplierPaymentPlanEvent.count({where:{planId:plan.id,action:'PAYMENT_LINKED'}}),2);
  } finally {
    await db.supplierPaymentPlan.deleteMany({where:{managerUserId:employee.id}});
    await db.user.deleteMany({where:{id:{in:[employee.id,admin.id]}}});
    await db.$disconnect();
  }
});
