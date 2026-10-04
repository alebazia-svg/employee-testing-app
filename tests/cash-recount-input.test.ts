import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { cashRecountInputError } from '../lib/cash-recount-input';

test('physical cash rejects negative, missing and non-finite amounts', () => {
  for (const amount of [-1, -0.01, null, NaN, Infinity, -Infinity]) {
    assert.ok(cashRecountInputError(amount));
  }
});

test('zero and positive physical cash remain valid', () => {
  for (const amount of [0, 0.01, 3080, 12500]) assert.equal(cashRecountInputError(amount), null);
});

test('both client and API validate physical cash before completion', () => {
  const client = readFileSync(new URL('../app/(dashboard)/employee/EmployeeTodayClient.tsx', import.meta.url), 'utf8');
  const api = readFileSync(new URL('../app/api/employee/shift-control/tasks/[id]/route.ts', import.meta.url), 'utf8');
  assert.match(client, /cashRecountInputError\(parseMoneyInput\(draft.numericValue\)\)/);
  assert.match(api, /cashRecountInputError\(numericValue\)/);
  assert.ok(api.indexOf('cashRecountInputError(numericValue)') < api.indexOf('const existingData = isRecord(task.handoverData)'));
});

test('cash-register resolution has a matching action label while pending', () => {
  const client = readFileSync(new URL('../app/(dashboard)/employee/EmployeeTodayClient.tsx', import.meta.url), 'utf8');
  assert.match(client, /kkmCloseIssue \? 'Проверить закрытие кассы' : currentCloseExceptionStatus === 'pending' \? 'Посмотреть задачи'/);
});

test('compact shift presentation preserves correction and early-finish actions', () => {
  const client = readFileSync(new URL('../app/(dashboard)/employee/EmployeeTodayClient.tsx', import.meta.url), 'utf8');
  assert.match(client, /Начало \{formatTime\(workDay!.startedAt\)\}/);
  assert.match(client, /фактическое время/);
  assert.match(client, /onClick=\{\(\) => void openShiftCorrection\(\)\}/);
  assert.match(client, /onClick=\{openEarlyFinishSheet\}/);
  assert.doesNotMatch(client, /<h2[^>]*>Детали смены<\/h2>/);
  assert.match(client, />Шаг \{handoverStep \+ 1\} из \{handoverSteps.length\}/);
});
