import test from 'node:test';
import assert from 'node:assert/strict';
import { employeeReviewState, orderEmployeeAttention, type EmployeeAttentionItem } from '../lib/employee-attention';
test('a new admin reply brings a waiting shared review back to action', () => {
  assert.equal(employeeReviewState({ response: 'help', adminRepliedAfterResponse: false }).state, 'waiting');
  assert.equal(employeeReviewState({ response: 'help', adminRepliedAfterResponse: true }).state, 'action');
  assert.equal(employeeReviewState({ handler: 'Лиана', adminRepliedAfterResponse: false }).status, 'Проверяет Лиана');
  assert.equal(employeeReviewState({ response: 'not_mine', adminRepliedAfterResponse: false }).state, 'waiting');
});
test('one entity remains one row and waiting never displaces work requiring action', () => {
  const row = (id: string, state: 'action'|'waiting', priority: number, date: string): EmployeeAttentionItem => ({id,state,priority,date,kind:'receipt',title:id,status:'',detail:''});
  const items = orderEmployeeAttention([row('wait','waiting',0,'2026-10-15'),row('new','action',1,'2026-10-18'),row('old','action',1,'2026-10-17'),row('new','action',1,'2026-10-18')]);
  assert.deepEqual(items.map(i=>i.id),['old','new','wait']);
});
