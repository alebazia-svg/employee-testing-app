import test from 'node:test';
import assert from 'node:assert/strict';
import {PrismaClient} from '@prisma/client';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {paymentPreparationDate} from '../lib/procurement-schedule';

test('schedule route persists atomically, preserves finances, and notifies without approval',async()=>{
 assert.equal(process.env.DATABASE_URL,'postgresql://postgres:local-test-only@127.0.0.1:55451/funding_schedule_test');
 const db=new PrismaClient(),g=globalThis as any;
 g.scheduleDb={supplierPaymentPlan:db.supplierPaymentPlan,$transaction:(callback:any)=>db.$transaction(tx=>callback(new Proxy(tx,{get(target,prop){if(prop==='adminInboxEvent'&&g.scheduleNotificationFail)return {upsert:async()=>{throw Error('Synthetic notification failure');}};return Reflect.get(target,prop);}})))};g.scheduleUser=null;g.scheduleEvidenceState='PARTIALLY_ISSUED';g.scheduleFail=false;g.scheduleCollection=false;g.scheduleRace=false;g.scheduleNotificationFail=false;
 const key='schedule-'+Date.now();
 const buyer=await db.user.create({data:{name:key,login:key,passwordHash:'no-login',role:'EMPLOYEE',portalArea:'PROCUREMENT'}});
 const admin=await db.user.create({data:{name:key+'admin',login:key+'admin',passwordHash:'no-login',role:'ADMIN'}});
 const other=await db.user.create({data:{name:key+'other',login:key+'other',passwordHash:'no-login',role:'EMPLOYEE',portalArea:'PROCUREMENT'}});
 const metadata={manualRubleLinks:[{paymentRef:'expense-1',amount:300}],paymentMatchFrom:'2026-10-01T00:00:00Z',lastCompletePaymentView:{marker:'preserve'}};
 const p=await db.supplierPaymentPlan.create({data:{planCode:key,managerUserId:buyer.id,approvedById:admin.id,approvedAt:new Date('2026-10-20'),supplierPartner:'Synthetic supplier',supplierCounterparty:'contract-party',orderRefs:['order-a'],orderNumbers:['test-1'],plannedDate:new Date('2026-10-22'),plannedAmount:1000,paymentMethod:'USDT',currency:'USDT',foreignAmount:10,exchangeRate:100,condition:'Original comment',status:'APPROVED',oneCCashEvidence:metadata}});
 try{
  g.scheduleEvidence=async()=>{
   if(g.scheduleFail)throw Error('Источник временно недоступен.');
   const row=await db.supplierPaymentPlan.findUniqueOrThrow({where:{id:p.id}});
   const result=Object.assign(new Map([[p.id,{state:g.scheduleEvidenceState,issuedAmount:300,paidAmount:0,paidForeignAmount:0,paymentAmountNeedsConfirmation:false,...(g.scheduleCollection?{collection:{marker:true}}:{})}]]),{versions:new Map([[p.id,row.updatedAt.toISOString()]])});
   if(g.scheduleRace){g.scheduleRace=false;await db.supplierPaymentPlan.update({where:{id:p.id},data:{condition:'Concurrent update'}});}
   return result;
  };
  const mocks:Record<string,string>={
   auth:'export const getCurrentUser=async()=>globalThis.scheduleUser;',
   prisma:'export const prisma=globalThis.scheduleDb;',
   'expense-request-source':'export const expenseRequestMoscowCalendarDate=()=>"2026-10-22";',
   'procurement-plan-revision-server':'export const freshEvidence=()=>globalThis.scheduleEvidence();',
  };
  const out=await build({entryPoints:['app/api/procurement/payment-plans/[id]/schedule/route.ts'],bundle:true,write:false,format:'cjs',platform:'node',packages:'external',conditions:['react-server'],plugins:[{name:'isolated-boundaries',setup(b){b.onResolve({filter:/^(?:@\/lib\/|\.\/)/},a=>{const k=a.path.replace(/^@\/lib\/|^\.\//,'');return mocks[k]?{path:k,namespace:'mock'}:null;});b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path],loader:'js'}));}}]});
  const module={exports:{} as any};new Function('require','module','exports',out.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);
  const current=()=>db.supplierPaymentPlan.findUniqueOrThrow({where:{id:p.id}});
  const send=async(body:any)=>module.exports.PATCH(new Request('http://localhost/test',{method:'PATCH',body:JSON.stringify(body)}),{params:Promise.resolve({id:p.id})});
  const command=async(action:string,extra:any={})=>send({action,version:(await current()).updatedAt.toISOString(),...extra});
  assert.equal((await command('RESCHEDULE',{date:'2026-10-23'})).status,401);
  g.scheduleUser={...buyer,isActive:false};assert.equal((await command('RESCHEDULE',{date:'2026-10-23'})).status,403);
  g.scheduleUser=other;assert.equal((await command('RESCHEDULE',{date:'2026-10-23'})).status,409);
  g.scheduleUser=buyer;
  assert.equal((await command('DEFER',{})).status,409);
  assert.equal((await command('RESCHEDULE',{date:'2026-10-23',plannedAmount:5000})).status,409);
  const initialVersion=p.updatedAt.toISOString();
  g.scheduleNotificationFail=true;
  assert.equal((await command('RESCHEDULE',{date:'2026-10-23'})).status,409);
  assert.equal((await current()).updatedAt.toISOString(),initialVersion);
  assert.equal(await db.supplierPaymentPlanEvent.count({where:{planId:p.id}}),0);
  g.scheduleNotificationFail=false;
  const oldNotice=await db.workdayNotification.create({data:{userId:buyer.id,fingerprint:`procurement-payment:${p.id}:approved:original`,kind:'procurement_payment_approved',title:'Оплата согласована',body:'Старая дата',status:'pending',scheduledAt:new Date(),nextPushAttemptAt:new Date()}});
  const moved=await command('RESCHEDULE',{date:'2026-10-23'});assert.equal(moved.status,200);assert.equal((await moved.json()).revision,null);
  const changed=await current();
  assert.equal((await db.workdayNotification.findUniqueOrThrow({where:{id:oldNotice.id}})).status,'cancelled');
  assert.equal(changed.status,'APPROVED');assert.equal(changed.plannedDate.toISOString().slice(0,10),'2026-10-23');
  for(const field of ['plannedAmount','foreignAmount','exchangeRate','approvedAt','approvedById','supplierPartner','supplierCounterparty','paymentMethod','currency','condition','orderRefs','orderNumbers','oneCCashEvidence'] as const)assert.equal(JSON.stringify(changed[field]),JSON.stringify(p[field]),field);
  const notice=await db.adminInboxEvent.findFirstOrThrow({where:{sourceId:p.id}});
  assert.equal(notice.title,'Дата подготовки денег изменена');assert.match(notice.body,/22 октября → 23 октября/);
  assert.equal(await db.adminInboxReceipt.count({where:{eventId:notice.id,userId:admin.id}}),1);
  assert.equal((await send({action:'RESCHEDULE',date:'2026-10-24',version:initialVersion})).status,409);
  for(const state of ['PAID_BY_ONE_C','ISSUED_BY_ONE_C','MISMATCH','NEEDS_REVIEW','SOURCE_UNAVAILABLE']){g.scheduleEvidenceState=state;assert.equal((await command('RESCHEDULE',{date:'2026-10-24'})).status,409);}
  g.scheduleEvidenceState='PARTIALLY_ISSUED';g.scheduleCollection=true;assert.equal((await command('RESCHEDULE',{date:'2026-10-24'})).status,409);g.scheduleCollection=false;
  g.scheduleFail=true;assert.equal((await command('RESCHEDULE',{date:'2026-10-24'})).status,409);g.scheduleFail=false;
  g.scheduleRace=true;assert.equal((await command('RESCHEDULE',{date:'2026-10-24'})).status,409);assert.equal((await current()).plannedDate.toISOString().slice(0,10),'2026-10-23');
  g.scheduleUser=admin;
  assert.equal((await command('DEFER',{date:'',comment:'Дата уточняется'})).status,200);
  const deferred=await current(),raw=deferred.oneCCashEvidence as any;
  assert.equal(raw.fundingDeferral.date,null);assert.deepEqual(raw.manualRubleLinks,metadata.manualRubleLinks);assert.equal(raw.paymentMatchFrom,metadata.paymentMatchFrom);assert.equal(deferred.status,'APPROVED');
  const n=await db.workdayNotification.findFirstOrThrow({where:{userId:buyer.id,status:'pending'}});assert.equal(n.title,'Оплата отложена');
  assert.equal((await command('DEFER',{date:'2026-10-25'})).status,200);
  g.scheduleUser=buyer;
  assert.equal((await command('RESCHEDULE',{date:'2026-10-27'})).status,200);
  const later=await current();
  assert.equal(paymentPreparationDate({...later,plannedDate:later.plannedDate.toISOString()}),'2026-10-27');
  assert.equal((later.oneCCashEvidence as any).fundingDeferral.date,'2026-10-25');
  assert.equal(later.status,'APPROVED');assert.equal(later.plannedAmount.toString(),'1000');
  assert.equal((await command('RESCHEDULE',{date:'2026-10-24'})).status,200);
  const earlier=await current();
  assert.equal(paymentPreparationDate({...earlier,plannedDate:earlier.plannedDate.toISOString()}),'2026-10-25');
  assert.equal((await command('RESUME',{date:'2026-10-28'})).status,409);
  g.scheduleUser=admin;
  assert.equal((await command('RESUME')).status,409);
  assert.equal((await command('RESUME',{date:'2026-10-20'})).status,409);
  assert.equal(((await current()).oneCCashEvidence as any).fundingDeferral.date,'2026-10-25');
  assert.equal((await command('RESUME',{date:'2026-10-28'})).status,200);assert.equal((await current()).plannedDate.toISOString().slice(0,10),'2026-10-28');assert.equal(((await current()).oneCCashEvidence as any).fundingDeferral,null);
  const resumed=await current();
  assert.deepEqual((resumed.oneCCashEvidence as any).manualRubleLinks,metadata.manualRubleLinks);
  const resumeNotice=await db.workdayNotification.findFirstOrThrow({where:{userId:buyer.id,status:'pending',title:'Отсрочка оплаты отменена'}});
  assert.match(resumeNotice.body,/28 октября/);
  const resumeEvent=await db.supplierPaymentPlanEvent.findFirstOrThrow({where:{planId:p.id},orderBy:{createdAt:'desc'}});
  assert.ok((resumeEvent.snapshot as any).revision.changes.some((c:any)=>c.key==='plannedDate'&&c.before==='2026-10-24'&&c.after==='2026-10-28'));
  await db.supplierPaymentPlan.update({where:{id:p.id},data:{oneCCashEvidence:{...metadata,pendingRevision:{id:'proposal',data:{},changes:[]}}}});
  assert.equal((await command('DEFER')).status,409);
  await db.supplierPaymentPlan.update({where:{id:p.id},data:{oneCCashEvidence:metadata,status:'CANCELLED'}});
  assert.equal((await command('RESUME')).status,409);
  assert.equal(await db.supplierPaymentPlanEvent.count({where:{planId:p.id}}),6);
  // ADMIN may prepare funding before approval, without manufacturing approval or releasing identity guards.
  await db.supplierPaymentPlan.update({where:{id:p.id},data:{status:'SUBMITTED',approvedAt:null,approvedById:null,oneCCashEvidence:metadata}});
  g.scheduleEvidenceState='NO_EVIDENCE';g.scheduleUser=buyer;
  assert.equal((await command('DEFER')).status,409);
  assert.equal((await command('RESUME',{date:'2026-10-29'})).status,409);
  g.scheduleUser=admin;
  const pendingBefore=await current();
  assert.equal((await command('DEFER',{date:'',comment:''})).status,200);
  const pendingDeferred=await current();
  for(const field of ['status','approvedAt','approvedById','plannedDate','plannedAmount','foreignAmount','supplierPartner','supplierCounterparty','orderRefs','orderNumbers'] as const)assert.equal(JSON.stringify(pendingDeferred[field]),JSON.stringify(pendingBefore[field]),field);
  assert.equal(paymentPreparationDate({...pendingDeferred,plannedDate:pendingDeferred.plannedDate.toISOString()}),null);
  const pendingNotice=await db.workdayNotification.findFirstOrThrow({where:{userId:buyer.id,status:'pending',kind:'procurement_payment_updated'}});
  assert.equal(pendingNotice.title,'Оплата отложена');assert.match(pendingNotice.body,/Дата уточняется.*ещё на согласовании/);
  assert.equal((await send({action:'DEFER',date:'2026-10-29',version:pendingBefore.updatedAt.toISOString()})).status,409);
  g.scheduleEvidenceState='SOURCE_UNAVAILABLE';assert.equal((await command('DEFER',{date:'2026-10-29'})).status,409);g.scheduleEvidenceState='NO_EVIDENCE';
  assert.equal((await command('DEFER',{date:'2026-10-29'})).status,200);
  assert.equal((await current()).status,'SUBMITTED');
  const datedNotice=await db.workdayNotification.findFirstOrThrow({where:{userId:buyer.id,status:'pending',kind:'procurement_payment_updated'}});
  assert.equal(datedNotice.title,'Деньги будут готовы');assert.match(datedNotice.body,/29 октября.*ещё на согласовании/);
  assert.equal((await db.workdayNotification.findUniqueOrThrow({where:{id:pendingNotice.id}})).status,'cancelled');
  assert.equal((await command('RESUME',{date:'2026-10-30'})).status,200);
  assert.equal((await current()).status,'SUBMITTED');assert.equal(((await current()).oneCCashEvidence as any).fundingDeferral,null);
  assert.equal((await current()).approvedAt,null);
  // Real inbox records in a private database; no dispatcher/provider is imported.
 }finally{
  await db.adminInboxEvent.deleteMany({where:{sourceId:p.id}});
  await db.workdayNotification.deleteMany({where:{userId:buyer.id}});
  await db.supplierPaymentPlan.delete({where:{id:p.id}});
  await db.user.deleteMany({where:{id:{in:[buyer.id,admin.id,other.id]}}});await db.$disconnect();
 }
});
