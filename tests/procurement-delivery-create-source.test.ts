import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { deliveryCreateMode, deliveryCreationRef } from '../lib/procurement-delivery-create-policy';
const flags = ['PORTAL_TEST_ACCOUNTABLE_CREATE','PORTAL_ACCOUNTABLE_CREATE','PORTAL_ISOLATED_DEMO'] as const;
const caps = {contract:'expense-request-admin-v1',create_contract:'accountable-create-v1',actions:['save','mark_payable','create_accountable']};
test('creation modes require deliberate opt-in and isolate production identity from test',()=>{
  assert.equal(deliveryCreateMode({}),null);
  assert.equal(deliveryCreateMode({PORTAL_TEST_ACCOUNTABLE_CREATE:'1'}),null);
  assert.equal(deliveryCreateMode({PORTAL_TEST_ACCOUNTABLE_CREATE:'1',PORTAL_ISOLATED_DEMO:'1'}),'test');
  assert.equal(deliveryCreateMode({PORTAL_ACCOUNTABLE_CREATE:'1'}),'production');
  assert.equal(deliveryCreateMode({PORTAL_ACCOUNTABLE_CREATE:'1',PORTAL_ISOLATED_DEMO:'1'}),null);
  assert.equal(deliveryCreateMode({PORTAL_ACCOUNTABLE_CREATE:'1',PORTAL_TEST_ACCOUNTABLE_CREATE:'1'}),null);
  assert.notEqual(deliveryCreationRef('same','production'),deliveryCreationRef('same','test'));
  assert.equal(deliveryCreationRef('same'),deliveryCreationRef('same','test'));
});
test('creation checks live base and production capability before POST, preserves legacy TEST',async()=>{
  const oldFetch=globalThis.fetch,old=Object.fromEntries(flags.map(k=>[k,process.env[k]]));
  const calls:{url:string;method:string;redirect:unknown}[]=[];
  let version:any={environment:'production',base:'Teleinvest_UT11'};
  let contract='accountable-create-v1';
  globalThis.fetch=(async(url:any,init:any)=>{
    calls.push({url:String(url),method:init.method,redirect:init.redirect});
    return Response.json(String(url).endsWith('/version')?version:{ok:true,contract});
  }) as typeof fetch;
  try {
    const out=await build({entryPoints:['lib/procurement-delivery-create-source.ts'],bundle:true,write:false,format:'cjs',platform:'node',packages:'external',plugins:[{name:'env',setup(b){b.onResolve({filter:/one-c-env$/},()=>({path:'env',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:"export const readOneCRuntimeEnv=()=>({baseUrl:'http://mock-1c',user:'test',password:'test'});"}));}}]});
    const m={exports:{} as any};new Function('require','module','exports',out.outputFiles[0].text)(createRequire(import.meta.url),m,m.exports);
    const send=()=>m.exports.deliveryCreationApi('expense-request-admin',{action:'create_accountable',confirm:false});
    for(const f of flags)delete process.env[f];
    await assert.rejects(send,/CREATION_DISABLED/);assert.equal(calls.length,0);
    process.env.PORTAL_ACCOUNTABLE_CREATE='1';
    await assert.rejects(send,/CREATION_COMMAND_NOT_INSTALLED/);assert.equal(calls.filter(c=>c.method==='POST').length,0);
    version={...version,expense_request_commands:{...caps,actions:['save']}};
    await assert.rejects(send,/CREATION_COMMAND_NOT_INSTALLED/);
    version={environment:'test',base:'trade83_ut11_Test',expense_request_commands:caps};
    await assert.rejects(send,/CREATION_BASE_MISMATCH/);assert.equal(calls.filter(c=>c.method==='POST').length,0);
    version={environment:'production',base:'Other',expense_request_commands:caps};
    await assert.rejects(send,/CREATION_BASE_MISMATCH/);
    version={environment:'production',base:'Teleinvest_UT11',expense_request_commands:caps};await send();
    assert.equal(calls.filter(c=>c.method==='POST').length,1);
    contract='accountable-create-test-v1';await assert.rejects(send,/CREATION_COMMAND_NOT_INSTALLED/);
    delete process.env.PORTAL_ACCOUNTABLE_CREATE;process.env.PORTAL_TEST_ACCOUNTABLE_CREATE='1';process.env.PORTAL_ISOLATED_DEMO='1';
    await assert.rejects(send,/CREATION_BASE_MISMATCH/);
    version={environment:'test',base:'trade83_ut11_Test'};await send();
    version={...version,expense_request_commands:caps};contract='accountable-create-v1';await send();
    assert.ok(calls.every(c=>c.redirect==='error'));
  } finally {globalThis.fetch=oldFetch;for(const f of flags){if(old[f]===undefined)delete process.env[f];else process.env[f]=old[f];}}
});
