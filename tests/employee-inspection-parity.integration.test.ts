import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { createSessionToken } from '../lib/session';

const databaseUrl=process.env.EMPLOYEE_INSPECTION_TEST_DATABASE_URL;
const base=process.env.EMPLOYEE_INSPECTION_TEST_ORIGIN;
test('real isolated HTTP: same PWA presentation, employee-owned device/help reads and zero inspection mutations', {skip:!databaseUrl || !base},async()=>{
 assert.equal(databaseUrl,'postgresql://preview:local-pwa-setup-only@127.0.0.1:55489/pwa_inspection_review_20261108');assert.equal(base,'http://127.0.0.1:3228');
 const db=new PrismaClient({datasources:{db:{url:databaseUrl+'?connection_limit=2'}}}),marker='inspection-http-'+randomUUID();
 const users:number[]=[];
 const make=async(suffix:string,role='EMPLOYEE',department='retail',portalArea='WORKDAY')=>{
  const user=await db.user.create({data:{login:marker+suffix,name:marker+suffix,passwordHash:'not-a-real-password',role,department,portalArea}});users.push(user.id);return user;
 };
 const req=(path:string,token?:string,method='GET')=>fetch(base+path,{method,redirect:'manual',headers:{...(token?{cookie:'offonika_session='+token}:{}),origin:base!,'content-type':'application/json'},...(method==='POST'?{body:'{}'}:{})});
 try{
  const admin=await make('-admin','ADMIN'),otherAdmin=await make('-other','ADMIN');
  const token=createSessionToken(admin.id),otherToken=createSessionToken(otherAdmin.id);
  const targets=[await make('-retail'),await make('-wholesale','EMPLOYEE','wholesale'),await make('-helper','EMPLOYEE','procurement'),await make('-buyer','EMPLOYEE','procurement','PROCUREMENT')];
  const now=new Date(),expiresAt=new Date(now.getTime()+86400000),browserId=randomUUID();
  const phone=await db.portalAccessSession.create({data:{userId:targets[0].id,sessionHash:marker+'phone',device:'iPhone',browser:'Safari',browserInstanceId:browserId,observedBrowserId:browserId,displayMode:'app',contextCheckedAt:now,pushState:'blocked',pushCheckedAt:now,expiresAt}});
  const other=await db.portalAccessSession.create({data:{userId:targets[1].id,sessionHash:marker+'other',device:'iPhone',browser:'Safari',displayMode:'app',pushState:'not_connected',pushCheckedAt:now,expiresAt}});
  const notice=await db.workdayNotification.create({data:{userId:targets[0].id,fingerprint:marker,kind:'planned',title:'Fixture-only notice',body:'Must stay unread',status:'sent',scheduledAt:now,sentAt:now}});
  const snapshot=async()=>({users:await db.user.findMany({where:{id:{in:users}},orderBy:{id:'asc'}}),sessions:await db.portalAccessSession.findMany({where:{userId:{in:users}},orderBy:{id:'asc'}}),notices:await db.workdayNotification.findMany({where:{userId:{in:users}},orderBy:{id:'asc'}}),workdays:await db.workDayEntry.count({where:{userId:{in:users}}}),plans:await db.workScheduleEntry.count({where:{userId:{in:users}}}),acks:await db.portalActivityEvent.count({where:{userId:{in:users}}}),push:await db.workdayPushSubscription.count({where:{userId:{in:users}}})});
  const before=await snapshot();
  for(const target of targets){
   const open=await req(`/api/admin/employees/${target.id}/preview`,token,'POST');assert.equal(open.status,200);assert.equal(open.headers.get('set-cookie'),null);
   const {href}=await open.json();const api='/api'+href;
   const page=await req(href+(target.portalArea==='PROCUREMENT'?'?frame=phone':''),token);assert.equal(page.status,200);
   const html=await page.text();if(target.portalArea!=='PROCUREMENT')assert.ok(/<button[^>]*aria-label="Справка"/.test(html),'actual shared PWA help is present');
   // Procurement chooses its mounted phone tree after matchMedia; verify that tree in the browser.
   const setup=await req(api+'?resource=app-setup',token);assert.equal(setup.status,200);assert.match(setup.headers.get('cache-control')! ,/private, no-store/);
   const state=await setup.json();assert.ok(Array.isArray(state.connections));
   const help=await req(api+'?resource=work-help',token);assert.equal(help.status,200);assert.equal((await help.json()).due,true);
   assert.equal((await req(api+'?resource=work-help',token,'POST')).status,405);
   if(target.id===targets[0].id){
    assert.equal(state.selectedId,phone.id);assert.equal(state.connections[0].state,'denied');
    const data=JSON.stringify(state);for(const secret of ['sessionHash','p256dh','endpoint','passwordHash','auth'])assert.ok(!data.includes('"'+secret+'"'));
    const wrong=await(await req(api+'?resource=app-setup&connection='+other.id,token)).json();assert.equal(wrong.selectedId,null);assert.ok(!wrong.connections.some((c:any)=>c.id===other.id));
    assert.equal((await req(api+'?resource=app-setup&connection=invalid%2Fpath',token)).status,400);
    assert.equal((await req(api+'?resource=app-setup')).status,401);
    assert.equal((await req(api+'?resource=app-setup',createSessionToken(target.id))).status,403);
    assert.equal((await req(api+'?resource=app-setup',otherToken)).status,410);
    assert.equal((await req(api+'?resource=notifications',token)).status,200);
    assert.equal((await req(api+'?resource=app-setup',token,'POST')).status,405);
   }
  }
  assert.deepEqual(await snapshot(),before,'inspection does not acknowledge, mark notices, register push, alter attendance/schedule/auth or rewrite device observations');
  assert.equal((await db.workdayNotification.findUniqueOrThrow({where:{id:notice.id}})).readAt,null);
 }finally{
  await db.employeePreviewVisit.deleteMany({where:{adminId:{in:users}}});
  await db.portalActivityEvent.deleteMany({where:{userId:{in:users}}});
  await db.user.deleteMany({where:{id:{in:users}}});await db.$disconnect();
 }
});

