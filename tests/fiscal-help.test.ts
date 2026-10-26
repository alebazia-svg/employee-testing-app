import {adminInboxEventMeta,adminInboxSourceState} from '../lib/admin-operations-view';
import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {terminalPaymentCopy,terminalPaymentMetadata,terminalFiscalHelpCopy,TERMINAL_FISCAL_HELP_TYPE} from '../lib/terminal-payment-copy';
import {terminalFiscalIsRegularTick,terminalFiscalPendingPeriods} from '../lib/terminal-fiscal-auto-run';
import {applyTerminalFiscalEmployeeAction} from '../lib/terminal-fiscal-review-actions';
import {eligibleAdminInboxWebPushTypes} from '../lib/admin-inbox-web-push-policy';
import {ATTENTION_PUSH_TYPES} from '../lib/admin-inbox-attention-policy';
const now=new Date('2026-10-26T15:31:00Z'),at=new Date('2026-10-26T13:42:03Z');
test('short mobile text identifies the card payment and actual printed number without jargon or manual completion',()=>{
 const copy=terminalPaymentCopy({amountKopecks:50000,operationAt:at,receiptNumber:'000413',method:'TERM_CARD',now});
 assert.equal(copy.payment,'Сегодня в 16:42 на вашем терминале оплатили картой 500 ₽. Чек терминала № 000413.');
 assert.ok(copy.payment.length<100);assert.ok(!/RRN|слип|пробейте|8865/.test(copy.body));
 assert.deepEqual(terminalPaymentMetadata([{body:copy.body}]),{receiptNumber:'000413',method:'TERM_CARD'});
 assert.ok(!terminalPaymentCopy({amountKopecks:50000,operationAt:at,receiptNumber:'aqsi:123',now}).body.includes('№'));
 assert.match(terminalPaymentCopy({amountKopecks:50000,operationAt:at,method:'TERM_SBP',now}).body,/через СБП/);
 assert.doesNotMatch(terminalPaymentCopy({amountKopecks:50000,operationAt:at,now:new Date('2026-10-27T09:00:00Z')}).body,/Сегодня/);
});
test('help is saved once and does not close the fiscal problem or reinterpret help as a missing-check claim',async()=>{
 const events:any[]=[];const review:any={id:'r',employeeId:5,status:'open',amountKopecks:50000,bankOperationAt:at,notifications:[{body:terminalPaymentCopy({amountKopecks:50000,operationAt:at,receiptNumber:'000413',method:'TERM_CARD',now}).body}],participants:[{id:'p',userId:5,response:'pending',user:{name:'Абшаева Зухра'}}]};
 const db:any={$transaction:(f:any)=>f(db),terminalFiscalEmployeeReview:{findFirst:async()=>review.status==='open'?review:null},terminalFiscalReviewParticipant:{update:async({data}:any)=>Object.assign(review.participants[0],data)},adminInboxEvent:{upsert:async({where,create,update}:any)=>{const e=events.find(e=>e.eventKey===where.eventKey);if(e)return Object.assign(e,update);events.push(create);return{id:'e',...create}}},user:{findMany:async()=>[{id:1}]},adminInboxReceipt:{createMany:async()=>({count:1})}};
 for(let i=0;i<2;i++)await applyTerminalFiscalEmployeeAction({prisma:db,userId:5,reviewId:'r',action:'help',now});
 assert.equal(events.length,1);assert.equal(review.status,'open');assert.equal(review.participants[0].response,'help');
 assert.equal(events[0].type,TERMINAL_FISCAL_HELP_TYPE);assert.equal(events[0].title,'Абшаева Зухра просит помочь · 500 ₽');
 assert.match(events[0].body,/16:42/);assert.match(events[0].body,/000413/);assert.doesNotMatch(events[0].body,/не находит/);
 review.messages=[{id:'new-admin-answer'}];
 await applyTerminalFiscalEmployeeAction({prisma:db,userId:5,reviewId:'r',action:'help',now});assert.equal(events.length,2,'a fresh request after an administrator reply gets its own delivery cycle');
 review.status='resolved';await assert.rejects(()=>applyTerminalFiscalEmployeeAction({prisma:db,userId:5,reviewId:'r',action:'help',now}),/REVIEW_NOT_AVAILABLE/);
});
test('help has its own eligible push, never a common-digest entry',()=>{
 assert.equal(adminInboxEventMeta(TERMINAL_FISCAL_HELP_TYPE).category,'messages');
 assert.equal(adminInboxSourceState({sourceType:'terminal_fiscal_review',eventType:TERMINAL_FISCAL_HELP_TYPE,businessStatus:'open',reasonCode:'SOURCE_OFD_UNAVAILABLE'}).active,true);
 assert.ok(eligibleAdminInboxWebPushTypes(now).includes(TERMINAL_FISCAL_HELP_TYPE));assert.ok(!(ATTENTION_PUSH_TYPES as readonly string[]).includes(TERMINAL_FISCAL_HELP_TYPE));
});
test('extra minute checks only cover current/past open days, and regular ticks retain the old cadence',()=>{
 assert.equal(terminalFiscalIsRegularTick(new Date('2026-10-26T15:32:00Z')),true);
 assert.equal(terminalFiscalIsRegularTick(now),false);
 assert.deepEqual(terminalFiscalPendingPeriods([],now),[]);
 const periods=terminalFiscalPendingPeriods([at,at,new Date('2026-10-18'),new Date('2026-10-27T12:00:00Z')],now);
 assert.equal(periods.length,1);assert.equal(+periods[0].periodTo,+now);assert.equal(periods[0].periodFrom.toISOString(),'2026-10-25T21:00:00.000Z');
});
test('actual dispatcher sends dedicated help before digest, once per device, and skips already-resolved help',async()=>{
 const deliveries:any[]=[];const payloads:any[]=[];const order:string[]=[];let active=true;
 const event={id:'help-event',type:TERMINAL_FISCAL_HELP_TYPE,createdAt:now,sourceType:'terminal_fiscal_review',sourceId:'r',href:'/admin/workday/payment-checks/r',...terminalFiscalHelpCopy({name:'Абшаева Зухра',amountKopecks:50000,operationAt:at,receiptNumber:'000413'})};
 const db:any={adminInboxReceipt:{findMany:async()=>[{event,readAt:null,eventId:event.id,userId:1,user:{pushSubscriptions:[{id:7,createdAt:new Date('2026-01-01'),endpoint:'fake',p256dh:'fake',auth:'fake'}]}}]},adminInboxDelivery:{upsert:async()=>{if(!deliveries.length)deliveries.push({id:'d',status:'pending',attemptCount:0});return deliveries[0]},updateMany:async({data}:any)=>{Object.assign(deliveries[0],data);return{count:1}},update:async({data}:any)=>Object.assign(deliveries[0],data)}};
 const mocks:any={'server-only':{},'@/lib/prisma':{prisma:db},'./admin-inbox-data':{loadAdminInbox:async()=>({attentionCount:active?1:0,attention:active?[{event}]:[]})},'@/lib/admin-inbox-data':{loadAdminInbox:async()=>({attentionCount:active?1:0,attention:active?[{event}]:[]})},'./admin-inbox-attention-push':{dispatchAdminAttentionPush:async()=>{order.push('digest');return{receipts:0,sent:0,failed:0}}},'./push-attempt-observation':{observePushAttempt:async(_:any,f:any)=>f()},'web-push':{setVapidDetails:()=>{},sendNotification:async(_:any,payload:string)=>{order.push('help');payloads.push(JSON.parse(payload));}}};
 const out=await build({entryPoints:['lib/admin-inbox-web-push.ts'],bundle:true,write:false,format:'cjs',platform:'node',packages:'external',plugins:[{name:'mock',setup(b){b.onResolve({filter:/.*/},a=>a.path in mocks?{path:a.path,external:true}:undefined)}}]});
 const mod={exports:{} as any},req=createRequire(import.meta.url);new Function('require','module','exports',out.outputFiles[0].text)((n:string)=>mocks[n]??req(n),mod,mod.exports);
 const before=[process.env.WEB_PUSH_VAPID_PUBLIC_KEY,process.env.WEB_PUSH_VAPID_PRIVATE_KEY];process.env.WEB_PUSH_VAPID_PUBLIC_KEY='fake';process.env.WEB_PUSH_VAPID_PRIVATE_KEY='fake';
 try{await mod.exports.dispatchAdminInboxWebPush(now);await mod.exports.dispatchAdminInboxWebPush(now);
 assert.equal(payloads.length,1);assert.deepEqual(order.slice(0,2),['help','digest']);assert.equal(payloads[0].notificationId,'help-event');assert.match(payloads[0].title,/Зухра просит помочь/);assert.match(payloads[0].body,/000413/);assert.equal(payloads[0].renotify,true);
 active=false;deliveries.length=0;await mod.exports.dispatchAdminInboxWebPush(now);assert.equal(payloads.length,1);
 }finally{for(const [i,key]of ['WEB_PUSH_VAPID_PUBLIC_KEY','WEB_PUSH_VAPID_PRIVATE_KEY'].entries()){if(before[i]===undefined)delete process.env[key];else process.env[key]=before[i];}}
});

