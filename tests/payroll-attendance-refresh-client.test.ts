import {test} from 'node:test';
import assert from 'node:assert/strict';
import {refreshPayrollAttendanceClient} from '../lib/payroll-attendance-refresh-client';
const snapshot=(date:string,extra={})=>({snapshot:{sourceCheckedAt:date,...extra},formSummaries:[{employee:'test',workedDays:2}]});
const response=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status});
test('busy is retried; unchanged stored data never claims update success',async()=>{
 const calls:string[]=[];const queue=[response({},409),response(snapshot('2026-11-11T10:00:00Z')),response(snapshot('2026-11-11T11:00:00Z'))];
 const result=await refreshPayrollAttendanceClient('/test',{baseline:'2026-11-11T10:00:00Z',wait:async()=>{},fetcher:async(_url,init)=>{calls.push(init?.method??'GET');return queue.shift()!;}});
 assert.deepEqual(calls,['POST','GET','POST']);assert.equal(result.snapshot.sourceCheckedAt,'2026-11-11T11:00:00Z');
});
test('completed competing refresh is read without another source refresh',async()=>{
 const queue=[response({},409),response(snapshot('2026-11-11T11:00:00Z'))];
 const result=await refreshPayrollAttendanceClient('/test',{baseline:'2026-11-11T10:00:00Z',wait:async()=>{},fetcher:async()=>queue.shift()!});
 assert.equal(result.snapshot.sourceCheckedAt,'2026-11-11T11:00:00Z'); assert.equal(queue.length,0);
});
test('real failures and last-good source warning remain visible; cancellation stops retries',async()=>{
 await assert.rejects(refreshPayrollAttendanceClient('/test',{fetcher:async()=>response({error:'Источник недоступен'},502)}),/Источник недоступен/);
 const payload=snapshot('2026-11-11T10:00:00Z',{refreshError:'Сохранены прежние дни'});
 assert.equal((await refreshPayrollAttendanceClient('/test',{fetcher:async()=>response(payload)})).snapshot.refreshError,'Сохранены прежние дни');
 const abort=new AbortController();let calls=0;
 await assert.rejects(refreshPayrollAttendanceClient('/test',{signal:abort.signal,fetcher:async()=>{calls++;return response({},409);},wait:async signal=>{abort.abort();signal?.throwIfAborted();}}),{name:'AbortError'});
 assert.equal(calls,1);
});
