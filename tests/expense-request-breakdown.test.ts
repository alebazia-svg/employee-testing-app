import test from 'node:test';
import assert from 'node:assert/strict';
import { expenseAttachmentEvidence, expenseBreakdownDisplay, readExpenseBreakdown } from '../lib/expense-request-breakdown';
import { normalizeExpenseRequestForAudit, expenseRequestSourceHash } from '../lib/expense-request-admin-lifecycle';

function fixture() {
  return {
    contract: 'expense-request-breakdown-v1', source: 'Документ.ЗаявкаНаРасходованиеДенежныхСредств.РасшифровкаПлатежа', complete: true, truncated: false,
    columns: [{ name: 'Сумма', label: 'Сумма', types: ['Число'] }, { name: 'СтатьяРасходов', label: 'Статья расходов', types: ['Статья расходов'] }],
    rows: [1, 2].map(line_number => ({ line_number, fields: {
      Сумма: { type: 'Число', filled: false, value: 0, name: '', ref: '' },
      СтатьяРасходов: { type: 'Статья расходов', filled: true, value: null, name: 'Хозрасходы', ref: `synthetic-ref-${line_number}` },
    } })),
  };
}

test('missing, incomplete and empty native tables remain distinct', () => {
  assert.equal(readExpenseBreakdown(undefined).state, 'not_provided');
  assert.equal(readExpenseBreakdown({ ...fixture(), complete: false }).state, 'incomplete');
  assert.equal(readExpenseBreakdown({ ...fixture(), truncated: true }).state, 'incomplete');
  const empty = readExpenseBreakdown({ ...fixture(), rows: [] });
  assert.equal(empty.state, 'available');
  assert.deepEqual(empty.data?.rows, []);
});
test('multiple native rows and exact refs survive; zero and false are not replaced with missing', () => {
  const result = readExpenseBreakdown(fixture());
  assert.equal(result.state, 'available');
  assert.equal(result.data?.rows.length, 2);
  assert.equal(result.data?.rows[1].fields.СтатьяРасходов.ref, 'synthetic-ref-2');
  assert.equal(expenseBreakdownDisplay(result.data!.rows[0].fields.Сумма), '0');
  assert.equal(expenseBreakdownDisplay({ type: 'Булево', filled: false, value: false, name: '', ref: '' }), 'Нет');
});
test('partial, duplicate or malformed rows are rejected instead of becoming editable facts', () => {
  const duplicate = fixture(); duplicate.rows[1].line_number = 1;
  assert.equal(readExpenseBreakdown(duplicate).state, 'invalid');
  const missing = fixture(); delete (missing.rows[0].fields as Record<string, unknown>).Сумма;
  assert.equal(readExpenseBreakdown(missing).state, 'invalid');
  assert.equal(readExpenseBreakdown({ ...fixture(), columns: [...fixture().columns, fixture().columns[0]] }).state, 'invalid');
  const bad = fixture(); bad.rows[0].fields.Сумма.value = Number.NaN;
  assert.equal(readExpenseBreakdown(bad).state, 'invalid');
  assert.equal(readExpenseBreakdown({ ...fixture(), source: 'other' }).state, 'invalid');
});
test('no attachment, missing branch and source errors never mean receipt required or overdue', () => {
  assert.deepEqual(expenseAttachmentEvidence(null), { state: 'not_provided', count: null });
  assert.deepEqual(expenseAttachmentEvidence({ complete: false, rows: [] }), { state: 'incomplete', count: null });
  assert.deepEqual(expenseAttachmentEvidence({ complete: true, rows: [] }), { state: 'available', count: 0 });
  assert.deepEqual(expenseAttachmentEvidence({ complete: true, rows: [{ deletion_mark: true }, { deletion_mark: false }] }), { state: 'available', count: 1 });
  assert.deepEqual(expenseAttachmentEvidence({ complete: true, rows: [{}] }), { state: 'incomplete', count: null });
});
test('audit preserves identities and rows without inventing data for older snapshots', () => {
  const row = { ref: 'synthetic', payment_breakdown: fixture(), version_token: 'native-v1', requested_by: { ref: 'initiator' }, accountable_person: { ref: 'recipient' } };
  const saved = normalizeExpenseRequestForAudit(row) as Record<string, unknown>;
  assert.deepEqual(saved.paymentBreakdown, row.payment_breakdown);
  assert.deepEqual(saved.accountablePerson, { ref: 'recipient', name: '' });
  assert.deepEqual(saved.requestedBy, { ref: 'initiator', name: '' });
  assert.notEqual(expenseRequestSourceHash(row), expenseRequestSourceHash({ ...row, version_token: 'native-v2' }));
  assert.equal(Object.hasOwn(normalizeExpenseRequestForAudit({}) as object, 'paymentBreakdown'), false);
});