test('automatic retirement GET is private, owner-scoped and never writes or starts a fiscal run',async()=>{
 let current:any={id:5,role:'EMPLOYEE'},reads=0;
 const db={terminalFiscalEmployeeReview:{findFirst:async({where,select}:any)=>{reads++;assert.deepEqual(select,{status:true});return where.id==='own'&&where.OR.some((o:any)=>o.employeeId===5||o.participants?.some.userId===5)?{status:'resolved'}:null;}}};
 const mocks:any={'@/lib/auth':{getCurrentUser:async()=>current},'@/lib/prisma':{prisma:db},'@/lib/terminal-fiscal-review-actions':{applyTerminalFiscalEmployeeAction:()=>{throw Error('GET must never write')}}};
 const out=await build({entryPoints:['app/api/employee/payment-checks/[id]/actions/route.ts'],bundle:true,write:false,format:'cjs',platform:'node',packages:'external',plugins:[{name:'mock',setup(b){b.onResolve({filter:/.*/},a=>a.path in mocks?{path:a.path,external:true}:undefined)}}]});
 const mod={exports:{} as any};new Function('require','module','exports',out.outputFiles[0].text)((n:string)=>mocks[n],mod,mod.exports);
 const get=()=>mod.exports.GET(new Request('http://localhost/actions'),{params:Promise.resolve({id:'own'})});
 let response=await get();assert.deepEqual(await response.json(),{status:'resolved'});assert.equal(response.headers.get('cache-control'),'private, no-store');
 current={id:6,role:'EMPLOYEE'};assert.equal((await get()).status,404);
 const before=reads;current={id:1,role:'ADMIN'};assert.equal((await get()).status,403);current=null;assert.equal((await get()).status,403);assert.equal(reads,before);
});
