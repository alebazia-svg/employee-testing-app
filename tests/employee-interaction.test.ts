import test from 'node:test';
import assert from 'node:assert/strict';
import {parseActivityInput} from '../lib/employee-activity-policy';
import {buildAuditTimeline} from '../lib/employee-audit-timeline';
const d=(t:string)=>new Date(`2026-10-25T${t}:00+03:00`);
const notice={id:11,title:'Проверить чек',body:'Сообщение',kind:'receipt',fingerprint:'test:11',sentAt:d('10:00'),taskId:null,issueId:3,reviewId:null,pushDeliveredAt:d('10:00')};
const event=(id:string,stage:string,time:string,ref='11',target='notification')=>({id,kind:'interaction',section:'notifications',notificationId:null,createdAt:d(time),context:{target,ref,stage}});
test('strict bounded context rejects raw text, forged results and malformed identifiers',()=>{
 const base={key:'audit-test-001',kind:'interaction',context:{target:'issue',ref:'3',stage:'open'}};
 assert.ok(parseActivityInput(base));
 for(const context of [{...base.context,text:'secret'}, {...base.context,stage:'completed'}, {...base.context,ref:'0'}, {...base.context,ref:'3/inject'}, {...base.context,stage:'error',message:'arbitrary sensitive text'}])assert.equal(parseActivityInput({...base,context}),null);
});
test('notification and direct receipt actions form one episode without duplicated legacy click',()=>{
 const events=[event('one','open','10:01'),event('card','open','10:01','3','issue'),event('two','error','10:02','3','issue'),event('three','retry','10:03','3','issue'),event('four','open','10:04'),{...event('old','open','10:01'),kind:'notification_open',notificationId:11}];
 const result=buildAuditTimeline(events,[notice],'2026-10-25',[{id:'issue:3',title:'Чек',result:'Вопрос закрыт системой',at:d('10:05').toISOString()}]);
 assert.equal(result.length,1);assert.equal(result[0].steps.length,7);assert.equal(result[0].unopened,false);
 assert.equal(result[0].steps.filter(s=>s.opened==='notification').length,2);
 assert.equal(result[0].steps.filter(s=>s.opened==='card').length,1);
 assert.equal(result[0].steps.at(-1)?.origin,'system');assert.ok(result[0].steps.some(s=>s.tone==='error'));
});
test('an old notification opened today does not become a new sent notification today',()=>{
 const result=buildAuditTimeline([event('one','open','10:01')],[{...notice,sentAt:new Date('2026-10-24T10:00:00+03:00')}],'2026-10-25');
 assert.equal(result[0].steps.length,1);assert.equal(result[0].notice,'Сообщение');
});
test('client acceptance never implies confirmed financial execution; visits stay separate',()=>{
 const result=buildAuditTimeline([event('one','accepted','10:01','3','issue'),{...event('visit','open','10:02'),kind:'visit',section:'schedule'}],[notice],'2026-10-25');
 assert.equal(result.length,2);assert.equal(result[0].result,undefined);assert.equal(result[0].unopened,true);assert.equal(result[1].visits,true);
});

test('an old notification shown today stays unopened until a recorded opening',()=>{
 const old={...notice,sentAt:new Date('2026-10-24T10:00:00+03:00')};
 const shown=event('visible','shown','10:01');
 const result=buildAuditTimeline([shown],[old],'2026-10-25');
 assert.equal(result[0].unopened,true);assert.equal(result[0].steps.length,1);
 assert.equal(buildAuditTimeline([shown,event('open','open','10:02')],[old],'2026-10-25')[0].unopened,false);
});

test('cash request visibility and notification visibility remain distinct in one episode',()=>{
 const cashNotice={...notice,issueId:null,kind:'employee_expense_payable',fingerprint:'employee:expense:payable:cash-ref'};
 const rows=buildAuditTimeline([event('notice-shown','shown','10:01'),event('cash-shown','shown','10:02','cash-ref','cash')],[cashNotice],'2026-10-25');
 assert.equal(rows.length,1);
 assert.equal(rows[0].steps.find(s=>s.id==='notice-shown')?.label,'Сообщение появилось в видимой области приложения');
 assert.equal(rows[0].steps.find(s=>s.id==='cash-shown')?.label,'Заявка показалась на экране');
 assert.equal(rows[0].result,undefined);
});
