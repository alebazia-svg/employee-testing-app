import assert from 'node:assert/strict';
import test from 'node:test';
import { employeeSalaryBalance, parsePayrollBalanceResponse } from '../lib/payroll-one-c-balances';

const date = '2026-10-16', checked = '2026-10-16T18:00:00Z';
const person = '13300392-e2e6-11e1-a47e-0025901e48ef';
const org = '1c2d6c5c-251f-11ec-ac9f-0025901e48ee';
function payload() {
  return {
    ok: true, endpoint: 'payroll-balance', contract_version: 'payroll-balance-v1',
    mode: 'read-only', write_operations: false, complete: true, as_of: date,
    organization_filter: '', article: 'Заработная плата',
    source: 'РегистрНакопления.ПрочиеАктивыПассивы.Остатки',
    totals_scope: 'returned_rows', balance_sign_interpretation: 'not_validated_against_report',
    totals: { rows: 1, rows_without_employee: 0, closing_balance_signed: -208300 },
    rows: [{ organization_ref: org, employee_ref: person, employee_name: 'Сотрудник', closing_balance_signed: -208300 }],
  };
}
test('authoritative balance is independent of portal rounding and accruals', () => {
  const source = payload(), before = structuredClone(source);
  assert.deepEqual(employeeSalaryBalance(parsePayrollBalanceResponse(source, date, checked), person),
    { remainingMinor: 20830000, creditMinor: 0, asOf: date });
  assert.deepEqual(source, before);
});
test('zero omitted from complete register is zero only for confirmed employee identity', () => {
  const source = payload(); source.rows = []; source.totals.rows = 0; source.totals.closing_balance_signed = 0;
  const read = parsePayrollBalanceResponse(source, date, checked);
  assert.equal(employeeSalaryBalance(read, person)?.remainingMinor, 0);
  assert.equal(employeeSalaryBalance(read, null), null);
  assert.equal(employeeSalaryBalance(null, person), null);
  assert.equal(employeeSalaryBalance(read, '00000000-0000-0000-0000-000000000000'), null);
});
test('incomplete, different date, filtered or inconsistent responses never become zero', () => {
  for (const patch of [{ complete: false }, { as_of: '2026-09-30' }, { organization_filter: org },
    { write_operations: true }, { contract_version: 'other' }, { totals: { rows: 1, rows_without_employee: 0, closing_balance_signed: 0 } }]) {
    assert.throws(() => parsePayrollBalanceResponse({ ...payload(), ...patch }, date, checked));
  }
});
test('duplicates and invalid money are rejected', () => {
  const duplicate = payload(); duplicate.rows.push({ ...duplicate.rows[0] }); duplicate.totals.rows++;
  assert.throws(() => parsePayrollBalanceResponse(duplicate, date, checked));
  for (const amount of [NaN, Infinity, 1.234, Number.MAX_SAFE_INTEGER]) {
    const source = payload(); source.rows[0].closing_balance_signed = amount;
    assert.throws(() => parsePayrollBalanceResponse(source, date, checked));
  }
});
test('same person in two organizations does not hide debt with a credit elsewhere', () => {
  const source = payload();
  source.rows.push({ ...source.rows[0], organization_ref: '2c2d6c5c-251f-11ec-ac9f-0025901e48ee', closing_balance_signed: 100 });
  source.totals.rows = 2; source.totals.closing_balance_signed += 100;
  assert.deepEqual(employeeSalaryBalance(parsePayrollBalanceResponse(source, date, checked), person),
    { remainingMinor: 20830000, creditMinor: 10000, asOf: date });
});
