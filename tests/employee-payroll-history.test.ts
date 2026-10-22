import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bindPersonalPayrollHistory, projectPersonalSettlement } from '../lib/employee-payroll-history';
import type { PayrollDirectoryUser } from '../lib/payroll-calculation-engine';
import type { PayrollCashRead } from '../lib/payroll-one-c-payments';
import type { PayrollLedgerRead } from '../lib/payroll-one-c-ledger';
const name = 'Абшаева Зухра';
const user: PayrollDirectoryUser = { id: 4, name, payrollName: name, role: 'EMPLOYEE', isActive: true, department: 'retail',
  payrollSalaryType: 'retail_sales_bonus', payrollReportGroup: null, payrollFixedSalary: null, payrollRuleFrom: null, payrollRuleThrough: null };
const run = { status: 'FINAL', period: { periodKey: '2026-09' }, employeeResults: [{ userId: null, employeeName: name, grossPay: 66528.68, advance: 2000 }] };
test('legacy history uses explicit unique binding without mutating the saved run', () => {
  const before = JSON.stringify(run);
  assert.equal(bindPersonalPayrollHistory(run, [user], 4)?.run.employeeResults[0].userId, 4);
  assert.equal(JSON.stringify(run), before);
  for (const users of [[{ ...user, payrollName: null }], [user, { ...user, id: 5, isActive: false }],
    [{ ...user, payrollRuleFrom: '2026-10' }], [{ ...user, payrollName: 'СтажерРозница' }]]) {
    assert.equal(bindPersonalPayrollHistory(run, users, 4), null);
  }
  assert.equal(bindPersonalPayrollHistory({ ...run, employeeResults: [{ ...run.employeeResults[0], userId: 5 }] }, [user], 4), null);
  assert.equal(bindPersonalPayrollHistory({ ...run, employeeResults: [...run.employeeResults, ...run.employeeResults] }, [user], 4), null);
});
const cash: PayrollCashRead = { dateFrom: '2026-09-01', dateTo: '2026-10-22', checkedAt: '2026-10-22', documents: [
  { key: 'advance:1', employeeRef: 'person', employeeName: name, documentNumber: '1', documentDate: '2026-09-28', amount: 2000, comment: 'аванс 09.2026', advancePeriod: '2026-09', identityConfirmed: true },
  { key: 'salary:1', employeeRef: 'person', employeeName: name, documentNumber: '2', documentDate: '2026-10-01', amount: 64000, comment: '', advancePeriod: null, identityConfirmed: true },
  { key: 'older:1', employeeRef: 'person', employeeName: name, documentNumber: '3', documentDate: '2026-09-01', amount: 87500, comment: '', advancePeriod: null, identityConfirmed: true },
] };
const ledger: PayrollLedgerRead = { dateFrom: cash.dateFrom, dateTo: cash.dateTo, checkedAt: cash.checkedAt,
  employees: [{ employeeRef: 'person', employeeName: name }], movementCount: 1, allocationEvidence: { opening: [], movements: [
    { key: 'accrual:1', employeeRef: 'person', organizationRef: 'org', date: '2026-10-01', sign: -1, amountMinor: 6600000, kind: 'asset_liability_movement', comment: 'Зарплата за сентябрь' },
  ] } };
test('September uses 1C accrual and both advance and salary; August cash is excluded', () => {
  assert.deepEqual(projectPersonalSettlement('2026-09', name, cash, ledger), { accrued: 66000, paid: 66000, remaining: 0 });
  assert.deepEqual(projectPersonalSettlement('2026-09', name, { ...cash, documents: [cash.documents[0]] }, ledger), { accrued: 66000, paid: 2000, remaining: 64000 });
});
test('an exact surname/name with one patronymic is accepted, similar or reordered names are not', () => {
  const fullCash = { ...cash, documents: cash.documents.map(row => ({ ...row, employeeName: name + ' Магомедовна' })) };
  const fullLedger = { ...ledger, employees: [{ employeeRef: 'person', employeeName: name + ' Магомедовна' }] };
  assert.equal(projectPersonalSettlement('2026-09', name, fullCash, fullLedger)?.paid, 66000);
  for (const source of ['Абшаева Зухрия', 'Зухра Абшаева', 'А. Зухра']) {
    assert.equal(projectPersonalSettlement('2026-09', name, { ...cash, documents: [] }, { ...ledger, employees: [{ employeeRef: 'person', employeeName: source }] }), null);
  }
});
test('uncertain payment, conflicting identities, missing ledger and duplicate cash never imply paid or zero', () => {
  for (const document of [{ ...cash.documents[1], comment: 'непонятный аванс' }, { ...cash.documents[1], identityConfirmed: false }]) {
    assert.deepEqual(projectPersonalSettlement('2026-09', name, { ...cash, documents: [document] }, ledger), { accrued: 66000, paid: null, remaining: null });
  }
  assert.equal(projectPersonalSettlement('2026-09', name, cash, { ...ledger, allocationEvidence: undefined }), null);
  assert.equal(projectPersonalSettlement('2026-09', name, cash, { ...ledger, employees: [...ledger.employees, { employeeRef: 'other', employeeName: name }] }), null);
  assert.deepEqual(projectPersonalSettlement('2026-09', name, { ...cash, documents: [...cash.documents, cash.documents[0]] }, ledger), { accrued: 66000, paid: null, remaining: null });
});
