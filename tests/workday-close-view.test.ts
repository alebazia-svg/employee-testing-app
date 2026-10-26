import assert from 'node:assert/strict';
import test from 'node:test';
import { completedWithoutEncashment, handoverClosedByAdmin, belongsInOperationalTaskOverview, hasTechnicalWorkdayClose, technicalWorkdayCloseTime, workdayTaskProgressLabel } from '../lib/workday-close-view';

test('completed non-encashment label uses persisted handover evidence, including after reload', () => {
  const handoverData = { personalCash: { encashmentExceptionRequestId: 'approved-request' } };
  assert.equal(completedWithoutEncashment({ status: 'done', handoverData }), true);
  assert.equal(completedWithoutEncashment(JSON.parse(JSON.stringify({ status: 'done', handoverData }))), true);
  assert.equal(completedWithoutEncashment({ status: 'pending', handoverData }), false);
  for (const value of [null, {}, [], { personalCash: {} }, { personalCash: { encashmentExceptionRequestId: null } }, { personalCash: { encashmentExceptionRequestId: '' } }]) {
    assert.equal(completedWithoutEncashment({ status: 'done', handoverData: value }), false);
  }
});

test('technical workday close recognizes current and historical audit markers', () => {
  assert.equal(hasTechnicalWorkdayClose({ comment: 'Предыдущий рабочий день закрыт позже. Обязательные шаги пропущены.' }), true);
  assert.equal(hasTechnicalWorkdayClose({ comment: '' }, { closingComment: 'Закрыт без сдачи смены' }), true);
  assert.equal(hasTechnicalWorkdayClose({ comment: 'Закрыт позже без сдачи смены' }), true);
});

test('ordinary and explicitly early shift closes are not technical closes', () => {
  assert.equal(hasTechnicalWorkdayClose({ comment: null }), false);
  assert.equal(hasTechnicalWorkdayClose({ comment: 'Согласованное досрочное завершение' }), false);
});

test('technical closure timestamp is shown as a Moscow audit time with date', () => {
  assert.match(technicalWorkdayCloseTime('2026-09-03T06:42:00.000Z'), /3 сентября 2026 г.*09:42/);
  assert.equal(technicalWorkdayCloseTime(null), 'не указано');
});

test('missed tasks from a technical close stay in audit but leave the operational overview', () => {
  assert.equal(belongsInOperationalTaskOverview('missed', true), false);
  assert.equal(belongsInOperationalTaskOverview('done', true), true);
  assert.equal(belongsInOperationalTaskOverview('missed', false), true);
});

test('technical close summary describes missed steps instead of unfinished progress', () => {
  assert.equal(workdayTaskProgressLabel({ completed: 0, missed: 5, total: 5, technicalClose: true }), 'Пропущено шагов: 5');
  assert.equal(workdayTaskProgressLabel({ completed: 3, missed: 0, total: 5, technicalClose: false }), 'Выполнено 3 из 5');
  assert.equal(workdayTaskProgressLabel({ completed: 0, missed: 0, total: 0, technicalClose: false }), 'Проверок пока нет');
});


test('administrator closure requires persisted permission and never fabricates ordinary completion', () => {
  const task = {category:'handover',status:'missed',handoverData:{personalCash:{cashBalance:11450},adminClosure:{requestId:'approved',adminId:1,closedAt:'2026-10-26T15:31:38Z'}}};
  assert.equal(handoverClosedByAdmin(task),true);
  assert.equal(handoverClosedByAdmin(JSON.parse(JSON.stringify(task))),true);
  assert.equal(task.status,'missed');
  assert.equal(handoverClosedByAdmin({...task,category:'cash'}),false);
  assert.equal(handoverClosedByAdmin({...task,status:'pending'}),false);
  for(const invalid of [null,{}, {requestId:'',adminId:1,closedAt:'2026-10-26T15:31:38Z'}, {requestId:'approved',adminId:0,closedAt:'2026-10-26T15:31:38Z'}, {requestId:'approved',adminId:1,closedAt:'bad'}]) {
    assert.equal(handoverClosedByAdmin({...task,handoverData:{adminClosure:invalid}}),false);
  }
});
