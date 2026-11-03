import assert from 'node:assert/strict';
import test from 'node:test';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
test('review API: ADMIN only, same-origin JSON, strict task ID and safe failure', async()=>{
 let actor:{id:number;role:string}|null=null;
 let calls=0,fail=false;
 const mocks:Record<string,unknown>={
  '@/lib/auth':{getCurrentUser:async()=>actor},
  '@/lib/prisma':{prisma:{$transaction:async(fn:(tx:object)=>Promise<unknown>)=>{if(fail)throw Error('sensitive database failure');return fn({});}}},
  '@/lib/workday-handover-review-server':{acknowledgeHandoverReview:async(_tx:unknown,taskId:number)=>{calls++;return {ok:true,review:{id:1,taskId,reviewedBy:'Администратор',reviewedAt:'2026-11-03T07:00:00Z'}};}},
 };
 const bundled=await build({entryPoints:['app/api/admin/workday/handover-review/route.ts'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',plugins:[{name:'test-dependencies',setup(b){b.onResolve({filter:/.*/},args=>args.path in mocks?{path:args.path,external:true}:undefined);}}]});
 const mod={exports:{} as {POST:(request:Request)=>Promise<Response>}},require=createRequire(import.meta.url);
 new Function('require','module','exports',bundled.outputFiles[0].text)((key:string)=>key in mocks?mocks[key]:require(key),mod,mod.exports);
 const request=(body:unknown,headers:Record<string,string>={})=>new Request('http://portal-app:3000/api/admin/workday/handover-review',{method:'POST',headers:{'content-type':'application/json',host:'team.mobo-opt.ru',origin:'https://team.mobo-opt.ru',...headers},body:JSON.stringify(body)});
 assert.equal((await mod.exports.POST(request({taskId:6}))).status,403);
 actor={id:7,role:'EMPLOYEE'};assert.equal((await mod.exports.POST(request({taskId:6}))).status,403);
 actor={id:20,role:'ADMIN'};
 for(const taskId of [undefined,null,'6',0,-1,1.5,2147483648])assert.equal((await mod.exports.POST(request({taskId}))).status,400);
 assert.equal((await mod.exports.POST(request({taskId:6},{origin:'https://other.example'}))).status,403);
 assert.equal(calls,0);
 const saved=await mod.exports.POST(request({taskId:6}));assert.equal(saved.status,200);assert.equal((await saved.json()).review.taskId,6);assert.equal(calls,1);
 fail=true;const failed=await mod.exports.POST(request({taskId:6}));assert.equal(failed.status,500);assert.equal((await failed.json()).error,'Не удалось сохранить проверку. Повторите попытку.');
});
