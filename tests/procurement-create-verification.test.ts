import test from 'node:test';
import assert from 'node:assert/strict';
import {PrismaClient} from '@prisma/client';
import {build} from 'esbuild';
import {createRequire} from 'node:module';

test('real form batch path overlaps independent checks but writes only after both succeed',async()=>{
  assert.equal(process.env.DATABASE_URL,'postgresql://postgres@127.0.0.1:55439/procurement_receipts_current_test');
  const db=new PrismaClient(),g=globalThis as any,marker=`create-read-test-${Date.now()}`;
  const user=await db.user.create({data:{name:marker,login:marker,passwordHash:'not-login',role:'EMPLOYEE',portalArea:'PROCUREMENT'}});
  const state:any=g.createReadTest={db,user,complete:true,planningError:'Заказ уже оплачен.',fail:false,started:false,
    orders:[{ref:marker,number:'TEST-425',supplierPartner:marker,supplierCounterparty:'',manager:marker,date:'2026-10-12',amount:10000,orderPaymentGap:10000,planningState:'receipt_debt'}]};
  try {
    const mocks:Record<string,string>={
      auth:'export const getCurrentUser=async()=>globalThis.createReadTest.user;',
      prisma:'export const prisma=globalThis.createReadTest.db;',
      'procurement-request-catalogue':'export const fetchRequestOrderCatalogue=async()=>({complete:globalThis.createReadTest.complete,rows:globalThis.createReadTest.orders});',
      'procurement-supplier-roster':'export const fetchManagerSupplierNames=async()=>[];',
      'procurement-payment-source':'export const ordersForManager=(rows,name)=>rows.filter(r=>r.manager===name);export const normalizeSupplierOrder=x=>x;',
      'procurement-order-selection':'export const ordersForRequest=rows=>rows;export const reviewRequestCondition=(_rows,comment)=>comment;',
      'procurement-supplier-settlements':'export const fetchSupplierSettlements=async()=>({complete:true,rows:[]});export const summarizeSupplierSettlements=()=>({bySupplier:{},unsupportedCurrencyRows:0});',
      'procurement-supplier-position':'export const buyerOrderPurpose=()=>"order";export const supplierPosition=()=>"debt";',
      'procurement-planning-submit':`export async function planningSubmissionError(){const s=globalThis.createReadTest;s.started=true;await new Promise(resolve=>{s.release=resolve});return s.planningError;}`,
      'procurement-plan-revision-server':`export async function freshEvidence(){const s=globalThis.createReadTest;if(!s.started||!s.release)throw Error('checks not concurrent');s.release();if(s.fail)throw Error('SOURCE_TIMEOUT');const rows=await s.db.supplierPaymentPlan.findMany();return Object.assign(new Map(),{versions:new Map(rows.map(p=>[p.id,p.updatedAt.toISOString()]))});}`,
    };
    const out=await build({entryPoints:['app/api/procurement/payment-plans/batch/route.ts'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',plugins:[{name:'isolated',setup(b){b.onResolve({filter:/^(?:@\/lib\/|\.\/)/},a=>{const key=a.path.replace(/^@\/lib\/|^\.\//,'');return mocks[key]?{path:key,namespace:'mock'}:null;});b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path],loader:'js'}));}}]});
    const mod={exports:{} as any};new Function('require','module','exports',out.outputFiles[0].text)(createRequire(import.meta.url),mod,mod.exports);
    const send=()=>{state.started=false;state.release=null;return mod.exports.POST(new Request('http://localhost/test',{method:'POST',body:JSON.stringify({plannedDate:'2026-10-13',rows:[{orderRef:marker,paymentMethod:'BANK',plannedAmount:10000,condition:''}]})}));};
    const count=()=>db.supplierPaymentPlan.count({where:{managerUserId:user.id}});
    assert.equal((await send()).status,409);assert.equal(await count(),0);
    state.planningError=null;state.fail=true;assert.notEqual((await send()).status,201);assert.equal(await count(),0);
    state.fail=false;const ok=await send();assert.equal(ok.status,201,JSON.stringify(await ok.clone().json()));assert.equal(await count(),1);
    assert.equal((await send()).status,409);assert.equal(await count(),1);
    state.complete=false;assert.equal((await send()).status,503);assert.equal(await count(),1);
  } finally {await db.supplierPaymentPlan.deleteMany({where:{managerUserId:user.id}});await db.user.delete({where:{id:user.id}});await db.$disconnect();delete g.createReadTest;}
});
