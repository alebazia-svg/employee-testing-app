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

// Reproduces the complete live September/October evidence read on 23 October:
// August 99,600 accrued / 99,700 issued; September 89,100 / 89,000.
function previousCreditCase(augustLastPayment = 86500) {
  const employeeName = 'Чеченова Милана';
  const documents: PayrollCashRead['documents'] = [
    ['a1', '2026-09-01', 12600], ['a2', '2026-09-01', 600], ['a3', '2026-09-16', augustLastPayment],
    ['s1', '2026-10-01', 12500], ['s2', '2026-10-16', 76500],
  ].map(([key, date, amount]) => ({ key: String(key), employeeRef: 'milana', employeeName,
    documentNumber: String(key), documentDate: String(date), amount: Number(amount), comment: '', advancePeriod: null, identityConfirmed: true }));
  const evidence: NonNullable<PayrollLedgerRead['allocationEvidence']> = { opening: [], movements: [
    { key: 'aug-days', date: '2026-09-01', sign: -1, amountMinor: 1320000, comment: 'Выход за авг' },
    { key: 'aug-sales', date: '2026-09-01', sign: -1, amountMinor: 8640000, comment: 'Проценты за авг' },
    { key: 'sep-days', date: '2026-10-01', sign: -1, amountMinor: 1260000, comment: 'Выход за сент' },
    { key: 'sep-sales', date: '2026-10-01', sign: -1, amountMinor: 7650000, comment: 'Проценты за сент' },
  ].map(row => ({ ...row, employeeRef: 'milana', organizationRef: 'org', kind: 'asset_liability_movement' })) };
  evidence.movements.push(...documents.map(document => ({ key: document.key, date: document.documentDate,
    sign: 1, amountMinor: document.amount * 100, comment: '', employeeRef: 'milana', organizationRef: 'org', kind: 'cash_expense' })));
  const paymentSource: PayrollCashRead = { ...cash, documents };
  const ledgerSource: PayrollLedgerRead = { ...ledger, employees: [{ employeeRef: 'milana', employeeName }],
    movementCount: evidence.movements.length, allocationEvidence: evidence };
  return { employeeName, paymentSource, ledgerSource };
}
test('confirmed earlier credit clears Milana remainder without changing paid or accrued', () => {
  const { employeeName, paymentSource, ledgerSource } = previousCreditCase();
  const original = JSON.stringify({ paymentSource, ledgerSource });
  assert.deepEqual(projectPersonalSettlement('2026-09', employeeName, paymentSource, ledgerSource),
    { accrued: 89100, paid: 89000, creditedFromEarlier: 100, remaining: 0 });
  assert.equal(JSON.stringify({ paymentSource, ledgerSource }), original);
});
test('cash table row numbers and accounting register line numbers must not be equated', () => {
  const { employeeName, paymentSource, ledgerSource } = previousCreditCase();
  paymentSource.documents.forEach(document => { document.key += ':4'; });
  ledgerSource.allocationEvidence!.movements.forEach(row => { if (row.kind === 'cash_expense') row.key += ':6'; });
  assert.equal(projectPersonalSettlement('2026-09', employeeName, paymentSource, ledgerSource)?.creditedFromEarlier, 100);
  for (const patch of [{documentDate:'2026-09-02'}, {amount:12601}, {key:'different:4'}]) {
    const altered = {...paymentSource, documents: paymentSource.documents.map((row,index)=>index===0?{...row,...patch}:row)};
    assert.equal(projectPersonalSettlement('2026-09',employeeName,altered,ledgerSource)?.creditedFromEarlier, undefined);
  }
});
test('prior credit is bounded; actual debt and smaller credits never become an invented zero', () => {
  for (const [olderPayment, credit, remaining] of [[86400, 0, 100], [86450, 50, 50], [86600, 100, 0]]) {
    const { employeeName, paymentSource, ledgerSource } = previousCreditCase(olderPayment);
    assert.deepEqual(projectPersonalSettlement('2026-09', employeeName, paymentSource, ledgerSource),
      { accrued: 89100, paid: 89000, remaining, ...(credit ? { creditedFromEarlier: credit } : {}) });
  }
});
test('cross-organization, unmatched, duplicate and unknown evidence cannot manufacture prior credit', () => {
  const { employeeName, paymentSource, ledgerSource } = previousCreditCase();
  const movements = ledgerSource.allocationEvidence!.movements;
  for (const altered of [
    movements.map((row, index) => index === 0 ? { ...row, organizationRef: 'other-org' } : row),
    movements.filter(row => row.key !== 'a3'),
    [...movements, movements[4]],
    [...movements, { ...movements[0], key: 'unknown', sign: 1, kind: 'unknown' }],
  ]) {
    const result = projectPersonalSettlement('2026-09', employeeName, paymentSource,
      { ...ledgerSource, allocationEvidence: { opening: [], movements: altered } });
    assert.equal(result?.remaining, null); assert.equal(result?.creditedFromEarlier, undefined);
  }
});
test('a later-month advance is not a previous-month credit', () => {
  const { employeeName, paymentSource, ledgerSource } = previousCreditCase(86400);
  const document = { ...paymentSource.documents[0], key: 'oct-advance', documentDate: '2026-10-20', amount: 500,
    comment: 'аванс 10.2026', advancePeriod: '2026-10' };
  paymentSource.documents.push(document);
  ledgerSource.allocationEvidence!.movements.push({ key: document.key, date: document.documentDate, sign: 1,
    amountMinor: 50000, employeeRef: 'milana', organizationRef: 'org', kind: 'cash_expense', comment: '' });
  assert.deepEqual(projectPersonalSettlement('2026-09', employeeName, paymentSource, ledgerSource),
    { accrued: 89100, paid: 89000, remaining: 100 });
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
  const partialCash = { ...cash, documents: [cash.documents[0]] };
  const partialLedger = { ...ledger, allocationEvidence: { opening: [], movements: [
    ...ledger.allocationEvidence!.movements,
    { key: 'advance:1', employeeRef: 'person', organizationRef: 'org', date: '2026-09-28', sign: 1, amountMinor: 200000, kind: 'cash_expense', comment: '' },
  ] } };
  assert.deepEqual(projectPersonalSettlement('2026-09', name, partialCash, partialLedger), { accrued: 66000, paid: 2000, remaining: 64000 });
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
