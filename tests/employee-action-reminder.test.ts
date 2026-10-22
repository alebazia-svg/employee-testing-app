import assert from 'node:assert/strict';
import test from 'node:test';
import { employeeActionReminder, type ReminderWorkday } from '../lib/employee-action-reminder';
import type { EmployeeAttentionItem } from '../lib/employee-attention';

const now = new Date('2026-10-22T12:00:00Z');
const fixture = (): ReminderWorkday => ({
  workDay: { status: 'active', date: '2026-10-22', endedAt: null },
  unfinishedWorkDay: null,
  shiftControl: { run: { date: '2026-10-22', status: 'active' }, tasks: [
    { id: 1, title: 'Пересчитать наличные', category: 'cash', status: 'pending', sortOrder: 1, plannedTimeMinutes: 900 },
    { id: 2, title: 'Сдать смену', category: 'handover', status: 'pending', sortOrder: 2, plannedTimeMinutes: 1200 },
  ] },
});
const issue = (state: 'action' | 'waiting'): EmployeeAttentionItem => ({ id: 'issue:7', title: 'Чек', kind: 'receipt', state, status: '', priority: 0, date: '2026-10-22', detail: '', notificationIds: [] });
test('a task becomes actionable at the exact planned Moscow minute', () => {
  assert.equal(employeeActionReminder(fixture(), [], now)?.id, 'task:1');
  assert.equal(employeeActionReminder(fixture(), [], new Date('2026-10-22T11:59:00Z')), null);
});
test('actual completion removes the reminder without notification reads', () => {
  const data = fixture(); data.shiftControl.tasks[0].status = 'done';
  assert.equal(employeeActionReminder(data, [], now), null);
});
test('notification read state never closes an unresolved issue', () => {
  const item = issue('action');
  assert.equal(employeeActionReminder(fixture(), [item], now)?.id, 'issue:7');
  assert.equal(employeeActionReminder(fixture(), [{ ...item, notificationIds: [12] }], now)?.id, 'issue:7');
});
test('waiting for the administrator is not an employee action', () => {
  assert.equal(employeeActionReminder(fixture(), [issue('waiting')], now)?.id, 'task:1');
});
test('closed, ended and previous-day shifts do not produce current checklist reminders', () => {
  for (const mutate of [
    (data: ReminderWorkday) => { data.workDay!.endedAt = now; },
    (data: ReminderWorkday) => { data.workDay!.status = 'completed'; },
    (data: ReminderWorkday) => { data.workDay!.date = '2026-10-21'; },
    (data: ReminderWorkday) => { data.shiftControl.run!.status = 'completed'; },
    (data: ReminderWorkday) => { data.shiftControl.run!.completedAt = now; },
    (data: ReminderWorkday) => { data.shiftControl.run!.date = '2026-10-21'; },
    (data: ReminderWorkday) => { data.unfinishedWorkDay = { date: '2026-10-21' }; },
  ]) { const data = fixture(); mutate(data); assert.equal(employeeActionReminder(data, [], now), null); }
});
test('no snapshot does not invent a task or a zero result', () => {
  assert.equal(employeeActionReminder(null, null, now), null);
});
test('the first due task follows the actual checklist order', () => {
  const data = fixture(); data.shiftControl.tasks.reverse(); data.shiftControl.tasks[0].plannedTimeMinutes = null;
  assert.equal(employeeActionReminder(data, [], now)?.id, 'task:1');
});
test('an issue links to the existing exact attention detail', () => {
  assert.equal(employeeActionReminder(null, [issue('action')], now)?.href, '/employee?attention=receipt&item=issue%3A7');
});
test('cash issuance uses the authorized request and its existing native entry point', () => {
  const item: EmployeeAttentionItem = { ...issue('action'), id: 'cash-issue:abc', kind: 'cash_issue', title: 'Выдать Астемиру 30 000 ₽' };
  const result = employeeActionReminder(fixture(), [item], now);
  assert.equal(result?.title, item.title);
  assert.equal(result?.target, 'cash_issue');
  assert.equal(result?.href, '/employee?cashIssue=abc');
});
test('the shared action priority and waiting state apply across all supported kinds', () => {
  const receipt = { ...issue('action'), priority: 2 };
  for (const kind of ['cash', 'encashment', 'closing', 'cash_issue'] as const) {
    const item: EmployeeAttentionItem = { ...issue('action'), id: `${kind}:7`, kind, priority: 0 };
    assert.equal(employeeActionReminder(null, [receipt, item], now)?.id, item.id);
    assert.equal(employeeActionReminder(null, [{ ...item, state: 'waiting' }], now), null);
  }
});
