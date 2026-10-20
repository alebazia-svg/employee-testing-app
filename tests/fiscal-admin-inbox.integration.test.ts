import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {prisma} from '../lib/prisma';
import webpush from 'web-push';

test('fiscal ADMIN gate -> inbox and push -> read -> reminder -> late receipt -> history, without Telegram', {skip:process.env.FISCAL_INBOX_INTEGRATION!=='1'}, async()=>{
 assert.equal(process.env.DATABASE_URL,'postgresql://preview:local-team-preview@127.0.0.1:55453/fiscal_release_1101_20261020');
 const prefix=`fiscal-inbox-${Date.now()}`;
 const admin=await prisma.user.create({data:{login:prefix,name:'Проверка чека',passwordHash:'unused',role:'ADMIN'}});
 const originalSend=webpush.sendNotification;
 const sent:any[]=[];
 webpush.sendNotification=async(sub,payload)=>{sent.push({endpoint:sub.endpoint,...JSON.parse(String(payload))});return {statusCode:201,body:'',headers:{}};};
 let now=new Date('2026-10-20T09:52:00Z');
 const mocks:Record<string,any>={
  'server-only':{},'./prisma':{prisma},'@/lib/prisma':{prisma},
  './admin-inbox-source-health':{expenseSyncLastSuccess:async()=>now,sourceCheckIsStale:()=>false},
  './admin-inbox-deadline-source':{loadDecisionCashiers:async()=>[],expenseCashboxRef:()=>''},
  './push-attempt-observation':{observePushAttempt:async(_s:any,fn:any)=>fn()},
 };
 let reviewId='';
 try {
  const out=await build({stdin:{contents:"export {stageFiscalAdminReview} from './lib/terminal-fiscal-admin-gate'; export {loadAdminInbox} from './lib/admin-inbox-data'; export {dispatchAdminAttentionPush} from './lib/admin-inbox-attention-push';",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,platform:'node',format:'cjs',packages:'external',plugins:[{name:'isolated',setup(b){b.onResolve({filter:/.*/},a=>a.path in mocks?{path:a.path,external:true}:undefined);}}]});
  const mod={exports:{} as any};const require=createRequire(import.meta.url);
  new Function('require','module','exports',out.outputFiles[0].text)((n:string)=>mocks[n]??require(n),mod,mod.exports);
  const api=mod.exports;
  const record:any={matchingKey:prefix,evaluatedAt:now.toISOString(),evidence:{bankTransactionDate:'2026-10-20T09:29:29Z'},status:'pending',reasonCode:'ONE_C_CANDIDATE_PENDING',amountKopecks:680000,candidateCount:0,sourceCompleteness:{tbank:true,oneC:true,ofd:true}};
  await api.stageFiscalAdminReview(prisma,record);
  const review=await prisma.terminalFiscalEmployeeReview.findFirstOrThrow({where:{amountKopecks:680000,detectedAt:now}});reviewId=review.id;
  const event=await prisma.adminInboxEvent.findFirstOrThrow({where:{sourceType:'terminal_fiscal_review',sourceId:review.id}});
  // Existing ADMINs may receive receipts too; this fixture only gives devices to this ADMIN.
  for(const device of ['phone','desktop'])await prisma.workdayPushSubscription.create({data:{userId:admin.id,endpoint:`https://test.invalid/${prefix}/${device}`,p256dh:'unused',auth:'unused',createdAt:new Date('2026-10-01')}});
  const inbox=(view='attention')=>api.loadAdminInbox({userId:admin.id,limit:200,view,now});
  assert.equal((await inbox()).attention.filter((i:any)=>i.event.sourceId===review.id).length,1);
  assert.equal((await inbox('system')).items.some((i:any)=>i.event.sourceId===review.id),false);
  assert.equal((await api.dispatchAdminAttentionPush(now)).sent,2);
  assert.ok(sent.every(p=>p.title.replace(/\s/g,' ').includes('6 800 ₽')&&p.url.endsWith(review.id)));
  await prisma.adminInboxReceipt.updateMany({where:{eventId:event.id,userId:admin.id},data:{readAt:now}});
  assert.equal((await inbox()).attention.filter((i:any)=>i.event.sourceId===review.id).length,1,'read is not resolved');
  now=new Date(+now+15*60000);
  assert.equal((await api.dispatchAdminAttentionPush(now)).sent,2,'same reminder policy as other owner tasks');
  await prisma.terminalFiscalEmployeeReview.update({where:{id:review.id},data:{status:'open'}});
  assert.equal((await inbox()).attention.filter((i:any)=>i.event.sourceId===review.id).length,1,'forwarded review stays until resolved');
  now=new Date(+now+60000);
  await api.stageFiscalAdminReview(prisma,{...record,status:'confirmed',reasonCode:'MATCH_CONFIRMED_LATE',evaluatedAt:now.toISOString()});
  assert.equal((await inbox()).attention.some((i:any)=>i.event.sourceId===review.id),false);
  assert.equal((await inbox('history')).items.find((i:any)=>i.event.sourceId===review.id)?.sourceState.active,false);
  now=new Date(+now+60*60000);
  assert.equal((await api.dispatchAdminAttentionPush(now)).sent,0);
  assert.equal(await prisma.adminInboxDelivery.count({where:{eventId:event.id,channel:'telegram'}}),0);
 } finally {
  webpush.sendNotification=originalSend;
  await prisma.adminInboxEvent.deleteMany({where:{OR:[{sourceId:reviewId||prefix},{eventKey:`admin:attention-digest:v1:${admin.id}`}]}});
  if(reviewId)await prisma.terminalFiscalEmployeeReview.delete({where:{id:reviewId}});
  await prisma.workdayPushSubscription.deleteMany({where:{userId:admin.id}});
  await prisma.user.delete({where:{id:admin.id}});
  await prisma.$disconnect();
 }
});
