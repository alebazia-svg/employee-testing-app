import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePayrollCashResponse, resolvePayrollSettlementIdentity } from '../lib/payroll-one-c-payments';
const ref = '13300392-e2e6-11e1-a47e-0025901e48ef';
const row = { document_ref: 'doc', document_number: '123', line_number: 1, document_date: '16.10.2026 12:00:00', amount: 7500,
  employee_ref: ref, employee_name: 'Чеченова Милана', employee_analytics_conflict: false, document_comment: '', line_comment: '' };
function payload(rows = [row]) { return { ok: true, complete: true, mode: 'read-only', write_operations: false,
  contract_version: 'payroll-cash-payments-v1', organization_filter: '', date_from: '2026-09-01', date_to: '2026-10-17',
  rows, totals: { rows: rows.length, amount: rows.reduce((s, r) => s + r.amount, 0) } }; }
const parse = (p: unknown) => parsePayrollCashResponse(p, '2026-09-01', '2026-10-17', '2026-10-17T10:00:00Z');
const balance = { version: 1 as const, asOf: '2026-10-17', checkedAt: '2026-10-17T10:00:00Z', rows: [] };
test('cash history preserves paid amounts without guessing payroll month from payday', () => {
  const read = parse(payload()); assert.equal(read.documents[0].amount, 7500); assert.equal(read.documents[0].advancePeriod, null);
  for (const comment of ['аванс 2026.10', 'аванс 10.2026']) assert.equal(parse(payload([{ ...row, line_comment: comment }])).documents[0].advancePeriod, '2026-10');
});
test('partial advance text and conflicting markers never allocate the whole payment', () => {
  for (const comments of [{ line_comment: '13000 аванс 09.2026' }, { line_comment: 'аванс 09.2026', document_comment: 'аванс 10.2026' }])
    assert.equal(parse(payload([{ ...row, ...comments }])).documents[0].advancePeriod, null);
});
test('source completeness, exact window, totals, duplicates and money are checked', () => {
  for (const p of [{ ...payload(), complete: false }, { ...payload(), date_to: '2026-10-16' }, { ...payload(), totals: { rows: 1, amount: 0 } },
    payload([row, row]), payload([{ ...row, amount: 1.001 }]), payload([{ ...row, document_date: '31.09.2026' }])]) assert.throws(() => parse(p));
});
test('unique exact payroll identity resolves but ambiguity and conflicting analytics do not', () => {
  const names = ['Чеченова Милана'];
  assert.equal(resolvePayrollSettlementIdentity(names[0], names, '2026-09', parse(payload()), balance), ref);
  const second = { ...row, document_ref: 'other', employee_ref: '23300392-e2e6-11e1-a47e-0025901e48ef' };
  assert.equal(resolvePayrollSettlementIdentity(names[0], names, '2026-09', parse(payload([row, second])), balance), null);
  assert.equal(resolvePayrollSettlementIdentity(names[0], names, '2026-09', parse(payload([{ ...row, employee_analytics_conflict: true }])), balance), null);
  assert.equal(resolvePayrollSettlementIdentity('Другой сотрудник', ['Другой сотрудник'], '2026-09', parse(payload()), balance), null);
});
test('confirmed short directory labels remain scoped and unique',()=>{
  const t=parse(payload([{...row,employee_name:'Татьяна'}]));
  assert.equal(resolvePayrollSettlementIdentity('Даудова Татьяна',['Даудова Татьяна'],'2026-09',t,balance),ref);
  assert.equal(resolvePayrollSettlementIdentity('Даудова Татьяна',['Даудова Татьяна','Татьяна'],'2026-09',t,balance),null);
  const m=parse(payload([{...row,employee_name:'СтажерЗакупка'}]));
  assert.equal(resolvePayrollSettlementIdentity('Кумыков Мухаммед',['Кумыков Мухаммед'],'2026-10',m,balance),ref);
  assert.equal(resolvePayrollSettlementIdentity('Кумыков Мухаммед',['Кумыков Мухаммед'],'2026-09',m,balance),null);
});
