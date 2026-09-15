import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const todayClient = readFileSync(new URL('../app/(dashboard)/employee/EmployeeTodayClient.tsx', import.meta.url), 'utf8');
const blockedSheet = readFileSync(new URL('../components/EmployeeCloseBlockedSheet.tsx', import.meta.url), 'utf8');
const issueView = readFileSync(new URL('../lib/workday-control-issue-view.ts', import.meta.url), 'utf8');

test('failed handover keeps a compact persistent close-blocked state', () => {
  assert.match(todayClient, /setCloseBlocked\(true\)/);
  assert.match(todayClient, /setCloseBlockedSheetOpen\(true\)/);
  assert.match(todayClient, /closeBlocked \|\| handoverWasBlocked/);
  assert.match(todayClient, /attentionCount > 0 && !showCloseResolution/);
  assert.match(todayClient, /Смена не закрыта/);
  assert.match(todayClient, /Продолжить сдачу смены/);
  assert.match(todayClient, /Ждём решения администратора\./);
  assert.match(todayClient, /Смена закрыта/);
  assert.doesNotMatch(todayClient, /showAllRequiredIssues/);
});

test('blocked sheet has one clear correction route and a safe help state', () => {
  assert.match(blockedSheet, /href=\{item\.href\}/);
  assert.match(blockedSheet, /items\.map/);
  assert.match(todayClient, /items=\{attentionItems\}/);
  assert.match(todayClient, /paymentChecksState\.map/);
  assert.match(blockedSheet, /Не могу исправить/);
  assert.match(blockedSheet, /Запрос отправлен/);
  assert.match(blockedSheet, /disabled=\{helpPending\}/);
});

test('previous shift keeps reason-based closure without a competing blocked card', () => {
  assert.match(todayClient, /const showCloseResolution = !hasPreviousWorkday &&/);
  assert.match(todayClient, /Сдать смену · \{formatDateLabel\(previousWorkDay.date\)\}/);
  assert.match(todayClient, /workDayId: previousWorkDay.id/);
  assert.match(todayClient, /closeStale: true/);
  assert.doesNotMatch(todayClient, />\s*Закрыть предыдущую смену\s*</);
});

test('source-backed receipt instructions remain unchanged', () => {
  assert.match(issueView, /Откройте реализацию \$\{documentNumber\} в 1С и пробейте чек с передачей всей суммы \$\{amount\} в кредит/);
  assert.match(issueView, /Откройте приходник \$\{paymentDocumentNumber \|\| 'по этой реализации'\} в 1С и пробейте чек из него/);
  assert.match(issueView, /Откройте эквайринговую операцию \$\{paymentDocumentNumber \|\| 'по этой реализации'\} в 1С и пробейте чек из неё/);
});
