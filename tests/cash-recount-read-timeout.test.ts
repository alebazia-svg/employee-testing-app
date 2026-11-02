import test from 'node:test';
import assert from 'node:assert/strict';
import {getCashStatementDimensions,getCashStatementSummary} from '../lib/one-c';
for(const method of ['dimensions','summary','default'] as const)test(`cash capture ${method}: optional short timeout does not change the normal client default`,async t=>{
 const keys=['1C_BASE_URL','1C_API_USER','1C_API_PASSWORD','1C_REQUEST_TIMEOUT_MS'];
 const saved=keys.map(k=>process.env[k]),fetchBefore=global.fetch;
 Object.assign(process.env,{'1C_BASE_URL':'http://127.0.0.1:1','1C_API_USER':'local-test','1C_API_PASSWORD':'local-test','1C_REQUEST_TIMEOUT_MS':'4500'});
 t.mock.timers.enable({apis:['setTimeout']});
 let aborted=false;
 global.fetch=(async(_url,options)=>new Promise((_resolve,reject)=>{
  options?.signal?.addEventListener('abort',()=>{aborted=true;reject(new Error('Request timed out'));},{once:true});
 })) as typeof fetch;
 try{
  const work=method==='dimensions'?getCashStatementDimensions({timeoutMs:2000}):method==='summary'?getCashStatementSummary({date:'2026-11-02',organizationRef:'demo',cashboxRef:'demo'},{timeoutMs:2000}):getCashStatementDimensions();
  const limit=method==='default'?4500:2000;
  t.mock.timers.tick(limit-1);assert.equal(aborted,false);
  t.mock.timers.tick(1);assert.equal(aborted,true);
  assert.equal((await work).ok,false);
 }finally{
  global.fetch=fetchBefore;t.mock.timers.reset();
  keys.forEach((k,i)=>{if(saved[i]===undefined)delete process.env[k];else process.env[k]=saved[i];});
 }
});
