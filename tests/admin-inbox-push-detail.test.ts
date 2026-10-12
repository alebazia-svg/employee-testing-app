import assert from 'node:assert/strict';
import test from 'node:test';
import { attentionDigestText, pushIdentity, type AttentionItem } from '../lib/admin-inbox-attention-policy';
function item(id:string, name='Мира',amount=2800):AttentionItem {
  return {id,readAt:null,meta:{category:'requests'},sourceState:{active:true},event:{type:'expense_request.created',sourceType:'expense_request',sourceId:id,occurredAt:'2026-10-12T10:00:00Z',href:`/admin/expense-requests/${id}`,push:{identity:pushIdentity(name,amount),detail:'№ 123. Заправка картриджа',action:'Согласовать расход'}}};
}
test('one request identifies person, amount and purpose, and links directly; repeat stays concrete',()=>{
  const one=item('a');const fresh=attentionDigestText([one]);
  assert.ok(fresh.title.includes('Мира · 2 800 ₽'));
  assert.ok(fresh.body.includes('Заправка картриджа'));
  assert.equal(fresh.url,'/admin/expense-requests/a');
  const repeat=attentionDigestText([one],{ids:['a'],repeat:true});
  assert.ok(repeat.title.startsWith('Напоминание: Мира'));
  assert.ok(!repeat.body.includes('Новое.'));
  one.event.urgency={key:'shift',at:'2026-10-12T11:00:00Z',label:'Пересчёт',phase:'upcoming'};
  one.event.deadline='Решить до 14:00 · Пересчёт кассы';
  const urgent=attentionDigestText([one],{ids:['a'],repeat:true});
  assert.ok(urgent.title.startsWith('Срочно: Мира'));
  assert.ok(urgent.body.includes('14:00'));
});
test('a new request is not hidden behind an old urgent one; exactly two lines and remaining count',()=>{
  const older=item('old','Чеченова',5000);older.event.urgency={key:'due',at:'2026-10-12T09:00:00Z',label:'Смена',phase:'due'};
  const newer=item('new');newer.event.push!.reference='123';newer.event.occurredAt='2026-10-12T11:00:00Z';
  const text=attentionDigestText([older,item('other'),newer,item('fourth')],{ids:['old','other','fourth'],repeat:true});
  assert.ok(text.body.startsWith('Новое · Мира'));
  assert.ok(text.body.includes('Срочно · Чеченова'));
  assert.ok(text.body.includes('№ 123'));
  assert.ok(text.body.endsWith('Ещё 2 требуют решения'));
  assert.equal(text.body.split('\n').length,3);
  assert.equal(text.url,'/admin/inbox?view=attention');
});
test('unavailable amounts are not invented and long comments cannot displace deadline or escape local links',()=>{
  assert.ok(pushIdentity(null,null).includes('сумма не указана'));
  assert.ok(pushIdentity('Кассир',0).includes('0 ₽'));
  const one=item('a','Очень длинное имя '.repeat(30));
  one.event.push!.detail='Комментарий\n'.repeat(100);one.event.deadline='До 18:00';
  for(const href of ['https://evil.example','//evil.example','/admin/../employee','/admin/requests\\evil']){
    one.event.href=href;
    assert.equal(attentionDigestText([one]).url,'/admin/inbox?view=attention');
  }
  const text=attentionDigestText([one]);assert.ok(text.title.length<=110);assert.ok(text.body.length<240);assert.ok(text.body.endsWith('До 18:00'));
});
