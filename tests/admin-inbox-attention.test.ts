import assert from 'node:assert/strict';
import test from 'node:test';
import { selectAdminAttention, paymentReminderTiming, attentionDay, digestDue, attentionDigestText, type AttentionItem } from '../lib/admin-inbox-attention-policy';
const now = new Date('2026-10-12T09:00:00Z');
function item(id: string, sourceType = 'expense_request', active = true): AttentionItem {
  return { id, readAt: null, event: { type: sourceType === 'expense_request' ? 'expense_request.created' : sourceType, sourceType, sourceId: id, occurredAt: '2026-10-01T09:00:00Z' }, meta: { category: 'requests' }, sourceState: { active } };
}
test('many new technical events cannot displace an old read but unresolved request', () => {
  const request = { ...item('old'), readAt: '2026-10-01T10:00:00Z' };
  const noise = Array.from({length:250}, (_,i) => ({...item(`noise-${i}`, 'infrastructure'), meta:{category:'system'}}));
  assert.deepEqual(selectAdminAttention([...noise, request]), [request]);
  assert.equal(selectAdminAttention([{...request, sourceState:{active:false}}]).length, 0);
});
test('each business object appears once; cash precedes procurement and old requests stay visible', () => {
  const old = item('first');
  const update = {...old, id:'second', event:{...old.event, occurredAt:'2026-10-02T09:00:00Z'}};
  assert.deepEqual(selectAdminAttention([item('plan','supplier_payment_plan'), old, update]).map(i=>i.id), ['second','plan']);
  assert.equal(selectAdminAttention([item('done','expense_request',false)]).length,0);
});
test('fiscal reviews stay actionable after reading and disappear only when resolved', () => {
  const review = {...item('review','terminal_fiscal_review'),meta:{category:'decisions'},event:{...item('review').event,sourceType:'terminal_fiscal_review',type:'terminal_fiscal_review.created'}};
  assert.equal(selectAdminAttention([review]).length,1);
  assert.equal(selectAdminAttention([{...review,readAt:now.toISOString()}]).length,1);
  assert.equal(selectAdminAttention([{...review,sourceState:{active:false}}]).length,0);
  assert.equal(selectAdminAttention([{...review,event:{...review.event,type:'terminal_fiscal_review.employee_message'}}]).length,1);
});
test('an old pending request is picked up after downtime or next morning, without a thirty-minute expiry', () => {
  assert.ok(digestDue({items:[item('a')],previous:{ids:[],repeat:false},sentAt:null,now}));
  assert.equal(digestDue({items:[item('a')],previous:{ids:[],repeat:false},sentAt:null,now:new Date('2026-10-12T19:00:00Z')}),null);
  assert.ok(digestDue({items:[item('a')],previous:{ids:['a'],repeat:true},sentAt:now,now:new Date('2026-10-13T06:00:00Z')}));
});
test('bursts coalesce, first reminder at 15 minutes, then no more than hourly', () => {
  const state = {items:[item('a')],previous:{ids:['a'],repeat:false},sentAt:now,now};
  assert.equal(digestDue({...state,now:new Date(+now+14*60000)}),null);
  assert.deepEqual(digestDue({...state,now:new Date(+now+15*60000)}),{ids:['a'],repeat:true});
  assert.equal(digestDue({...state,previous:{ids:['a'],repeat:true},now:new Date(+now+59*60000)}),null);
  assert.ok(digestDue({...state,previous:{ids:['a'],repeat:true},now:new Date(+now+60*60000)}));
  assert.equal(digestDue({...state,items:[item('a'),item('b')],now:new Date(+now+4*60000)}),null);
  assert.deepEqual(digestDue({...state,items:[item('a'),item('b')],now:new Date(+now+5*60000)}),{ids:['a','b'],repeat:false});
  assert.equal(digestDue({...state,items:[],now:new Date(+now+120*60000)}),null);
});
test('replacement summary names two concrete tasks and counts the remainder', () => {
  const text = attentionDigestText([item('a'),item('b','procurement_delivery_request'),item('c','supplier_payment_plan'),item('d','workday_close_exception')]);
  assert.equal(text.title,'Требуют внимания: 4');
  assert.equal(text.body.split('\n').length, 3);
  assert.ok(text.body.includes('Ещё 2 требуют решения'));
  assert.equal(text.url, '/admin/inbox?view=attention');
});

