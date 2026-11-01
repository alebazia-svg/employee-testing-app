import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createKkmCloseReportCache,createKkmCloseReportLoader} from '../lib/kkm-close-report-cache';
import {prefetchKkmCloseReports} from '../lib/kkm-close-prefetch';
const input={kktRegistrationNumber:'kkt',from:'2026-11-01T00:00:00+03:00',to:'2026-11-02T00:00:00+03:00'};
const now=Date.parse('2026-11-01T08:01:00Z');
const good:any={complete:true,checkedAt:new Date(now).toISOString(),data:[{kktRegistrationNumber:'kkt',fiscalDriveNumber:'fn',shiftNumber:'82',openedAt:'2026-11-01T07:12:00Z',closedAt:'2026-11-01T07:47:00Z',documentLink:'report'}]};
async function fixture(){const dir=await mkdtemp(path.join(tmpdir(),'kkm-source-test-'));let clock=now;return{dir,cache:createKkmCloseReportCache(dir,()=>clock),clock:()=>clock,advance:(n:number)=>clock+=n,cleanup:()=>rm(dir,{recursive:true,force:true})};}
test('a completed background read makes the employee check available without another OFD round trip',async()=>{
 const f=await fixture();try{let calls=0;const loader=createKkmCloseReportLoader({cache:f.cache,now:f.clock,load:async()=>{calls++;return good;}});
 await loader(input,{force:true,prefetch:true});const anotherWorker=createKkmCloseReportLoader({cache:createKkmCloseReportCache(f.dir,f.clock),now:f.clock,load:async()=>{throw Error('must not fetch');}});
 assert.equal((await anotherWorker(input)).fromCache,true);assert.equal(calls,1);
 }finally{await f.cleanup();}
});
test('incomplete, empty, expired, foreign and future source data cannot become closure proof',async()=>{
 const f=await fixture();try{
 for(const bad of [{...good,complete:false},{...good,data:[]},{...good,checkedAt:new Date(now+1).toISOString()},{...good,data:[{...good.data[0],kktRegistrationNumber:'other'}]}])assert.equal(await f.cache.write(input,bad),false);
 assert.equal(await f.cache.write(input,good),true);f.advance(75001);assert.equal(await f.cache.read(input),null);
 }finally{await f.cleanup();}
});
test('a quick transient failure retries once and concurrent callers share source requests',async()=>{
 const f=await fixture();try{let calls=0;const loader=createKkmCloseReportLoader({cache:f.cache,now:f.clock,load:async()=>{calls++;await new Promise(r=>setTimeout(r,5));return calls===1?{complete:false,checkedAt:new Date(now).toISOString(),data:[]}:good;}});
 const [a,b]=await Promise.all([loader(input,{force:true,prefetch:true}),loader(input)]);assert.equal(a.complete,false);assert.equal(b.complete,true);assert.equal(calls,2);
 }finally{await f.cleanup();}
});
test('a slow outage does not trigger repeated employee waits or overwrite a valid saved report',async()=>{
 const f=await fixture();try{await f.cache.write(input,good);let calls=0;const loader=createKkmCloseReportLoader({cache:f.cache,now:f.clock,load:async()=>{calls++;f.advance(3000);return{complete:false,checkedAt:new Date(f.clock()).toISOString(),data:[]};}});
 assert.equal((await loader(input,{force:true})).complete,false);assert.equal(calls,1);assert.equal((await f.cache.read(input))?.complete,true);
 }finally{await f.cleanup();}
});
test('the existing minute job warms each physical KKT once without changing employee tasks',async()=>{
 let reads=0;const db:any={workDayEntry:{count:async()=>2},terminalFiscalMapping:{findMany:async()=>[{kktRegistrationNumber:'a'},{kktRegistrationNumber:'a'},{kktRegistrationNumber:'b'}]}};
 const result=await prefetchKkmCloseReports(new Date(now),db,async(arg,mode)=>{reads++;assert.equal(mode?.prefetch,true);assert.equal(arg.from,input.from);return{...good,data:[{...good.data[0],kktRegistrationNumber:arg.kktRegistrationNumber}]};});
 assert.deepEqual(result,{checked:2,complete:2});assert.equal(reads,2);
});
