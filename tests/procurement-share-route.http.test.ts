import test from 'node:test';import assert from 'node:assert/strict';
const base=process.env.SHARE_HTTP_BASE||'http://127.0.0.1:3174';
test('real HTTP share endpoint requires auth, ADMIN, same origin and a bounded unique selection',async()=>{
 const login=async(name:string)=>{const r=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({login:name,password:'documents-local-only'})});assert.equal(r.status,200);return r.headers.getSetCookie().find(c=>c.startsWith('offonika_session='))!.split(';')[0];};
 const admin=await login('documents-admin'),buyer=await login('documents-buyer');
 const send=(cookie:string,origin=base,body:any={selection:[]})=>fetch(base+'/api/admin/procurement/requisites-share',{method:'POST',headers:{cookie,origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await send('')).status,401);assert.equal((await send(buyer)).status,403);assert.equal((await send(admin,'https://wrong.invalid')).status,403);assert.equal((await send(admin)).status,400);
 assert.equal((await send(admin,base,{selection:[{id:'a',version:'v'},{id:'a',version:'v'}]})).status,400);
 assert.equal((await send(admin,base,{selection:[{id:'missing-test-plan',version:'v'}]})).status,409);
});
