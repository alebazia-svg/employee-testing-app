import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
test('native commands refuse wrong base and missing capability before POST; uncertainty starts only on dispatch',async()=>{
 const oldFetch=globalThis.fetch,oldDemo=process.env.PORTAL_ISOLATED_DEMO;
 const caps={contract:'expense-request-admin-v1',actions:['save','mark_payable']};
 let version:any={environment:'production',base:'Teleinvest_UT11'},failVersion=false,failCommand=false;
 let sent=0;
 globalThis.fetch=(async(url:any,init:any)=>{
  assert.equal(init.redirect,'error');
  if(String(url).endsWith('/version')){if(failVersion)throw Error('timeout');return Response.json(version);}
  if(init.method==='POST')sent++;
  if(failCommand)throw Error('timeout');
  return Response.json({ok:true});
 }) as typeof fetch;
 try{
  const out=await build({entryPoints:['lib/expense-request-admin-client.ts'],bundle:true,write:false,format:'cjs',platform:'node',packages:'external',plugins:[{name:'env',setup(b){b.onResolve({filter:/one-c-env$/},()=>({path:'env',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:"export const readOneCRuntimeEnv=()=>({baseUrl:'http://mock-1c',user:'test',password:'test'});"}));}}]});
  const m={exports:{} as any};new Function('require','module','exports',out.outputFiles[0].text)(createRequire(import.meta.url),m,m.exports);
  const send=()=>m.exports.expenseNativeTransport({method:'POST',body:{action:'mark_payable',confirm:true}});
  delete process.env.PORTAL_ISOLATED_DEMO;
  await assert.rejects(send,(e:any)=>e.uncertain===false && e.status===503);assert.equal(sent,0);
  version={environment:'test',base:'trade83_ut11_Test',expense_request_commands:caps};
  await assert.rejects(send,(e:any)=>e.uncertain===false);assert.equal(sent,0);
  version={environment:'production',base:'Teleinvest_UT11',expense_request_commands:caps};
  failVersion=true;await assert.rejects(send,(e:any)=>e.uncertain===false);assert.equal(sent,0);
  failVersion=false;await send();assert.equal(sent,1);
  failCommand=true;await assert.rejects(send,(e:any)=>e.uncertain===true);assert.equal(sent,2);
  failCommand=false;process.env.PORTAL_ISOLATED_DEMO='1';
  await assert.rejects(send,(e:any)=>e.uncertain===false);assert.equal(sent,2);
  version={environment:'test',base:'trade83_ut11_Test'};await send();assert.equal(sent,3);
 }finally{globalThis.fetch=oldFetch;if(oldDemo===undefined)delete process.env.PORTAL_ISOLATED_DEMO;else process.env.PORTAL_ISOLATED_DEMO=oldDemo;}
});
