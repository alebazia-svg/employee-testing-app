import test from 'node:test';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:3163';
async function login(name){const r=await fetch(`${base}/api/auth/login`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({login:name,password:'Activity-local-241026'})});assert.equal(r.status,200);return r.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');}
test('real HTTP auth and actor isolation', async()=>{
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const admin=await login('activity-admin'), employee=await login('activity-employee');
 const users=await (await fetch(`${base}/api/admin/employees`,{headers:{cookie:admin}})).json();
 const id=users.find(u=>u.login==='activity-employee').id;
 const get=(cookie)=>fetch(`${base}/api/admin/employees/${id}/activity?date=${date}`,{headers:cookie?{cookie}:{}});
 assert.equal((await get()).status,401);
 assert.equal((await get(employee)).status,403);
 assert.equal((await get(admin)).status,200);
 const send=(cookie,value,extra={})=>fetch(`${base}/api/employee/activity`,{method:'POST',headers:{cookie,'content-type':'application/json',...extra},body:JSON.stringify(value)});
 const input={key:'http-test-visit',kind:'visit',section:'schedule'};
 assert.equal((await send(admin,input)).status,403);
 assert.equal((await send(employee,{...input,userId:9999})).status,400);
 assert.equal((await send(employee,input,{'sec-fetch-site':'cross-site'})).status,403);
 assert.equal((await send(employee,input)).status,200);
 assert.equal((await fetch(`${base}/api/admin/employees/${id}/activity?date=2026-02-30`,{headers:{cookie:admin}})).status,400);
 assert.equal((await fetch(`${base}/api/admin/employees/999999/activity?date=${date}`,{headers:{cookie:admin}})).status,404);
});
