import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { PrismaClient } from '@prisma/client';
import { createSessionToken } from '../lib/session';
import { getMoscowDateKey, buildDateRange } from '../lib/workday';
import { WORK_HELP_VERSION, WORK_HELP_ACK_KIND } from '../lib/employee-work-help';

const url = process.env.PUSH_ACCESS_TEST_DB ?? '';
test('isolated DB: guide acknowledgement is durable, owned, idempotent, separate from schedule and pushes', {skip:!/^postgresql:\/\/postgres:push-sync-local-only@127\.0\.0\.1:\d+\/push_sync_test$/.test(url)}, async()=>{
 const db=new PrismaClient({datasources:{db:{url}}}); const marker=`work-help-${randomUUID()}`;
 const oldSecret=process.env.PORTAL_SESSION_SECRET;process.env.PORTAL_SESSION_SECRET='isolated-work-help-secret-at-least-32-characters';
 const ids:number[]=[];
 const make=async(suffix:string)=>{const user=await db.user.create({data:{name:`${marker}-${suffix}`,login:`${marker}-${suffix}`,passwordHash:'not-a-login',role:'EMPLOYEE',department:'procurement',portalArea:'PROCUREMENT'}});ids.push(user.id);return user;};
 try {
  const a=await make('a'),b=await make('b');let actor:typeof a|null=a;let token=createSessionToken(a.id);let failAck=false;
  const prisma=new Proxy(db,{get(target,key){if(key!=='portalActivityEvent')return Reflect.get(target,key);return new Proxy(target.portalActivityEvent,{get(delegate,method){if(method==='upsert'&&failAck)return async()=>{throw Error('forced storage failure');};return Reflect.get(delegate,method);}});}});
  const mocks:Record<string,unknown>={'server-only':{},'@/lib/auth':{getCurrentUser:async()=>actor},'@/lib/prisma':{prisma},'./prisma':{prisma},'next/headers':{cookies:async()=>({get:()=>({value:token})})}};
  const compiled=await build({entryPoints:['app/api/employee/work-help/route.ts'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',plugins:[{name:'mock',setup(bundler){bundler.onResolve({filter:/.*/},args=>args.path in mocks?{path:args.path,external:true}:undefined);}}]});
  const module={exports:{} as any},require=createRequire(import.meta.url);
  new Function('require','module','exports',compiled.outputFiles[0].text)((name:string)=>mocks[name]??require(name),module,module.exports);
  const route=module.exports;
  const post=(body:unknown={version:WORK_HELP_VERSION},origin='https://portal.invalid')=>route.POST(new Request('https://portal.invalid/api/employee/work-help',{method:'POST',headers:{'content-type':'application/json',origin},body:JSON.stringify(body)}));
  const initial=await(await route.GET()).json();assert.equal(initial.due,true);assert.equal(initial.missingDates.length,2);
  const pushesBefore=await db.workdayNotification.count();
  const first=await post();assert.equal(first.status,200);const receipt=await first.json();assert.equal(receipt.recorded,true);assert.equal(receipt.due,false);assert.ok(receipt.acknowledgedAt);
  assert.deepEqual((await(await route.GET()).json()).missingDates,initial.missingDates,'acknowledgement does not fill the schedule');
  const repeat=await(await post()).json();assert.equal(repeat.acknowledgedAt,receipt.acknowledgedAt);assert.equal(await db.portalActivityEvent.count({where:{userId:a.id,kind:WORK_HELP_ACK_KIND}}),1);
  assert.equal((await post({version:WORK_HELP_VERSION,userId:b.id})).status,400);
  assert.equal((await post({version:'forged'})).status,400);
  assert.equal((await post(undefined,'https://cross-site.invalid')).status,403);
  actor=b;token=createSessionToken(b.id);assert.equal((await(await route.GET()).json()).due,true,'another user has independent confirmation');
  failAck=true;const failed=await post();assert.equal(failed.status,503);assert.notEqual((await failed.json()).recorded,true);assert.equal((await(await route.GET()).json()).due,true);failAck=false;
  const dates=buildDateRange(getMoscowDateKey(),2);
  await db.workScheduleEntry.createMany({data:dates.map(date=>({userId:b.id,department:'procurement',date,status:'off'}))});
  assert.deepEqual((await(await route.GET()).json()).missingDates,[]);assert.equal((await(await route.GET()).json()).due,false,'ordinary schedule writes end guidance without a click');
  assert.equal(await db.workdayNotification.count(),pushesBefore,'the guide queues no push or notification');
  actor={...a,role:'ADMIN'};assert.equal((await route.GET()).status,403);assert.equal((await post()).status,403);
  actor={...a,isActive:false};assert.equal((await route.GET()).status,403);actor=null;assert.equal((await route.GET()).status,403);
 } finally {for(const id of ids)await db.user.delete({where:{id}});await db.$disconnect();if(oldSecret===undefined)delete process.env.PORTAL_SESSION_SECRET;else process.env.PORTAL_SESSION_SECRET=oldSecret;}
});
