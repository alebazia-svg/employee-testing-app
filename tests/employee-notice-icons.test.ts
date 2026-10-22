import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { employeeAttentionIconKind, employeeInboxIconKind, employeeReminderIconKind } from '../lib/employee-notice-icons';

test('every action type has its own semantic symbol', () => {
  for (const [kind, expected] of Object.entries({ receipt:'receipt', cash:'money', cash_issue:'money', encashment:'encashment', closing:'closing', checklist:'checklist' })) {
    assert.equal(employeeAttentionIconKind(kind), expected);
  }
  assert.equal(employeeAttentionIconKind('new_unknown_type'), 'notice');
  assert.equal(employeeReminderIconKind({target:'checklist',href:'/employee#pwa-current-action'}), 'checklist');
  assert.equal(employeeReminderIconKind({target:'cash_issue',href:'/employee?cashIssue=123'}), 'money');
  assert.equal(employeeReminderIconKind({target:'attention',href:'/employee?attention=receipt&item=123'}), 'receipt');
});

test('replies are messages even when linked to a receipt or checklist', () => {
  assert.equal(employeeInboxIconKind({kind:'terminal_fiscal_review_reply',reviewId:'r'}), 'message');
  assert.equal(employeeInboxIconKind({kind:'workday_issue_reply',attentionKind:'receipt'}), 'message');
  assert.equal(employeeInboxIconKind({kind:'issue_reminder',attentionKind:'closing'}), 'closing');
  assert.equal(employeeInboxIconKind({kind:'terminal_fiscal_review',reviewId:'r'}), 'receipt');
});

test('payments, shifts, schedule, checklist and unknown messages are not bells', () => {
  for (const [kind, expected] of Object.entries({procurement_cash_issue:'money',employee_expense_payable:'money',procurement_collection_ready:'money',cash_operation_created:'encashment',procurement_delivery_ready:'delivery',schedule_replacement_request:'schedule',workday_closed_by_admin:'closing',workday_close_exception_decision:'closing',planned:'checklist',overdue_repeat:'checklist',unknown:'notice'})) {
    assert.equal(employeeInboxIconKind({kind}),expected);
  }
  assert.equal(employeeInboxIconKind({kind:'anything',taskId:7}), 'checklist');
});

test('inbox and waiting details are static; only action reminders opt into animation', async () => {
  const inbox = await readFile('components/workday/EmployeeNotificationInbox.tsx','utf8');
  const icon = await readFile('components/workday/EmployeeNoticeIcon.tsx','utf8');
  const css = await readFile('components/workday/EmployeeNoticeIcon.module.css','utf8');
  assert.doesNotMatch(inbox, /ReminderBell|\bBell\b|<EmployeeNoticeIcon[^>]*animated/);
  assert.match(icon,/animated = false/);
  assert.match(icon,/width: animated \? 38 : size, height: animated \? 34 : size/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\) \{\s*\.animated,\.animated svg \{ animation:none;/);
  assert.doesNotMatch(css,/setInterval|filter:|scale\(/);
  const notifications = await readFile('app/(dashboard)/employee/WorkdayNotificationsClient.tsx','utf8');
  assert.equal((notifications.match(/<Bell\b/g) ?? []).length, 1, 'only the header keeps a bell');
  assert.match(notifications, /employeeInboxIconKind\(banner\)/);
});
