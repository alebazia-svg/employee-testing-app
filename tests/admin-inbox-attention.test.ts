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
test('automatic checks stay out but employee messages remain actionable', () => {
  const review = {...item('review','terminal_fiscal_review'),meta:{category:'decisions'},event:{...item('review').event,sourceType:'terminal_fiscal_review',type:'terminal_fiscal_review.created'}};
  assert.equal(selectAdminAttention([review]).length,0);
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
test('replacement summary includes every category, not just the newest request', () => {
  const text = attentionDigestText([item('a'),item('b','procurement_delivery_request'),item('c','supplier_payment_plan'),item('d','workday_close_exception')]);
  assert.equal(text.title,'Требуют внимания: 4');
  for(const word of ['Расходные заявки: 1','Подотчёт: 1','Закупки: 1','Другие дела: 1']) assert.ok(text.body.includes(word));
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