test('money decisions precede other tasks and future plans; newest first within priority', () => {
  const old = item('old');
  const newest = {...item('buyer','procurement_delivery_request'),event:{...item('buyer','procurement_delivery_request').event,occurredAt:now.toISOString()}};
  assert.deepEqual(selectAdminAttention([item('plan','supplier_payment_plan'),old,item('close','workday_close_exception'),newest]).map(i=>i.id),['buyer','old','close','plan']);
});
test('payment window follows Moscow calendar, includes tomorrow/today/overdue, never hides invalid dates', () => {
  assert.equal(attentionDay(new Date('2026-10-12T21:00:00Z')),'2026-10-13');
  assert.equal(paymentReminderTiming('2026-10-14',now).active,false);
  assert.equal(paymentReminderTiming('2026-10-13',now).label,'Оплата завтра');
  assert.equal(paymentReminderTiming(new Date('2026-10-12T00:00:00Z'),now).label,'Оплата сегодня');
  assert.equal(paymentReminderTiming('2026-10-11',now).label,'Срок оплаты прошёл');
  assert.equal(paymentReminderTiming('2026-10-14',new Date('2026-10-12T21:00:00Z')).active,true);
  for (const date of [undefined,'bad','2026-02-30',new Date('invalid')]) assert.equal(paymentReminderTiming(date,now).label,'Проверьте срок оплаты');
});
test('planned payments alone repeat next day, but new money requests still arrive promptly', () => {
  const base={items:[item('plan','supplier_payment_plan')],previous:{ids:['plan'],repeat:false},sentAt:now};
  assert.equal(digestDue({...base,now:new Date(+now+15*60000)}),null);
  assert.equal(digestDue({...base,now:new Date(+now+4*3600000)}),null);
  assert.ok(digestDue({...base,now:new Date('2026-10-13T06:00:00Z')}));
  assert.ok(digestDue({...base,items:[...base.items,item('new')],now:new Date(+now+5*60000)}));
});

test('temporary disappearance never makes a previously delivered request new again',()=>{
  const previous={ids:['a','b'],repeat:true};
  const withoutA=digestDue({items:[item('b')],previous,sentAt:now,now:new Date(+now+60*60000)})!;
  assert.deepEqual(withoutA.seen,['a','b']);
  const restored=[item('a'),item('b')];
  assert.equal(digestDue({items:restored,previous:withoutA,sentAt:new Date(+now+60*60000),now:new Date(+now+65*60000)}),null);
  assert.ok(!attentionDigestText(restored,withoutA).body.includes('Новое'));
  assert.ok(digestDue({items:[...restored,item('genuinely-new')],previous:withoutA,sentAt:new Date(+now+60*60000),now:new Date(+now+65*60000)}));
});
test('unresolved technical incidents and legacy aggregates never count as owner tasks',()=>{
  const technical={...item('outage','dependency'),meta:{category:'system'},event:{...item('outage','dependency').event,technicalAttention:true}};
  const legacy={...technical,id:'system:prolonged:2026-10-12',event:{...technical.event,type:'admin.system_attention',sourceType:'system_attention'}};
  for (const readAt of [null,now.toISOString()]) {
    assert.deepEqual(selectAdminAttention([{...technical,readAt},legacy,item('cash')]).map(x=>x.id),['cash']);
    assert.equal(selectAdminAttention([{...technical,readAt},legacy]).length,0);
  }
});

test('deadline evidence disappearing temporarily cannot restart urgent reminders',()=>{
 const urgent={...item('a'),event:{...item('a').event,urgency:{key:'closing',at:now.toISOString(),label:'Закрытие',phase:'due' as const}}};
 const sent=digestDue({items:[urgent,item('b')],previous:{ids:[],repeat:false},sentAt:null,now})!;
 const missing=digestDue({items:[item('b')],previous:sent,sentAt:now,now:new Date(+now+60*60000)})!;
 assert.deepEqual(missing.signals,sent.signals);
 assert.equal(digestDue({items:[urgent,item('b')],previous:missing,sentAt:new Date(+now+60*60000),now:new Date(+now+65*60000)}),null);
});
