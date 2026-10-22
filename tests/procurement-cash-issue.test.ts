import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { cashIssueKey, cashIssuePermission, cashIssueHref, cashIssueCompactCopy, cashIssuePushCopy, CASH_ISSUE_KIND } from '../lib/procurement-cash-issue-policy';
import type { DeliveryNativeStatus } from '../lib/procurement-delivery-native';
import { DELIVERY_PHONE_RESERVE_REF } from '../lib/procurement-delivery-reserve';
const require = createRequire(import.meta.url);
const ref = '11111111-2222-3333-4444-555555555555';
const cashboxRef = '11111111-2222-3333-4444-666666666666';
const now = new Date('2026-10-12T09:00:00Z');
const status = (patch = {}): DeliveryNativeStatus => ({ ref, number: 'УЧЕБНАЯ-01', date: now.toISOString(), amount: 5000, issued: 0, remaining: 5000, state: 'payable', canCollect: true, cashbox: 'Касса Чеченова', cashboxRef, recipientName: 'Тохов Астемир', checkedAt: now.toISOString(), desiredDate: null, ...patch });
async function load(entry: string, mocks: Record<string, any>) {
 const output = await build({ entryPoints: [entry], bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external', plugins: [{ name: 'isolated', setup(b) { b.onResolve({ filter: /.*/ }, a => a.path in mocks ? { path: a.path, external: true } : undefined); } }] });
 const module = { exports: {} as any };
 new Function('require', 'module', 'exports', output.outputFiles[0].text)((name: string) => mocks[name] ?? require(name), module, module.exports);
 return module.exports;
}
test('only fresh payable identity supplies exact remaining amount, never approved or unverified partial', () => {
 assert.equal(cashIssuePermission(status(), now)?.amount, 5000);
 assert.equal(cashIssuePermission(status({ state: 'partial', issued: 2000, remaining: 3000 }), now)?.amount, 3000);
 for (const patch of [{state:'approved',canCollect:false},{state:'waiting',canCollect:false},{state:'rejected',canCollect:false},{state:'issued',remaining:0},{state:'partial',canCollect:false},{recipientName:''},{cashboxRef:undefined},{checkedAt:'2026-10-11T09:00:00Z'}]) assert.equal(cashIssuePermission(status(patch), now), null);
 assert.equal(cashIssueKey(status(),42), cashIssueKey(status({state:'partial',issued:2000,remaining:3000}),42));
 assert.notEqual(cashIssueKey(status(),42), cashIssueKey(status(),43));
 assert.equal(cashIssueHref(cashIssueKey(status(),42)), `/employee/cash-issue?request=${ref}`);
 assert.equal(cashIssueHref('malformed'), '/employee');
});
test('one explicit active WORKDAY mapping chooses cashier; names, absent and duplicate mappings never choose a person', async () => {
 for (const owners of [[],[{userId:42}],[{userId:42},{userId:43}]]) {
  const api=await load('lib/procurement-cash-issue-notifications.ts', {
   './prisma':{prisma:{workDayEntry:{findFirst:async()=>({id:1})},userOneCCashboxMapping:{findMany:async(args:any)=>{assert.equal(args.where.oneCCashboxRef,cashboxRef);assert.equal(args.where.user.role,'EMPLOYEE');assert.equal(args.where.user.portalArea,'WORKDAY');assert.equal(args.where.user.isActive,true);return owners;}}}},
   './procurement-delivery-reminders':{loadDeliveryView:async(options:any)=>{assert.equal(options.freshNative,true);return {requestStateAvailable:true,nativeRequest:{state:'linked',status:status()}};}},
  });
  const current=await api.currentCashIssue(now,true);assert.equal(current.state,owners.length===1?'ready':'unknown');
  if(current.state==='ready'){assert.equal(current.userId,42);assert.match(current.body,/Тохов Астемир/);assert.equal((await api.cashIssuePushDecision({fingerprint:current.fingerprint,userId:43},now)).state,'cancel');}
 }
});
test('outage and incomplete identities defer; completed/rejected requests cancel; night waits until 08:30',async()=>{
 for(const scenario of ['offline','missing-name','issued','rejected','night']){
  const at=scenario==='night'?new Date('2026-10-12T20:00:00Z'):now;
  const s=status({checkedAt:at.toISOString(),...(scenario==='missing-name'?{recipientName:''}:scenario==='issued'?{state:'issued',remaining:0,canCollect:false}:scenario==='rejected'?{state:'rejected',canCollect:false}:{})});
  const api=await load('lib/procurement-cash-issue-notifications.ts',{'./prisma':{prisma:{workDayEntry:{findFirst:async()=>({id:1})},userOneCCashboxMapping:{findMany:async()=>[{userId:42}]}}},'./procurement-delivery-reminders':{loadDeliveryView:async()=>{if(scenario==='offline')throw Error('offline');return {requestStateAvailable:true,nativeRequest:{state:'linked',status:s}};}}});
  const result=await api.cashIssuePushDecision({userId:42,fingerprint:cashIssueKey(s,42)},at);
  assert.equal(result.state,['issued','rejected'].includes(scenario)?'cancel':'defer');
  if(scenario==='night')assert.equal(result.until.toISOString(),'2026-10-13T05:30:00.000Z');
 }
});
test('PWA keeps a read issue task visible and never exposes another cashier’s details or old amount while offline',async()=>{
 for(const mode of ['own','other','offline']){
  const row={id:9,status:'sent',sentAt:now,kind:CASH_ISSUE_KIND,fingerprint:cashIssueKey(status(),42),readAt:now,title:'Neutral',body:'Neutral',task:null,issue:null,review:null,taskId:null,issueId:null,reviewId:null};
  const api=await load('app/api/employee/workday-notifications/route.ts',{
   '@/lib/auth':{getCurrentUser:async()=>({id:42})},
   '@/lib/prisma':{prisma:{workdayNotification:{findMany:async(args:any)=>{assert.equal(args.where.userId,42);assert.deepEqual(args.where.OR[0],{status:'sent',readAt:null});assert.deepEqual(args.where.OR[1].status,{in:['sent','cancelled']});return [row];}}}},
   '@/lib/workday-notifications':{reconcileActiveWorkdayNotifications:async(_:any,rows:any)=>rows,workdayNotificationHref:()=>'/employee/cash-issue',workdayTaskNotificationCopy:()=>null},
   '@/lib/procurement-cash-issue-notifications':{currentCashIssue:async()=>mode==='offline'?{state:'unknown'}:{state:'ready',userId:mode==='other'?43:42,fingerprint:row.fingerprint,title:'Выдать 5 000 ₽',body:'Тохов Астемир'}},
  });
  const body=await(await api.GET()).json();assert.equal(body.notifications[0].readAt,now.toISOString());assert.equal(body.notifications[0].active,true);
  assert.equal(body.notifications[0].body.includes('Тохов'),mode==='own');
 }
});
test('cashier dispatcher claims one send, names the live request and links to assigned request',async()=>{
 const env={...process.env};process.env.WEB_PUSH_VAPID_PUBLIC_KEY='mock';process.env.WEB_PUSH_VAPID_PRIVATE_KEY='mock';
 try{
 for(const decision of ['send','defer','cancel']){
  let claimed=false;const sent:any[]=[];const row={id:1,userId:42,kind:CASH_ISSUE_KIND,fingerprint:cashIssueKey(status(),42),taskId:null,issueId:null,reviewId:null,task:null,issue:null,review:null,updatedAt:now,status:'pending',pushStatus:'pending',attemptCount:0,sentAt:null,user:{pushSubscriptions:[{id:1,endpoint:'https://push.invalid',p256dh:'mock',auth:'mock'}]}};
  const api=await load('lib/workday-notifications.ts',{
   '@/lib/prisma':{prisma:{workdayNotification:{findMany:async(a:any)=>a.include?[row]:[],update:async()=>{},updateMany:async(a:any)=>{if(a.data.pushStatus==='delivery_sending'){if(claimed)return{count:0};claimed=true;}return{count:1};}}}},
   '@/lib/terminal-fiscal-admin-gate':{TERMINAL_FISCAL_ADMIN_FIRST:false},
   '@/lib/procurement-notification-lifecycle':{inactiveProcurementNotifications:async()=>new Set()},
   '@/lib/procurement-delivery-notifications':{queueDeliveryReadyPush:async()=>{}},
   '@/lib/procurement-collection-notifications':{queueCollectionReadyPush:async()=>{}},
   '@/lib/procurement-morning-notifications':{queueCashMorningPushes:async()=>{}},
   '@/lib/procurement-cash-issue-notifications':{queueCashIssuePush:async()=>{},cashIssuePushDecision:async()=>decision==='send'?({state:'send',...cashIssuePushCopy(cashIssuePermission(status(),now)!)}):({state:decision,until:new Date(now.getTime()+60000)})},
   'web-push':{setVapidDetails:()=>{},sendNotification:async(_:any,payload:string)=>sent.push(JSON.parse(payload))},
  });
  await Promise.all([api.dispatchDueWorkdayNotifications(now),api.dispatchDueWorkdayNotifications(now)]);
  assert.equal(sent.length,decision==='send'?1:0);if(sent.length){assert.equal(sent[0].url,`/employee/cash-issue?request=${ref}`);assert.equal(sent[0].title,'Выдать Астемиру 5 000 ₽');assert.equal(sent[0].body,'Из кассы «Касса Чеченова». После выдачи оформите расходник в 1С.');}
 }
 }finally{process.env=env;}
});

test('cash issue details authorize the cashier and disclose no other cashier data', async () => {
 for (const mode of ['anonymous','admin','inactive','wrong-area','other','own','offline']) {
  let calls = 0;
  const user = mode === 'anonymous' ? null : {id:42,role:mode === 'admin' ? 'ADMIN' : 'EMPLOYEE',isActive:mode !== 'inactive',portalArea:mode === 'wrong-area' ? 'PROCUREMENT' : 'WORKDAY'};
  const api = await load('app/api/employee/cash-issue/route.ts', {
   '@/lib/auth':{getCurrentUser:async()=>user},
   '@/lib/procurement-cash-issue-notifications':{currentCashIssue:async(_:Date,fresh:boolean)=>{calls++; assert.equal(fresh,true); return mode === 'offline' ? {state:'unknown'} : {state:'ready',userId:mode === 'other'?43:42,request:cashIssuePermission(status(),now)};}},
  });
  const response = await api.GET(new Request('https://local.invalid/api/employee/cash-issue?fresh=1'));
  if (['anonymous','admin','inactive','wrong-area'].includes(mode)) { assert.equal(response.status,mode==='anonymous'?401:403); assert.equal(calls,0); }
  else { const body = await response.json(); assert.equal(Boolean(body.request),mode==='own'); assert.equal(body.unavailable,mode==='offline'); assert.equal(response.headers.get('cache-control'),'no-store'); }
 }
});
test('compact copy tells cashier the request exists and RKO is their next step', () => {
 const ready = cashIssuePermission(status(), now)!;
 assert.match(cashIssueCompactCopy(ready).title,/Выдать Астемиру 5/);
 assert.equal(cashIssueCompactCopy(ready).subtitle,'Заявка готова · оформите расходник');
 assert.match(cashIssueCompactCopy({...ready,amount:3000,issued:2000}).title,/Астемиру ещё 3/);
 assert.deepEqual(cashIssuePushCopy(ready), {
  title: 'Выдать Астемиру 5 000 ₽',
  body: 'Из кассы «Касса Чеченова». После выдачи оформите расходник в 1С.',
 });
});

test('no current active shift pauses the request and defers its push without declaring it issued', async () => {
 const api=await load('lib/procurement-cash-issue-notifications.ts',{
  './prisma':{prisma:{userOneCCashboxMapping:{findMany:async()=>[{userId:42}]},workDayEntry:{findFirst:async(args:any)=>{
   assert.equal(args.where.userId,42); assert.equal(args.where.date,'2026-10-12');
   assert.equal(args.where.status,'active'); assert.equal(args.where.endedAt,null);
   assert.equal(args.where.startedAt.lte,now); return null;
  }}}},
  './procurement-delivery-reminders':{loadDeliveryView:async()=>({requestStateAvailable:true,nativeRequest:{state:'linked',status:status()}})},
 });
 const current=await api.currentCashIssue(now,true); assert.equal(current.state,'waiting_shift'); assert.equal(current.request,undefined);
 assert.equal((await api.cashIssuePushDecision({userId:42,fingerprint:cashIssueKey(status(),42)},now)).state,'defer');
 assert.equal((await api.cashIssuePushDecision({userId:43,fingerprint:cashIssueKey(status(),42)},now)).state,'cancel');
});
test('details of an off-shift cashier show a start-workday hint and never an amount', async () => {
 const api=await load('app/api/employee/cash-issue/route.ts',{
  '@/lib/auth':{getCurrentUser:async()=>({id:42,isActive:true,role:'EMPLOYEE',portalArea:'WORKDAY'})},
  '@/lib/procurement-cash-issue-notifications':{currentCashIssue:async()=>({state:'waiting_shift',userId:42})},
 });
 const body=await (await api.GET(new Request('https://local.invalid/api/employee/cash-issue?fresh=1'))).json();
 assert.equal(body.request,null); assert.equal(body.waitingForShift,true); assert.equal(body.unavailable,false);
});

test('reserve recipients require actual current retail cash-manager shifts; all other tills stay personal', async () => {
 const s=status({cashboxRef:DELIVERY_PHONE_RESERVE_REF,cashbox:'Резерв Под Телефоны'});
 const api=await load('lib/procurement-cash-issue-notifications.ts',{
  './prisma':{prisma:{workDayEntry:{findMany:async(args:any)=>{
   assert.deepEqual(args.where,{date:'2026-10-12',department:'retail',status:'active',endedAt:null,startedAt:{lte:now},
    user:{isActive:true,role:'EMPLOYEE',portalArea:'WORKDAY',department:'retail',oneCCashboxMapping:{is:{isActive:true,oneCCashboxRef:{not:''}}}}});
   return [{userId:42},{userId:43},{userId:42}];
  }}}},
  './procurement-delivery-reminders':{loadDeliveryView:async()=>({requestStateAvailable:true,nativeRequest:{state:'linked',status:s}})},
 });
 const current=await api.currentCashIssue(now,true);
 assert.equal(current.state,'shared');assert.deepEqual(current.notices.map((n:any)=>n.userId),[42,43]);
 for(const userId of [42,43])assert.equal((await api.cashIssuePushDecision({userId,fingerprint:cashIssueKey(s,userId)},now)).state,'send');
 assert.equal((await api.cashIssuePushDecision({userId:44,fingerprint:cashIssueKey(s,44)},now)).state,'cancel');
 assert.match(cashIssueCompactCopy(current.notices[0].request).subtitle,/Резерв Под Телефоны/);
});

test('shared details are visible to each selected manager only and lifecycle closes every recipient together', async()=>{
 const request=cashIssuePermission(status({cashboxRef:DELIVERY_PHONE_RESERVE_REF}),now)!;
 const notices=[42,43].map(userId=>({userId,fingerprint:cashIssueKey(status({cashboxRef:DELIVERY_PHONE_RESERVE_REF}),userId),request}));
 let current:any={state:'shared',notices};
 for(const userId of [42,43,44]){
  const api=await load('app/api/employee/cash-issue/route.ts',{
   '@/lib/auth':{getCurrentUser:async()=>({id:userId,isActive:true,role:'EMPLOYEE',portalArea:'WORKDAY'})},
   '@/lib/procurement-cash-issue-notifications':{currentCashIssue:async()=>current},
  });
  assert.equal(Boolean((await(await api.GET(new Request('https://local.invalid/api/employee/cash-issue'))).json()).request),userId!==44);
 }
 const lifecycle=await load('lib/procurement-notification-lifecycle.ts',{'./procurement-cash-issue-notifications':{currentCashIssue:async()=>current}});
 const rows=notices.map((n,i)=>({id:i+1,kind:CASH_ISSUE_KIND,fingerprint:n.fingerprint}));
 assert.equal((await lifecycle.inactiveProcurementNotifications({},rows)).size,0);
 current={state:'unknown'};assert.equal((await lifecycle.inactiveProcurementNotifications({},rows)).size,0);
 current={state:'inactive'};assert.deepEqual([...(await lifecycle.inactiveProcurementNotifications({},rows))],[1,2]);
});
