import test from 'node:test';
import assert from 'node:assert/strict';
import {compareTeamRows,teamRowStatus,type TeamStatusRow} from '../lib/team-control-order';
const row=(values:Partial<TeamStatusRow>={}):TeamStatusRow=>({id:1,name:'Сотрудник',state:'План неизвестен',start:'—',end:'—',planState:'unknown',sourceUnavailable:false,missing:false,...values});
test('working covers both Google and app marks, even without a plan',()=>{
  assert.equal(teamRowStatus(row({state:'Работает',start:'09:00'})),'working');
  assert.equal(teamRowStatus(row({state:'Работает',start:'09:00',sourceUnavailable:true})),'working');
});
test('completion wins over stale work plans; earlier arrival does not imply working now',()=>{
  assert.equal(teamRowStatus(row({state:'Завершил · 19:00',start:'09:00',end:'19:00',planState:'off'})),'finished');
  assert.equal(teamRowStatus(row({state:'Приход отмечен',start:'09:00'})),'arrival');
  assert.equal(teamRowStatus(row({state:'Не завершил смену',start:'09:00'})),'unfinished');
});
test('unknown source, absent plan and not-yet-due start are never missing marks',()=>{
  assert.equal(teamRowStatus(row({planState:'working',state:'Ожидается начало'})),'expected');
  assert.equal(teamRowStatus(row()),'unknown');
  assert.equal(teamRowStatus(row({sourceUnavailable:true,planState:'working'})),'unavailable');
  assert.equal(teamRowStatus(row({missing:true,planState:'working',state:'Не отметился'})),'missing');
  assert.equal(teamRowStatus(row({planState:'off',state:'Выходной'})),'off');
  assert.equal(teamRowStatus(row({planState:'vacation',state:'Отпуск'})),'vacation');
});
test('working comes first, then missing and finished; ties are stable by Russian name',()=>{
  const rows=[row({id:1,name:'Яна',planState:'off',state:'Выходной'}),row({id:2,name:'Милана',state:'Работает',start:'10:48'}),row({id:3,name:'Зухра'}),row({id:4,name:'Лиана',state:'Работает',start:'08:54'}),row({id:5,name:'Анна',state:'Не отметился',planState:'working',missing:true}),row({id:6,name:'Ирина',end:'17:00'})];
  assert.deepEqual([...rows].sort(compareTeamRows).map(r=>r.id),[4,2,5,6,1,3]);
  assert.deepEqual(rows.map(r=>r.id),[1,2,3,4,5,6]);
});
