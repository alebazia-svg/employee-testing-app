import test from 'node:test';
import assert from 'node:assert/strict';
import { connectEmployeePush } from '../lib/employee-push-connection';

// Entire browser adapter is local to this test worker; no real push endpoint or OS prompt.
async function browserCase(options: {permission?:string;existing?:boolean;accepted?:boolean;requestResult?:string;abortOnSubscribe?:boolean}, run:(state:{calls:string[];controller:AbortController})=>Promise<void>) {
 const calls:string[]=[]; const controller=new AbortController();
 const saved=new Map(['window','navigator','Notification','fetch'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 const subscription={toJSON:()=>({endpoint:'https://push.invalid/test',keys:{p256dh:'test',auth:'test'}})};
 const notification={permission:options.permission??'granted',requestPermission:async()=>{calls.push('permission');return options.requestResult??'granted';}};
 Object.defineProperty(globalThis,'window',{configurable:true,value:{Notification:notification,PushManager:{}}});
 Object.defineProperty(globalThis,'Notification',{configurable:true,value:notification});
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{serviceWorker:{register:async()=>{calls.push('register');return {pushManager:{getSubscription:async()=>options.existing?subscription:null,subscribe:async()=>{calls.push('subscribe');if(options.abortOnSubscribe)controller.abort();return subscription;}}};}}}});
 Object.defineProperty(globalThis,'fetch',{configurable:true,value:async(_url:string,init:RequestInit={})=>{
  calls.push(init.method==='POST'?'save':'config');
  return Response.json(init.method==='POST'?{ok:true,active:options.accepted!==false,id:7}:{publicKey:'AQID'});
 }});
 try {await run({calls,controller});} finally {for(const [key,descriptor]of saved){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}}
}
test('startup reuses an existing subscription without asking for permission',async()=>browserCase({existing:true},async({calls,controller})=>{
 const result=await connectEmployeePush(false,controller.signal);assert.equal(result.active,true);assert.deepEqual(calls,['config','register','save']);
}));
test('permission is requested only from the explicit enable action',async()=>browserCase({permission:'default'},async({calls,controller})=>{
 await connectEmployeePush(true,controller.signal);assert.deepEqual(calls,['permission','config','register','subscribe','save']);
}));
test('declining permission performs no registration or server save',async()=>browserCase({permission:'default',requestResult:'denied'},async({calls,controller})=>{
 await assert.rejects(connectEmployeePush(true,controller.signal));assert.deepEqual(calls,['permission']);
}));
test('an unconfirmed server response cannot be reported as connected',async()=>browserCase({accepted:false},async({controller})=>{
 await assert.rejects(connectEmployeePush(false,controller.signal));
}));
test('leaving the account before subscribe finishes prevents a late server save',async()=>browserCase({abortOnSubscribe:true},async({calls,controller})=>{
 await assert.rejects(connectEmployeePush(false,controller.signal));assert.equal(calls.includes('save'),false);
}));

test('permission observation reports only the browser outcome and cannot interrupt the existing connector',async()=>{
 for(const result of ['denied','default'])await browserCase({permission:'default',requestResult:result},async({calls,controller})=>{const observed:string[]=[];await assert.rejects(connectEmployeePush(true,controller.signal,s=>observed.push(s)));assert.deepEqual(observed,[result==='denied'?'permission_denied':'permission_default']);assert.deepEqual(calls,['permission']);});
 await browserCase({permission:'default'},async({controller})=>{await assert.doesNotReject(connectEmployeePush(true,controller.signal,()=>{throw Error('collector failed');}));});
});