test('real PWA observation API changes the inspected banner without ADMIN mutation or employee permission requests',{skip:!databaseUrl||!base},async()=>{
 assert.equal(databaseUrl,'postgresql://preview:local-pwa-setup-only@127.0.0.1:55489/pwa_inspection_review_20261108');assert.equal(base,'http://127.0.0.1:3228');
 const db=new PrismaClient({datasources:{db:{url:databaseUrl+'?connection_limit=2'}}});const marker='live-pwa-http-'+randomUUID(),users:number[]=[];
 try{
  const admin=await db.user.create({data:{name:marker,login:marker+'admin',role:'ADMIN',passwordHash:'not-login'}});users.push(admin.id);
  const employee=await db.user.create({data:{name:marker,login:marker+'employee',role:'EMPLOYEE',department:'procurement',passwordHash:'not-login'}});users.push(employee.id);
  const token=createSessionToken(employee.id),adminToken=createSessionToken(admin.id);let browserCookie='';
  const report=async(ui:unknown,permission='default',endpoint?:string)=>{
   const res=await fetch(base+'/api/auth/activity',{method:'POST',headers:{cookie:'offonika_session='+token+(browserCookie?'; '+browserCookie:''),origin:base!,'sec-fetch-site':'same-origin','user-agent':'Mozilla/5.0 (iPhone) Version/18.0 Safari/605.1.15','content-type':'application/json'},body:JSON.stringify({permission,displayMode:'app',...(endpoint?{endpoint}:{}),app:{version:'1.21.46',builtAt:'2026-11-07T20:39:36.808Z',clientId:'76ad826c-ef9d-4582-968b-2c716819fc67',state:'current',ui}})});
   const cookie=res.headers.get('set-cookie')?.match(/mobo_access_browser=[^;]+/)?.[0];if(cookie)browserCookie=cookie;return res;
  };
  const initial={setup:'notifications',busy:false,error:null,online:true,sampledAt:new Date().toISOString()};
  assert.equal((await report(initial)).status,200);
  const open=await fetch(base+`/api/admin/employees/${employee.id}/preview`,{method:'POST',headers:{cookie:'offonika_session='+adminToken,origin:base!,'content-type':'application/json'},body:'{}'});assert.equal(open.status,200);const {href}=await open.json();
  const read=async()=>{const res=await fetch(base+'/api'+href+'?resource=app-setup',{headers:{cookie:'offonika_session='+adminToken}});assert.equal(res.status,200);const s=await res.json();return s.connections.find((c:any)=>c.id===s.selectedId);};
  let shown=await read();assert.equal(shown.state,'notifications');assert.equal(shown.live,true);
  const busy={...initial,setup:'reconnect',busy:true,sampledAt:new Date().toISOString()};assert.equal((await report(busy)).status,200);shown=await read();assert.equal(shown.runtime.busy,true);assert.equal(shown.state,'reconnect');
  const error={...busy,busy:false,error:'Не удалось подключить уведомления. Повторите попытку.'};assert.equal((await report(error)).status,200);shown=await read();assert.equal(shown.runtime.error,error.error);
  const sub=await db.workdayPushSubscription.create({data:{userId:employee.id,endpoint:'https://live-pwa-fixture.invalid/'+marker,p256dh:'fixture-key',auth:'fixture-auth'}});
  const ready={...initial,setup:'ready',sampledAt:new Date().toISOString()};assert.equal((await report(ready,'granted',sub.endpoint)).status,200);shown=await read();assert.equal(shown.state,'ready');assert.equal(shown.runtime.error,null);assert.equal(shown.live,true);
  const before=await db.portalAccessSession.findMany({where:{userId:employee.id},orderBy:{id:'asc'}});
  await read();await read();assert.deepEqual(await db.portalAccessSession.findMany({where:{userId:employee.id},orderBy:{id:'asc'}}),before,'ADMIN reads never change employee observations');
  assert.equal((await report({...ready,input:'forbidden'})).status,400);
  assert.equal(await db.workScheduleEntry.count({where:{userId:employee.id}}),0);assert.equal(await db.workDayEntry.count({where:{userId:employee.id}}),0);assert.equal(await db.portalActivityEvent.count({where:{userId:employee.id,kind:'work_help_ack'}}),0);
 }finally{await db.employeePreviewVisit.deleteMany({where:{adminId:{in:users}}});await db.user.deleteMany({where:{id:{in:users}}});await db.$disconnect();}
});
