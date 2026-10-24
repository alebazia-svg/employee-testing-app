import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFile} from 'node:fs/promises';

test('receipt push passes 200 delivered entries, sends the next once, and observes quiet hours',async()=>{
  const now=new Date('2026-10-11T09:00:00Z');
  const sent:string[]=[];
  const deliveries=new Map<string,any>();
  const rows=Array.from({length:202},(_,i)=>({id:`r${i}`,userId:1,readAt:null,eventId:`e${i}`,
    event:{id:`e${i}`,sourceId:`f${i}`,type:'procurement.receipt_added',createdAt:now,title:'Чек',body:'Добавлен',href:'/procurement'},
    user:{pushSubscriptions:[{id:1,createdAt:new Date('2026-10-01'),endpoint:'https://invalid.test/push',p256dh:'test',auth:'test'}]}}));
  rows.slice(0,200).forEach(row=>deliveries.set(row.eventId,{id:row.eventId,status:'sent',attemptCount:1}));
  const pages:string[]=[];
  const db={supplierPaymentReceipt:{findUnique:async({where}:any)=>({id:where.id,purpose:where.id==='f201'?'QR':'RECEIPT',replacedById:null})},adminInboxEvent:{findFirst:async()=>null},adminInboxReceipt:{findMany:async(args:any)=>{
    assert.deepEqual(args.orderBy,[{createdAt:'asc'},{id:'asc'}]);
    pages.push(args.cursor?.id||'start');
    const start=args.cursor?rows.findIndex(row=>row.id===args.cursor.id)+args.skip:0;
    return rows.slice(start,start+args.take);
  }},adminInboxDelivery:{
    upsert:async({create}:any)=>{if(!deliveries.has(create.eventId))deliveries.set(create.eventId,{id:create.eventId,status:'pending',attemptCount:0});return {...deliveries.get(create.eventId)};},
    updateMany:async({where}:any)=>{const d=deliveries.get(where.id);if(!['pending','failed'].includes(d.status))return {count:0};d.status='sending';d.attemptCount++;return {count:1};},
    update:async({where,data}:any)=>Object.assign(deliveries.get(where.id),data),
  }};
  const g=globalThis as any;g.receiptDispatchDb=db;g.receiptDispatchSent=sent;
  const mocks:Record<string,string>={
    'server-only':'',
    './admin-inbox-attention-push':'export const dispatchAdminAttentionPush=async()=>({receipts:0,sent:0,failed:0});',
    './push-attempt-observation':'export const observePushAttempt=async(_subscription,send)=>send();',
    '@/lib/prisma':'export const prisma=globalThis.receiptDispatchDb;',
    '@/lib/admin-inbox-data':'export const loadAdminInbox=async()=>({unreadCount:1});',
    'web-push':'export default {setVapidDetails(){},async sendNotification(s,p){globalThis.receiptDispatchSent.push(JSON.parse(p).notificationId)}};',
  };
  const bundle=await build({entryPoints:['lib/admin-inbox-web-push.ts'],bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'isolated-push',setup(b){
    b.onResolve({filter:/.*/},a=>Object.hasOwn(mocks,a.path)?{path:a.path,namespace:'mock'}:null);
    b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path],loader:'js'}));
  }}]});
  const keys=['WEB_PUSH_VAPID_PUBLIC_KEY','WEB_PUSH_VAPID_PRIVATE_KEY'] as const;
  const before=keys.map(key=>process.env[key]);
  keys.forEach(key=>process.env[key]='test-only');
  try{
    const api=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
    assert.deepEqual(await api.dispatchAdminInboxWebPush(now),{receipts:202,sent:1,failed:0});
    assert.equal(deliveries.get('e201').status,'cancelled');
    assert.deepEqual(pages,['start','r99','r199']);assert.deepEqual(sent,['e200']);
    assert.equal((await api.dispatchAdminInboxWebPush(now)).sent,0);
    await api.dispatchAdminInboxWebPush(new Date('2026-10-11T23:00:00Z'));
    assert.equal(sent.length,1);
  }finally{keys.forEach((key,i)=>{if(before[i]===undefined)delete process.env[key];else process.env[key]=before[i];});delete g.receiptDispatchDb;delete g.receiptDispatchSent;}
});

test('production builds receipts into the client and retains the persistent uploads mount',async()=>{
  const docker=await readFile('Dockerfile','utf8');const compose=await readFile('docker-compose.portal.yml','utf8');
  assert.ok(docker.indexOf('ARG NEXT_PUBLIC_PROCUREMENT_RECEIPTS_ENABLED=0')<docker.indexOf('RUN npm run build'));
  assert.ok(docker.includes('ENV NEXT_PUBLIC_PROCUREMENT_RECEIPTS_ENABLED=$NEXT_PUBLIC_PROCUREMENT_RECEIPTS_ENABLED'));
  assert.match(compose,/args:\s+NEXT_PUBLIC_PROCUREMENT_RECEIPTS_ENABLED: "1"/);
  assert.ok(compose.includes('portal-uploads:/app/uploads'));
});
