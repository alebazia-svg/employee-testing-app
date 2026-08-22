import assert from 'node:assert/strict';
import test from 'node:test';
import { adminInboxActionLabel, adminInboxEventMeta, adminInboxSourceState, summarizeAdminToday } from '../lib/admin-operations-view';

test('inbox events receive stable human categories and labels', () => {
  assert.deepEqual(adminInboxEventMeta('workday.close_exception_requested'), {
    category: 'decisions', typeLabel: 'Требуется решение администратора', actionLabel: 'Принять решение',
  });
  assert.equal(adminInboxEventMeta('workday_issue.employee_message').category, 'messages');
  assert.equal(adminInboxEventMeta('expense_request.created').category, 'requests');
  assert.equal(adminInboxEventMeta('unknown.event').category, 'system');
});

test('read state is independent from the source business state', () => {
  assert.deepEqual(adminInboxSourceState({ sourceType: 'workday_control_issue', businessStatus: 'open', employeeActionRequired: true }), {
    active: true, label: 'Проблема активна', tone: 'attention',
  });
  assert.equal(adminInboxSourceState({ sourceType: 'workday_control_issue', businessStatus: 'resolved', employeeActionRequired: false }).active, false);
  assert.equal(adminInboxSourceState({ sourceType: 'terminal_fiscal_review', businessStatus: 'admin_review' }).label, 'На контроле администратора');
  assert.equal(adminInboxSourceState({ sourceType: 'expense_request', current: false }).label, 'В истории');
});

test('resolved decisions no longer invite admin to decide again', () => {
  const sourceState = adminInboxSourceState({ sourceType: 'workday_close_exception', businessStatus: 'approved' });
  assert.equal(adminInboxActionLabel({ sourceType: 'workday_close_exception', defaultLabel: 'Принять решение', sourceState }), 'Открыть решение');
});

test('failed cash operation stays active until the 1C pair is posted', () => {
  assert.deepEqual(adminInboxSourceState({ sourceType: 'cash_operation', businessStatus: 'one_c_error' }), {
    active: true,
    label: 'Требуется ручное проведение',
    tone: 'attention',
  });
  assert.equal(adminInboxSourceState({ sourceType: 'cash_operation', businessStatus: 'posted_1c_pair' }).active, false);
  assert.equal(adminInboxSourceState({ sourceType: 'cash_operation', businessStatus: 'resolved_manual' }).label, 'Подтверждено вручную');
  assert.equal(adminInboxSourceState({ sourceType: 'cash_operation', businessStatus: 'manual_in_progress' }).label, 'Взято в ручную');
  assert.equal(adminInboxSourceState({ sourceType: 'cash_operation', businessStatus: 'retrying_1c' }).label, 'Проводится повторно');
});

test('consumed close exceptions leave the active inbox regardless of the original decision', () => {
  assert.deepEqual(adminInboxSourceState({
    sourceType: 'workday_close_exception',
    businessStatus: 'approved',
    reasonCode: 'cash_encashment_not_possible',
    sourceCompleted: true,
  }), {
    active: false,
    label: 'Завершено',
    tone: 'resolved',
  });
});

test('today summary uses workday state before schedule state', () => {
  const summary = summarizeAdminToday({
    employees: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }],
    schedules: [{ userId: 1, status: 'working' }, { userId: 2, status: 'working' }, { userId: 3, status: 'working' }, { userId: 4, status: 'off' }],
    workdays: [{ userId: 1, status: 'active', endedAt: null }, { userId: 2, status: 'completed', endedAt: new Date() }],
  });
  assert.deepEqual(summary, { working: 1, completed: 1, notStarted: 1, off: 1, unscheduled: 1 });
});
