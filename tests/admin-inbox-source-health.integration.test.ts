import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import webpush from 'web-push';
import { prisma } from '../lib/prisma';
import { sourceCheckIsStale } from '../lib/admin-inbox-source-health';

test('long outages coalesce; recovery and expense-sync freshness retire warnings without recovery pushes', {skip:process.env.ATTENTION_INTEGRATION!=='1'},async()=>{
 assert.ok(process.env.DATABASE_URL?.endsWith('@127.0.0.1:55448/admin_attention_20261012_test'));
 const prefix=`health-${Date.now()}`, start=new Date('2026-10-12T09:00Z');
 let now=start, lastSync:Date|null=start;
 const admin=await prisma.user.create({data:{name:prefix,login:prefix,role:'ADMIN',passwordHash:'unused'}});
 const send=webpush.sendNotification;const sent:any[]=[];
 webpush.sendNotification=async(sub,payload)=>{sent.push(JSON.parse(String(payload)));return{statusCode:201,headers:{},body:''};};
 try{
  const mocks:Record<string,any>={'./prisma':{prisma},'@/lib/prisma':{prisma},'./admin-inbox-source-health':{expenseSyncLastSuccess:async()=>lastSync,sourceCheckIsStale}};
  const built=await build({stdin:{contents:"export {loadAdminInbox} from './lib/admin-inbox-data'; export {dispatchAdminAttentionPush} from './lib/admin-inbox-attention-push';",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,platform:'node',format:'cjs',packages:'external',plugins:[{name:'test',setup(b){b.onResolve({filter:/.*/},a=>a.path in mocks?{path:a.path,external:true}:undefined);}}]});
  const mod={exports:{} as any},require=createRequire(import.meta.url);new Function('require','module','exports',built.outputFiles[0].text)((n:string)=>mocks[n]??require(n),mod,mod.exports);
  const api=mod.exports, inbox=()=>api.loadAdminInbox({userId:admin.id,limit:100,view:'attention',now});
  await prisma.workdayPushSubscription.create({data:{userId:admin.id,endpoint:`https://test.invalid/${prefix}`,p256dh:'test',auth:'test'}});
  const event=(type:string,id:string)=>prisma.adminInboxEvent.create({data:{eventKey:`${prefix}:${id}:${type}`,sourceType:'dependency',sourceId:`${prefix}:${id}`,type,title:'Нет данных',body:'Источник',href:'/admin/inbox',occurredAt:now,receipts:{create:{userId:admin.id}}}});
  await event('dependency.down','one');await event('dependency.down','two');
  now=new Date(+start+59*60000);lastSync=now;assert.equal((await inbox()).attentionCount,0);assert.equal((await api.dispatchAdminAttentionPush(now)).sent,0);
  now=new Date(+start+60*60000);lastSync=now;assert.equal((await inbox()).attentionCount,1,'two outages form one owner item');assert.equal((await api.dispatchAdminAttentionPush(now)).sent,1);
  now=new Date(+start+120*60000);lastSync=now;assert.equal((await api.dispatchAdminAttentionPush(now)).sent,0,'no hourly technical nag');
  await event('dependency.recovered','one');await event('dependency.recovered','two');assert.equal((await inbox()).attentionCount,0);assert.equal((await api.dispatchAdminAttentionPush(now)).sent,0,'no recovery push');
  lastSync=start;let value=await inbox();assert.equal(value.attentionCount,1,'stopped expense importer becomes visible');
  const system=await api.loadAdminInbox({userId:admin.id,limit:100,view:'system',now});assert.ok(system.items.some((i:any)=>i.event.sourceId==='expense-sync'));
  lastSync=now;assert.equal((await inbox()).attentionCount,0,'successful sync removes stale warning');
  assert.equal(sent.length,1);
 }finally{
  webpush.sendNotification=send;
  await prisma.adminInboxEvent.deleteMany({where:{OR:[{eventKey:{startsWith:prefix}},{eventKey:`admin:attention-digest:v1:${admin.id}`}]}});
  await prisma.user.delete({where:{id:admin.id}});await prisma.$disconnect();
 }
});
