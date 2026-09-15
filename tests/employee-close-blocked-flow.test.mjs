import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const todayClient = readFileSync(new URL('../app/(dashboard)/employee/EmployeeTodayClient.tsx', import.meta.url), 'utf8');
const blockedSheet = readFileSync(new URL('../components/EmployeeCloseBlockedSheet.tsx', import.meta.url), 'utf8');
const issueView = readFileSync(new URL('../lib/workday-control-issue-view.ts', import.meta.url), 'utf8');

test('failed handover keeps a compact persistent close-blocked state', () => {
  assert.match(todayClient, /setCloseBlocked\(true\)/);
  assert.match(todayClient, /setCloseBlockedSheetOpen\(true\)/);
  assert.match(todayClient, /closeBlocked \|\| handoverHasSavedProgress/);
  assert.match(todayClient, /title=\{showCloseResolution \? 'Смена открыта'/);
  assert.match(todayClient, /Закрытие заблокировано/);
  assert.doesNotMatch(todayClient, /showAllRequiredIssues/);
});

test('blocked sheet has one clear correction route and a safe help state', () => {
  assert.match(blockedSheet, /href=\{item\.href\}/);
  assert.match(blockedSheet, /items\.map/);
  assert.match(todayClient, /items=\{attentionItems\}/);
  assert.match(todayClient, /paymentChecksState\.map/);
  assert.match(blockedSheet, /Сообщить о проблеме/);
  assert.match(blockedSheet, /Администратор уведомлён/);
  assert.match(blockedSheet, /disabled=\{helpPending\}/);
});

test('source-backed receipt instructions remain unchanged', () => {
  assert.match(issueView, /Откройте реализацию \$\{documentNumber\} в 1С и пробейте чек с передачей всей суммы \$\{amount\} в кредит/);
  assert.match(issueView, /Откройте приходник \$\{paymentDocumentNumber \|\| 'по этой реализации'\} в 1С и пробейте чек из него/);
  assert.match(issueView, /Откройте эквайринговую операцию \$\{paymentDocumentNumber \|\| 'по этой реализации'\} в 1С и пробейте чек из неё/);
});
