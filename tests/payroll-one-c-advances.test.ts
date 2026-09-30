import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPayrollOneCAdvances, parsePayrollAdvanceComment, parsePayrollAdvanceResponse } from '../lib/payroll-one-c-advances';
import { FILM_TRAINEE_NAME } from '../lib/payroll-trainee';

const expected = { periodKey: '2026-09', dateFrom: '2026-09-01', dateTo: '2026-09-17', checkedAt: '2026-09-17T12:00:00Z' };
const row = { document_ref: 'document-1', line_number: 1, document_number: '00OF-001697', document_date: '17.09.2026 14:43:41',
  employee_ref: 'employee-1', employee_name: 'СтажерРозница', employee_analytics_conflict: false, amount: 15000, document_comment: 'аванс 2026.09', line_comment: '' };
function payload(rows = [row]) { return { ok: true, complete: true, mode: 'read-only', write_operations: false, contract_version: 'payroll-cash-payments-v1',
  date_from: expected.dateFrom, date_to: expected.dateTo, rows, totals: { amount: rows.reduce((s,r) => s+r.amount,0) } }; }
const payroll = [{ manager: FILM_TRAINEE_NAME, advance: 0, grossPay: 35490, netPay: 35490 }];

test('accepts both approved period markers, rejects ambiguous text', () => {
  for (const text of ['аванс 2026.09', 'Аванс за 2026.09', 'Аванс за 2026-09', 'аванс 09.2026', 'Аванс за 09.2026', ' АВАНС 09-2026. ']) assert.equal(parsePayrollAdvanceComment(text), '2026-09');
  for (const text of ['не аванс 2026.09', 'аванс 2026.13', 'аванс сентябрь', 'аванс 2026.09 и 2026.10', 'аванс 13.2026', 'аванс 00.2026', 'аванс 09.26', 'не аванс 09.2026', 'аванс 09.2026 и 10.2026']) assert.equal(parsePayrollAdvanceComment(text), null);
});
test('month-first payment and equivalent document/line markers deduct once', () => {
  const read = parsePayrollAdvanceResponse(payload([{ ...row, employee_name: 'Абшаева Зухра', amount: 2000,
    document_comment: 'аванс 09.2026', line_comment: 'Аванс за 2026.09' }]), expected);
  assert.equal(read.documents.length, 1); assert.deepEqual(read.issues, []);
  const result = applyPayrollOneCAdvances([{ manager: 'Абшаева Зухра', grossPay: 10000, netPay: 10000, advance: 0 }], read);
  assert.equal(result.rows[0].advance, 2000); assert.equal(result.rows[0].netPay, 8000); assert.equal(result.rows[0].grossPay, 10000);
  const conflict = parsePayrollAdvanceResponse(payload([{ ...row, document_comment: 'аванс 09.2026', line_comment: 'аванс 2026.08' }]), expected);
  assert.equal(conflict.documents.length, 0); assert.equal(conflict.issues.length, 1);
  assert.equal(parsePayrollAdvanceResponse(payload([{ ...row, document_comment: 'аванс 08.2026' }]), expected).documents.length, 0);
});
test('actual trainee example preserves gross and deducts exactly once from fresh base', () => {
  const read = parsePayrollAdvanceResponse(payload(), expected);
  const first = applyPayrollOneCAdvances(payroll, read);
  assert.equal(first.rows[0].grossPay, 35490); assert.equal(first.rows[0].netPay, 20490);
  assert.equal(first.rows[0].advance, 15000); assert.deepEqual(first.issues, []);
  assert.deepEqual(applyPayrollOneCAdvances(payroll, read), first);
  const repeated = applyPayrollOneCAdvances(first.rows, read);
  assert.equal(repeated.rows[0].netPay, 20490); assert.equal(repeated.issues.length, 1);
});
test('changed or cancelled payment replaces the source rather than accumulating', () => {
  assert.equal(applyPayrollOneCAdvances(payroll, parsePayrollAdvanceResponse(payload([{ ...row, amount: 10000 }]), expected)).rows[0].netPay, 25490);
  assert.equal(applyPayrollOneCAdvances(payroll, parsePayrollAdvanceResponse(payload([]), expected)).rows[0].netPay, 35490);
});
test('other period and unmarked salary never deducted', () => {
  for (const comment of ['', 'зарплата за август', 'аванс 2026.08']) {
    assert.equal(parsePayrollAdvanceResponse(payload([{ ...row, document_comment: comment }]), expected).documents.length, 0);
  }
});
test('ambiguous comments and analytics are review-only', () => {
  for (const change of [{ line_comment: 'аванс 2026.08' }, { document_comment: 'не аванс 2026.09' }, { employee_analytics_conflict: true }, { amount: -1 }]) {
    const read = parsePayrollAdvanceResponse(payload([{ ...row, ...change }]), expected);
    assert.equal(read.documents.length, 0); assert.equal(read.issues.length, 1);
  }
});
test('duplicates, incomplete source, wrong window and totals fail closed', () => {
  for (const data of [payload([row,row]), { ...payload(), complete: false }, { ...payload(), date_to: '2026-09-16' },
    { ...payload(), totals: { amount: 1 } }, { ...payload(), write_operations: true }]) assert.throws(() => parsePayrollAdvanceResponse(data, expected));
});
test('manual advance is not added a second time even for equal amounts', () => {
  const read = parsePayrollAdvanceResponse(payload(), expected);
  const result = applyPayrollOneCAdvances([{ ...payroll[0], advance: 15000, netPay: 20490 }], read);
  assert.equal(result.rows[0].netPay, 20490); assert.equal(result.issues.length, 1);
});
test('trainee identity is September only and unknown recipients are flagged', () => {
  const read = parsePayrollAdvanceResponse(payload(), expected);
  const result = applyPayrollOneCAdvances([{ ...payroll[0], manager: 'Костеренко Магомед' }], read);
  assert.equal(result.rows[0].advance, 0); assert.equal(result.issues.length, 1);
  const october = { ...read, documents: read.documents.map(d => ({ ...d, periodKey: '2026-10' })) };
  assert.equal(applyPayrollOneCAdvances(payroll, october).issues.length, 1);
});
