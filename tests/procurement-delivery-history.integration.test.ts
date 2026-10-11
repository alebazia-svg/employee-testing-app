import test from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { DELIVERY_PERSON, DELIVERY_SOURCE, DELIVERY_OPEN } from '../lib/procurement-delivery-policy';
import { deliveryLinkKey } from '../lib/procurement-delivery-native';
import { deliveryDetailsKey } from '../lib/procurement-delivery-request';

test('PostgreSQL history retains request cycles, pages in stable order and preserves unavailable native status', {skip:!process.env.PROCUREMENT_TEST_DATABASE_URL}, async()=>{
  assert.equal(process.env.PROCUREMENT_TEST_DATABASE_URL,'postgresql://attention:local-attention-only@127.0.0.1:55448/attention_integration');
  const db=new PrismaClient({datasources:{db:{url:process.env.PROCUREMENT_TEST_DATABASE_URL}}});
  assert.equal(await db.adminInboxEvent.count({where:{sourceType:DELIVERY_SOURCE}}),0,'isolated database only');
  const marker=`history-test-${Date.now()}`, ids:string[]=[];
  const calls:Array<{id:string,amount:number,before?:string}>=[];
  (globalThis as any).deliveryHistoryTest={db,read:async(id:string,details:any,before?:string)=>{calls.push({id,amount:details.amount,before});return {state:id===`${marker}-7`?'unavailable':'unlinked'};}};
  try {
    for(let i=0;i<21;i++) {
      const id=`${marker}-${i}`, time=new Date(Date.now()-i*1000);ids.push(id);
      await db.adminInboxEvent.create({data:{id,eventKey:id,sourceType:DELIVERY_SOURCE,sourceId:DELIVERY_PERSON.ref,type:DELIVERY_OPEN,title:'TEST',body:'',href:'/admin/expense-requests',occurredAt:time,createdAt:time}});
      await db.adminInboxEvent.create({data:{eventKey:deliveryDetailsKey(id),sourceType:marker,sourceId:id,type:'test',title:'TEST details',body:JSON.stringify({version:1,amount:100+i,comment:`cycle ${i}`,balance:0,requestedAt:time.toISOString(),checkedAt:time.toISOString()}),href:'/admin/expense-requests',occurredAt:time}});
    }
    const exactRef='33333333-3333-4333-a333-333333333333';
    await db.adminInboxEvent.create({data:{eventKey:deliveryLinkKey(ids[7]),sourceType:marker,sourceId:ids[7],type:'test',title:'TEST link',body:JSON.stringify({version:1,ref:exactRef,date:new Date().toISOString(),amount:107,userId:1,linkedAt:new Date().toISOString()}),href:'/admin/expense-requests',occurredAt:new Date()}});
    const output=await build({entryPoints:['lib/procurement-delivery-reminders.ts'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',plugins:[{name:'history-source',setup(b){
      const mock:Record<string,string>={prisma:'export const prisma=globalThis.deliveryHistoryTest.db;', 'procurement-delivery-native-source':'export const loadDeliveryNative=globalThis.deliveryHistoryTest.read;'};
      b.onResolve({filter:/^\.\/(prisma|procurement-delivery-native-source)$/},a=>({path:a.path.slice(2),namespace:'test'}));
      b.onLoad({filter:/.*/,namespace:'test'},a=>({contents:mock[a.path]}));
    }}]});
    const mod={exports:{} as any};new Function('require','module','exports',output.outputFiles[0].text)(createRequire(import.meta.url),mod,mod.exports);
    const count=await db.adminInboxEvent.count();
    const first=await mod.exports.loadDeliveryHistory();assert.deepEqual(first.rows.map((r:any)=>r.id),ids.slice(0,20));assert.equal(first.nextCursor,ids[19]);
    assert.equal(first.rows[7].native.state,'unavailable'); assert.equal(first.rows[7].nativeRef,exactRef,'stored identity survives outage without inventing paid status'); assert.equal(first.rows[7].details.comment,'cycle 7');
    const second=await mod.exports.loadDeliveryHistory(first.nextCursor);assert.deepEqual(second.rows.map((r:any)=>r.id),[ids[20]]);assert.equal(second.nextCursor,null);
    assert.equal(calls.length,21);assert.equal(calls[0].before,undefined);assert.equal(calls.find(c=>c.id===ids[20])?.before,first.rows[19].requestedAt,'page boundary retains the next-cycle timestamp');for(let i=0;i<21;i++)assert.ok(calls.some(c=>c.id===ids[i]&&c.amount===100+i),'native proof remains bound to its request cycle');
    assert.equal(await db.adminInboxEvent.count(),count,'history GET never archives, rewrites or deletes events');
  } finally {await db.adminInboxEvent.deleteMany({where:{OR:[{id:{in:ids}},{sourceType:marker}]}});await db.$disconnect();delete (globalThis as any).deliveryHistoryTest;}
});
