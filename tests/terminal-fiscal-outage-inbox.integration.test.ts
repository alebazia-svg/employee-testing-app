import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {prisma} from '../lib/prisma';
import webpush from 'web-push';

test('outage legacy cases stay out of attention and push; actual employee help and real missing checks remain', {skip:process.env.FISCAL_OUTAGE_INTEGRATION!=='1'}, async()=>{
 assert.equal(process.env.DATABASE_URL,'postgresql://preview:handover-local-only@127.0.0.1:55471/receipt_outage_test');
 const prefix=`outage-inbox-${Date.now()}`,now=new Date('2026-10-26T15:00:00Z');
 const admin=await prisma.user.create({data:{login:prefix,name:'Local ADMIN',passwordHash:'unused',role:'ADMIN'}});
 const originalSend=webpush.sendNotification,sent:any[]=[],ids:string[]=[];
 webpush.sendNotification=async(sub,payload)=>{sent.push(JSON.parse(String(payload)));return {statusCode:201,body:'',headers:{}};};
 const mocks:Record<string,any>={
  'server-only':{},'./prisma':{prisma},'@/lib/prisma':{prisma},
  './admin-inbox-source-health':{expenseSyncLastSuccess:async()=>now,sourceCheckIsStale:()=>false},
  './admin-inbox-deadline-source':{loadDecisionCashiers:async()=>[],expenseCashboxRef:()=>''},
  './push-attempt-observation':{observePushAttempt:async(_s:any,fn:any)=>fn()},
 };
 try{
  for(const [kind,reasonCode,type] of [['technical','SOURCE_OFD_INCOMPLETE','terminal_fiscal_review.created'],['help','SOURCE_OFD_INCOMPLETE','terminal_fiscal_review.employee_action'],['missing','ONE_C_CANDIDATE_NOT_FOUND','terminal_fiscal_review.created']]){
   const review=await prisma.terminalFiscalEmployeeReview.create({data:{reviewKey:prefix+kind,matchingHash:prefix+kind,employeeId:admin.id,status:'admin_review',assignmentScope:'admin_gate',reasonCode,amountKopecks:50000,bankOperationAt:now,cashierRefHash:prefix+kind}});ids.push(review.id);
   const event=await prisma.adminInboxEvent.create({data:{eventKey:prefix+kind,type,title:kind,body:kind,href:'/admin/workday/payment-checks/'+review.id,sourceType:'terminal_fiscal_review',sourceId:review.id,occurredAt:now}});
   await prisma.adminInboxReceipt.create({data:{userId:admin.id,eventId:event.id}});
  }
  await prisma.workdayPushSubscription.create({data:{userId:admin.id,endpoint:'https://test.invalid/'+prefix,p256dh:'unused',auth:'unused',createdAt:new Date('2026-10-01')}});
  const out=await build({stdin:{contents:"export {loadAdminInbox} from './lib/admin-inbox-data'; export {dispatchAdminAttentionPush} from './lib/admin-inbox-attention-push';",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,platform:'node',format:'cjs',packages:'external',plugins:[{name:'isolated',setup(b){b.onResolve({filter:/.*/},a=>a.path in mocks?{path:a.path,external:true}:undefined);}}]});
  const mod={exports:{} as any},require=createRequire(import.meta.url);
  new Function('require','module','exports',out.outputFiles[0].text)((n:string)=>mocks[n]??require(n),mod,mod.exports);
  const api=mod.exports;
  const inbox=await api.loadAdminInbox({userId:admin.id,limit:200,view:'attention',now});
  assert.deepEqual(inbox.attention.filter((i:any)=>ids.includes(i.event.sourceId)).map((i:any)=>i.event.sourceId).sort(),[ids[1],ids[2]].sort());
  const history=await api.loadAdminInbox({userId:admin.id,limit:200,view:'history',now});
  assert.equal(history.items.find((i:any)=>i.event.sourceId===ids[0])?.sourceState.active,false);
  await api.dispatchAdminAttentionPush(now);
  assert.equal(sent.length,1);
  assert.doesNotMatch(JSON.stringify(sent),/technical/);
  for(const id of ids.slice(1))await prisma.terminalFiscalEmployeeReview.update({where:{id},data:{status:'resolved'}});
  const recovered=await api.loadAdminInbox({userId:admin.id,limit:200,view:'attention',now:new Date(+now+3600000)});
  assert.equal(recovered.attention.some((i:any)=>ids.includes(i.event.sourceId)),false);
  assert.equal((await api.dispatchAdminAttentionPush(new Date(+now+3600000))).sent,0);
 }finally{
  webpush.sendNotification=originalSend;
  await prisma.adminInboxEvent.deleteMany({where:{OR:[{sourceId:{in:ids}},{eventKey:`admin:attention-digest:v1:${admin.id}`}]}});
  await prisma.terminalFiscalEmployeeReview.deleteMany({where:{id:{in:ids}}});
  await prisma.workdayPushSubscription.deleteMany({where:{userId:admin.id}});
  await prisma.user.delete({where:{id:admin.id}});
  await prisma.$disconnect();
 }
});
