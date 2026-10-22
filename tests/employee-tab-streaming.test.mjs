import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const salary = read('app/(dashboard)/employee/payroll/PersonalPayrollScreen.tsx');
const client = read('app/(dashboard)/employee/payroll/PersonalPayrollClient.tsx');

test('salary opens its existing screen before the stored calculation finishes', () => {
  assert.ok(salary.includes('export function PersonalPayrollScreen'));
  assert.ok(salary.includes('fallback={<PersonalPayrollClient'));
  assert.ok(salary.includes('refreshEnabled={false}'));
  assert.ok(salary.includes('<SavedPayroll user={user}'));
  assert.ok(salary.includes('employeePayrollResponse(user, new URLSearchParams(), true)'));
});

test('salary fallback shows the account-scoped last result without duplicate live reads', () => {
  assert.ok(client.includes('useEmployeePayrollSnapshots()'));
  assert.ok(client.includes('store?.values.get(month)'));
  assert.ok(client.includes('if (!refreshEnabled) return;'));
  assert.ok(client.includes('controller.abort()'));
  assert.ok(client.includes('disabled={!refreshEnabled}'));
});

test('failed stored reads fall through to the existing retryable private client', () => {
  assert.ok(salary.includes('let initial: unknown = null;'));
  assert.ok(salary.includes('try { initial = await'));
  assert.ok(salary.includes('catch {'));
  assert.ok(client.includes('if ([401, 403, 404, 410].includes(response.status)) { clear?.()'));
});
