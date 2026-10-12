import test from 'node:test';
import assert from 'node:assert/strict';
import {PrismaClient} from '@prisma/client';
import {build} from 'esbuild';
import {createRequire} from 'node:module';

test('approval verifies on server; stale, unavailable, paid and concurrent changes never approve',async()=>{
  assert.equal(process.env.DATABASE_URL,'postgresql://postgres@127.0.0.1:55439/procurement_receipts_current_test');
  const db=new PrismaClient(),g=globalThis as any,marker=`approval-safety-${Date.now()}`;
  const buyer=await db.user.create({data:{name:marker,login:marker,passwordHash:'not-login',role:'EMPLOYEE',portalArea:'PROCUREMENT'}});
  const admin=await db.user.create({data:{name:marker+'admin',login:marker+'admin',passwordHash:'not-login',role:'ADMIN'}});
  const plan=await db.supplierPaymentPlan.create({data:{planCode:marker,managerUserId:buyer.id,supplierPartner:'Test',orderRefs:[],orderNumbers:[],plannedDate:new Date(),plannedAmount:10000,condition:'',paymentMethod:'CASH',status:'SUBMITTED'}});
  const state:any=g.approvalSafety={db,user:null,reads:0,fail:false,stale:false,race:false,paid:{state:'NO_EVIDENCE'}};
  try {
    const mocks:Record<string,string>={
      auth:'export const getCurrentUser=async()=>globalThis.approvalSafety.user;',
      prisma:'export const prisma=globalThis.approvalSafety.db;',
      'procurement-plan-revision-server':`export async function freshEvidence(){const s=globalThis.approvalSafety;s.reads++;if(s.fail)throw Error('timeout');const rows=await s.db.supplierPaymentPlan.findMany();if(s.race)await s.db.supplierPaymentPlan.update({where:{id:rows.find(p=>p.planCode.startsWith('approval-safety-')).id},data:{condition:'changed during verification'}});return Object.assign(new Map(rows.map(p=>[p.id,s.paid])),{versions:new Map(rows.map(p=>[p.id,s.stale?'old':p.updatedAt.toISOString()]))});}`,
    };
    const out=await build({entryPoints:['app/api/admin/procurement/payment-plans/[id]/route.ts'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',plugins:[{name:'isolated',setup(b){b.onResolve({filter:/^(?:@\/lib\/|\.\/)/},a=>{const key=a.path.replace(/^@\/lib\/|^\.\//,'');return mocks[key]?{path:key,namespace:'mock'}:null;});b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path],loader:'js'}));}}]});
    const mod={exports:{} as any};new Function('require','module','exports',out.outputFiles[0].text)(createRequire(import.meta.url),mod,mod.exports);
    const current=()=>db.supplierPaymentPlan.findUniqueOrThrow({where:{id:plan.id}});
    const send=async(action='APPROVE',version?:string)=>mod.exports.PATCH(new Request('http://localhost/test',{method:'PATCH',body:JSON.stringify({action,reason:'Не требуется',version:version??(await current()).updatedAt.toISOString()})}),{params:Promise.resolve({id:plan.id})});
    assert.equal((await send()).status,401);state.user=buyer;assert.equal((await send()).status,403);assert.equal(state.reads,0);state.user=admin;
    assert.equal((await send('APPROVE','old')).status,409);assert.equal(state.reads,0);
    state.fail=true;assert.equal((await send()).status,503);state.fail=false;
    state.stale=true;assert.equal((await send()).status,409);state.stale=false;
    for(const status of ['PAID_BY_ONE_C','ISSUED_BY_ONE_C','SMALL_REMAINDER_COMPLETED','MISMATCH','NEEDS_REVIEW','SOURCE_UNAVAILABLE']){state.paid={state:status};assert.equal((await send()).status,409);}
    state.paid={state:'NO_EVIDENCE',paymentAmountNeedsConfirmation:true};assert.equal((await send()).status,409);
    state.paid={state:'NO_EVIDENCE'};state.race=true;assert.equal((await send()).status,409);state.race=false;
    assert.equal((await current()).status,'SUBMITTED');
    assert.equal(await db.supplierPaymentPlanEvent.count({where:{planId:plan.id}}),0);
    assert.equal((await send()).status,200);assert.equal((await current()).status,'APPROVED');
    assert.equal((await send()).status,409);
    await db.supplierPaymentPlan.update({where:{id:plan.id},data:{status:'SUBMITTED'}});
    state.fail=true;const reads=state.reads;assert.equal((await send('RETURN')).status,200);assert.equal(state.reads,reads);
  } finally {await db.supplierPaymentPlan.delete({where:{id:plan.id}});await db.user.deleteMany({where:{id:{in:[buyer.id,admin.id]}}});await db.$disconnect();delete g.approvalSafety;}
});
