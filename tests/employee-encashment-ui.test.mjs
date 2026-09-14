import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../app/(dashboard)/employee/EmployeeTodayClient.tsx', import.meta.url), 'utf8');

test('encashment keeps destination selection separate from amount and photo', () => {
  assert.match(source, /!encashmentDetailsOpen/);
  assert.match(source, /Куда переложите деньги\?/);
  assert.match(source, /encashmentDirection: 'phone_reserve'/);
  assert.match(source, /encashmentDirection: 'deposit_safe'/);
});

test('photo remains disabled while its explanatory helper can be hidden', () => {
  assert.match(source, /disabled=\{isSaving \|\| Boolean\(disabledReason\)\}/);
  assert.match(source, /disabledReason && showDisabledReason/);
  assert.match(source, /'Сначала укажите сумму' : undefined,\s+false,/);
});

test('pending administrator decision has a separate resume action', () => {
  assert.match(source, /status === 'pending' && !encashmentResumePending/);
  assert.match(source, /Всё же выполнить инкассацию/);
  assert.match(source, /Администратор получил запрос\. Смена пока открыта\./);
});
