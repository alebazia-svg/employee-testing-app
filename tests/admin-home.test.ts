import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {homePriorityActions,homeRefreshInterval,isHomeSection,retainHomeRead,type HomeRead} from '../lib/admin-home';
async function route(auth:unknown,load:unknown){
 const mocks:Record<string,unknown>={'@/lib/admin-api-auth':{requireAdminApi:async()=>auth},'@/lib/admin-home':{isHomeSection},'@/lib/admin-home-data':{loadHomeSection:load},'@/lib/workday':{getMoscowDateKey:()=> '2026-11-07'}};
 const output=await build({entryPoints:['app/api/admin/home/route.ts'],bundle:true,write:false,platform:'node',format:'cjs',plugins:[{name:'home-sources',setup(b){b.onResolve({filter:/.*/},a=>a.path in mocks?{path:a.path,external:true}:undefined);}}]});
 const mod={exports:{} as {GET:(req:Request)=>Promise<Response>}};
 new Function('require','module','exports',output.outputFiles[0].text)((name:string)=>mocks[name],mod,mod.exports);return mod.exports;
}
test('admin role is required before any source read; unauthenticated errors are private',async()=>{
 for(const status of [401,403]){let calls=0;const api=await route({ok:false,response:Response.json({error:'Denied'},{status})},()=>{calls++;});const response=await api.GET(new Request('http://local/api/admin/home?section=taxes'));assert.equal(response.status,status);assert.equal(calls,0);assert.match(response.headers.get('Cache-Control')||'',/private, no-store/);}
});
test('source allowlist rejects arbitrary reads before the loader',async()=>{
 let calls=0;const api=await route({ok:true,user:{id:10}},()=>{calls++;});
 for(const value of ['', '../taxes','constructor','unknown']){assert.equal((await api.GET(new Request('http://local/api/admin/home?section='+encodeURIComponent(value)))).status,400);}assert.equal(calls,0);
});
test('successful reads preserve exact amounts, null uncertainty, origin day and admin identity',async()=>{
 const received:unknown[]=[];const api=await route({ok:true,user:{id:23}},async(...args:unknown[])=>{received.push(args);return{cash:98904,free:null};});const r=await api.GET(new Request('http://local/api/admin/home?section=finance'));assert.equal(r.status,200);const body=await r.json();assert.deepEqual(body.data,{cash:98904,free:null});assert.equal(body.section,'finance');assert.equal(body.day,'2026-11-07');assert.deepEqual(received,[['finance',23]]);assert.equal(r.headers.get('Vary'),'Cookie');
});
test('failed sources are not success, zeros or leaked errors',async()=>{
 const api=await route({ok:true,user:{id:1}},async()=>{throw Error('private credentials and query');});const r=await api.GET(new Request('http://local/api/admin/home?section=settlement'));assert.equal(r.status,503);const text=await r.text();assert.doesNotMatch(text,/credentials|query|"data"|"remaining"/);assert.match(r.headers.get('Cache-Control')||'',/no-store/);
});
test('a retained read remains dated, and a Moscow day change clears yesterday',()=>{
 const previous={section:'finance',day:'2026-11-07',checkedAt:'2026-11-07T13:38:00Z',data:{cash:98904,checkedAt:'2026-11-07T13:38:00Z',sourceComplete:false,detail:'pending'}} as HomeRead<'finance'>;
 assert.equal(retainHomeRead(previous,'2026-11-07'),previous);assert.equal(retainHomeRead(previous,'2026-11-08'),undefined);
 assert.equal(homeRefreshInterval('workday'),60000);assert.equal(homeRefreshInterval('finance'),120000);assert.equal(homeRefreshInterval('settlement'),300000);
});

test('first screen includes operational action and admin decisions without dropping other active items',()=>{
 const row=(id:string)=>({id,title:id,detail:'source',href:'/admin/workday'});
 const work=[row('cash'),row('late'),row('help')],payroll=[row('salary'),row('rule')],tax=[row('usn')];
 const ordered=homePriorityActions(work,payroll,tax);assert.deepEqual(ordered.slice(0,3).map(r=>r.id),['cash','salary','usn']);assert.equal(ordered.length,6);assert.equal(new Set(ordered.map(r=>r.id)).size,6);
});
