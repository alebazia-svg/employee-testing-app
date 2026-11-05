import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchSabyOfdJson } from '../lib/saby-ofd-transport';
import { exportUnifiedAusnOfdReceipts, sabyExportPeriod } from '../lib/ausn-ofd';

test('AUSN retries aborted requests with fresh signals and preserves successful JSON', async () => {
  const old=globalThis.fetch;let calls=0;const signals:unknown[]=[];
  globalThis.fetch=async (_url,init)=>{calls++;signals.push(init?.signal);if(calls<3)throw new DOMException('aborted','AbortError');return Response.json({receipt:{total:123}});};
  try {const r=await fetchSabyOfdJson('https://saby.test',{},50,3);assert.equal(calls,3);assert.equal(new Set(signals).size,3);assert.deepEqual(r.data,{receipt:{total:123}});}finally{globalThis.fetch=old;}
});

test('existing diagnostics still make one attempt and propagate network failure', async () => {
  const old=globalThis.fetch;let calls=0;
  globalThis.fetch=async()=>{calls++;throw new DOMException('aborted','AbortError');};
  try {await assert.rejects(fetchSabyOfdJson('https://saby.test',{},50),{name:'AbortError'});assert.equal(calls,1);}finally{globalThis.fetch=old;}
});

test('HTTP rejection and programming errors are not retried', async () => {
  const old=globalThis.fetch;let calls=0;
  try {
    globalThis.fetch=async()=>{calls++;return new Response('unavailable',{status:503});};
    const r=await fetchSabyOfdJson('https://saby.test',{},50,3);assert.equal(calls,1);assert.equal(r.response.status,503);assert.deepEqual(r.data,{text:'unavailable'});
    globalThis.fetch=async()=>{calls++;throw new TypeError('invalid program state');};
    await assert.rejects(fetchSabyOfdJson('https://saby.test',{},50,3),/invalid program state/);assert.equal(calls,2);
  }finally{globalThis.fetch=old;}
});

test('real timeout aborts every bounded attempt without returning a false successful empty response', async () => {
  const old=globalThis.fetch;let calls=0;
  globalThis.fetch=async(_url,init)=>new Promise((_resolve,reject)=>{calls++;init!.signal!.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError')),{once:true});});
  try {await assert.rejects(fetchSabyOfdJson('https://saby.test',{},5,2),{name:'AbortError'});assert.equal(calls,2);}finally{globalThis.fetch=old;}
});

test('exhausted Saby transport remains explicitly incomplete in the unified export', async () => {
  const old=globalThis.fetch,env={...process.env};let authCalls=0;
  Object.assign(process.env,{SABY_OFD_ENABLED:'true',SABY_OFD_APP_CLIENT_ID:'fixture-client',SABY_OFD_APP_SECRET:'fixture-secret',SABY_OFD_SECRET_KEY:'fixture-key',PLATFORMA_OFD_PROXY_BASE_URL:'http://platforma.test'});
  globalThis.fetch=async input=>{
    const u=new URL(String(input));
    if(u.hostname==='platforma.test')return u.pathname.endsWith('/kkts')?Response.json({data:{kkts:[{registrationNumber:'111'}]}}):Response.json({meta:{complete:true},data:{receipts:[]}});
    authCalls++;throw new DOMException('aborted','AbortError');
  };
  try {const r=await exportUnifiedAusnOfdReceipts({organizationInn:'fixture',dateFrom:'2026-08-01',dateTo:'2026-08-01'});assert.equal(authCalls,3);assert.equal(r.ok,false);assert.equal(r.completeness.complete,false);assert.equal(r.completeness.sources.saby.complete,false);assert.equal(r.completeness.sources.platforma_ofd.complete,true);assert.ok(r.errors.includes('Saby OFD export did not complete'));assert.ok(!JSON.stringify(r).includes('fixture-secret'));}
  finally {globalThis.fetch=old;for(const k of Object.keys(process.env))if(!(k in env))delete process.env[k];Object.assign(process.env,env);}
});


test('historical Saby coverage retains August and never extends into new-provider months', () => {
  assert.deepEqual(sabyExportPeriod('2026-08-01','2026-08-31'),{dateFrom:'2026-08-01',dateTo:'2026-08-31'});
  assert.deepEqual(sabyExportPeriod('2026-08-15','2026-09-15'),{dateFrom:'2026-08-15',dateTo:'2026-08-31'});
  assert.equal(sabyExportPeriod('2026-09-01','2026-11-04'),null);
});

test('new payments do not contact historical Saby and still require complete Platforma data', async () => {
  const old=globalThis.fetch,base=process.env.PLATFORMA_OFD_PROXY_BASE_URL;
  process.env.PLATFORMA_OFD_PROXY_BASE_URL='http://platforma.test';let calls=0;let upstreamComplete=true;
  globalThis.fetch=async input=>{
    const u=new URL(String(input));assert.equal(u.hostname,'platforma.test');calls++;
    return u.pathname.endsWith('/kkts')?Response.json({data:{kkts:[{registrationNumber:'111'}]}}):Response.json({meta:{complete:upstreamComplete},data:{receipts:[]}},{status:upstreamComplete?200:503});
  };
  try {const r=await exportUnifiedAusnOfdReceipts({organizationInn:'fixture',dateFrom:'2026-11-01',dateTo:'2026-11-04'});assert.equal(calls,5);assert.equal(r.ok,true);assert.equal(r.completeness.sources.saby.required,false);assert.equal(r.completeness.sources.platforma_ofd.complete,true);upstreamComplete=false;const failed=await exportUnifiedAusnOfdReceipts({organizationInn:'fixture',dateFrom:'2026-11-01',dateTo:'2026-11-01'});assert.equal(failed.ok,false);assert.equal(failed.completeness.sources.platforma_ofd.complete,false);assert.equal(failed.completeness.sources.saby.required,false);}
  finally {globalThis.fetch=old;if(base===undefined)delete process.env.PLATFORMA_OFD_PROXY_BASE_URL;else process.env.PLATFORMA_OFD_PROXY_BASE_URL=base;}
});
