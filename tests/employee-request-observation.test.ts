import test from 'node:test';
import assert from 'node:assert/strict';
import { observedEmployeeRequest,observedRequestAction } from '../lib/employee-request-observation';
test('only explicit employee workflows are observed; ordinary reads and already audited cash are unchanged',()=>{
 assert.equal(observedRequestAction('/api/procurement/payment-plans',{method:'POST'}),'procurement_payment');
 assert.equal(observedRequestAction('/api/procurement/payment-plans/private-id/receipts',{method:'POST'}),'procurement_receipt');
 assert.equal(observedRequestAction('/api/procurement/payment-plans'),null);
 assert.equal(observedRequestAction('/api/admin/procurement/payment-plans',{method:'PATCH'}),null);
 assert.equal(observedRequestAction('/api/employee/cash-operations',{method:'POST'}),null);
});
test('request, response, body, headers and abort signal are passed through exactly, without copying private fields',async()=>{
 const seen:any[]=[],events:any[]=[],controller=new AbortController(),response=Response.json({private:'result'});
 const original=async(...args:any[])=>{seen.push(args);return response;};
 const observed=observedEmployeeRequest(original as typeof fetch,(...args)=>events.push(args));
 const init={method:'POST',body:JSON.stringify({amount:123,comment:'private text'}),headers:{'x-private':'test'},signal:controller.signal};
 assert.equal(await observed('/api/procurement/payment-plans?private=secret',init),response);
 assert.equal(seen[0][1],init);assert.equal(seen[0][1].signal,controller.signal);
 assert.deepEqual(events.map(e=>e.slice(0,2)),[['procurement_payment','submitted'],['procurement_payment','response_received']]);assert.equal(events[0][2].operation,'payment_create');assert.equal(events[0][2].attemptId,events[1][2].attemptId);
 assert.doesNotMatch(JSON.stringify(events),/private|123|secret/);
});
test('collector failure never changes request execution, original rejection or response status',async()=>{
 const fail=()=>{throw Error('collector failed');},error=new DOMException('Cancelled','AbortError');
 const rejected=observedEmployeeRequest(async()=>{throw error;},fail);
 await assert.rejects(rejected('/api/procurement/payment-plans',{method:'PATCH'}),e=>e===error);
 const response=new Response(null,{status:503}),events:any[]=[];
 assert.equal(await observedEmployeeRequest(async()=>response,(...args)=>events.push(args))('/api/procurement/payment-plans',{method:'POST'}),response);
 assert.deepEqual(events.map(e=>e.slice(0,2)),[['procurement_payment','submitted'],['procurement_payment','request_failed']]);assert.equal(events[1][2].failure,'unavailable');
});
