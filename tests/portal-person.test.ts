import test from 'node:test';
import assert from 'node:assert/strict';
import { portalPersonName, portalPersonInitials, portalMessageAuthor } from '../lib/portal-person';
import { employeeReplyMessageId, employeeReplyCopy } from '../lib/employee-reply-author';
test('generic account uses its existing linked canonical identity without reordering or hardcoding', () => {
  assert.equal(portalPersonName({ name:'Администратор',payrollName:'Кештова Бэла'}),'Кештова Бэла');
  assert.equal(portalPersonName({ name:' admin ',payrollName:'Сидоров Иван'}),'Сидоров Иван');
  assert.equal(portalPersonName({ name:'Петрова Анна',payrollName:'Другая запись'}),'Петрова Анна');
  assert.equal(portalPersonName({ name:'Администратор'}),'Администратор');
  assert.equal(portalPersonInitials('Кештова Бэла'),'КБ');
  assert.deepEqual(portalMessageAuthor({author:{name:'Администратор',payrollName:'Сидоров Иван'},createdAt:'2026-10-22T10:00:00Z'}),{name:'Сидоров Иван',at:'2026-10-22T10:00:00.000Z'});
});
test('saved reply identity is bound to the exact message and entity, not the last administrator', () => {
  const issue={kind:'workday_issue_reply',fingerprint:'workday-issue:12:admin-message:first',issueId:12,reviewId:null};
  assert.equal(employeeReplyMessageId(issue),'first');
  assert.equal(employeeReplyMessageId({...issue,issueId:13}),null);
  const review={kind:'terminal_fiscal_review_reply',fingerprint:'terminal-fiscal-review:review1:admin-message:second:7',issueId:null,reviewId:'review1'};
  assert.equal(employeeReplyMessageId(review),'second');
  assert.equal(employeeReplyMessageId({...review,reviewId:'other'}),null);
  assert.deepEqual(employeeReplyCopy(review.kind,{body:'Проверьте документ.',author:{name:'Сидоров Иван'}}),{title:'Ответ по чеку',body:'Сидоров Иван: Проверьте документ.'});
  assert.equal(employeeReplyCopy(issue.kind).body,undefined);
});
