import assert from 'node:assert/strict';
import test from 'node:test';
import { incomeRecognition, parseIncomeEvidence, type IncomeEvidence } from '../lib/tax-income-evidence';
const item: IncomeEvidence = { id: 'payment', date: '2026-08-30', bank: 'Банк', amountCents: 30000, bankBaseCents: 30000, fiscalBaseCents: 0, identityResolved: true, fnsSearchComplete: true, finding: 'Документальный разбор', internalNotes: ['Чек не найден в 1С'], sourceDocumentIds: ['source'] };
test('missing internal check does not turn FNS bank inclusion into omitted income', () => {
 assert.equal(incomeRecognition(item), 'accounted');
 assert.equal(incomeRecognition({ ...item, internalNotes: [] }), 'accounted');
 assert.equal(incomeRecognition({ ...item, bankBaseCents: 0, fiscalBaseCents: 30000 }), 'accounted');
});
test('zero bank base and an unresolved receipt never prove missing income or a zero tax effect', () => {
 assert.equal(incomeRecognition({ ...item, bankBaseCents: 0, fiscalBaseCents: null }), 'unconfirmed');
 assert.equal(incomeRecognition({ ...item, bankBaseCents: 0, fiscalBaseCents: 0, fnsSearchComplete: false }), 'unconfirmed');
 assert.equal(incomeRecognition({ ...item, bankBaseCents: 0, fiscalBaseCents: 30000, identityResolved: false }), 'unconfirmed');
});
test('complete identity and coverage distinguish omission from duplication and partial amounts', () => {
 assert.equal(incomeRecognition({ ...item, bankBaseCents: 0 }), 'omitted');
 assert.equal(incomeRecognition({ ...item, fiscalBaseCents: 30000 }), 'duplicate');
 assert.equal(incomeRecognition({ ...item, bankBaseCents: 10000 }), 'unconfirmed');
});
test('evidence rejects duplicate identities, impossible dates and absent documentary sources', () => {
 const data = { schema: 1, reviewedAt: '2026-11-01T00:00:00Z', title: 'Проверка', cases: [item] };
 assert.ok(parseIncomeEvidence(JSON.stringify(data)));
 for (const cases of [[item, item], [{ ...item, date: '2026-02-30' }], [{ ...item, sourceDocumentIds: [] }], [{ ...item, amountCents: 0 }]]) assert.equal(parseIncomeEvidence(JSON.stringify({ ...data, cases })), undefined);
});
