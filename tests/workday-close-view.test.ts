import assert from 'node:assert/strict';
import test from 'node:test';
import { hasTechnicalWorkdayClose, technicalWorkdayCloseTime } from '../lib/workday-close-view';

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
