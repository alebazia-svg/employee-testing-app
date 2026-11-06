import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {prisma} from '../lib/prisma';
import {createSessionToken,sessionCookieName} from '../lib/session';
import {accessSessionIdentity} from '../lib/portal-access-journal';
if(process.env.DATABASE_URL!=='postgresql://postgres:access-demo-local-only@127.0.0.1:55504/access_demo')throw Error('Isolated demo required');
const base='http://127.0.0.1:3244/api/admin/employees/access/pages';
test('real HTTP: authorization, same-origin, bounded input and immutable browser/session identity',async()=>{
 const code=randomUUID(), marker='http-admin-pages-'+Date.now();
 const admin=await prisma.user.create({data:{name:marker,login:marker,passwordHash:'not-login',role:'ADMIN'}});
 const employee=await prisma.user.create({data:{name:marker,login:marker+'employee',passwordHash:'not-login',role:'EMPLOYEE'}});
 try{
  const token=createSessionToken(admin.id), auth=`${sessionCookieName}=${token}; mobo_access_browser=${code}`;
  const identity=accessSessionIdentity(token,admin.id)!;
  const send=(cookie:string,payload:unknown,extra:Record<string,string>={})=>fetch(base,{method:'POST',headers:{cookie,'content-type':'application/json','sec-fetch-site':'same-origin',...extra},body:JSON.stringify(payload)});
  const input={key:randomUUID(),page:'home'};
  assert.equal((await fetch(base)).status,401);
  assert.equal((await fetch(base,{headers:{cookie:`${sessionCookieName}=${createSessionToken(employee.id)}`}})).status,403);
  assert.equal((await send(auth,input)).status,409);
  const session=await prisma.portalAccessSession.create({data:{userId:admin.id,sessionHash:identity.sessionHash,device:'Mac',browser:'Test HTTP',browserInstanceId:code,observedBrowserId:code,expiresAt:identity.expiresAt}});
  const before=await prisma.portalAccessSession.findUnique({where:{id:session.id}});
  assert.equal((await send(auth,input,{'sec-fetch-site':'cross-site'})).status,403);
  assert.equal((await send(auth,input,{origin:'https://other.invalid'})).status,403);
  assert.equal((await send(auth,{...input,userId:employee.id})).status,400);
  assert.equal((await send(auth,{...input,page:'/admin?secret=value'})).status,400);
  assert.equal((await send(auth,{...input,padding:'x'.repeat(600)})).status,413);
  assert.equal((await send(auth.replace(code,randomUUID()),input)).status,409);
  assert.equal((await send(auth,input)).status,200);
  assert.equal((await send(auth,input)).status,200);
  assert.equal(await prisma.portalActivityEvent.count({where:{userId:admin.id}}),1);
  assert.deepEqual(await prisma.portalAccessSession.findUnique({where:{id:session.id}}),before);
  const response=await fetch(base+'?browser='+code,{headers:{cookie:auth}});assert.equal(response.status,200);assert.match(response.headers.get('cache-control')||'',/no-store/);
  const result=await response.json();assert.equal(result.summary.count,1);assert.equal(result.visits[0].browserId,code);assert.ok(!JSON.stringify(result).includes(identity.sessionHash));
  assert.equal((await fetch(base+'?date=2026-02-30',{headers:{cookie:auth}})).status,400);
 }finally{await prisma.user.deleteMany({where:{id:{in:[admin.id,employee.id]}}});await prisma.$disconnect();}
});
