import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeOneCDateTime } from '../lib/terminal-fiscal-one-c-adapter';
import { normalizeOneCCheck } from '../lib/terminal-fiscal-sources';

test('normalizes production 1C Russian and compact dates as Europe/Moscow', () => {
  assert.equal(normalizeOneCDateTime('09.08.2026 13:15:30'), '2026-08-09T10:15:30.000Z');
  assert.equal(normalizeOneCDateTime('20260809131530'), '2026-08-09T10:15:30.000Z');
});

test('normalizes a production 1C Russian date with a one-digit hour', () => {
  assert.equal(normalizeOneCDateTime('10.08.2026 9:22:08'), '2026-08-10T06:22:08.000Z');
});

test('keeps stable cashier ref and name from the production /kkm-checks DTO', () => {
  const check = normalizeOneCCheck({
    sourceRef: 'check-1', sourceDocumentType: 'sale_check', operationType: 'sale', date: '09.08.2026 13:15:30',
    cashRegister: { ref: 'kkm-1', name: 'ККМ 1' }, cashier: { ref: 'cashier-milana', name: 'Чеченова Милана' },
    amountKopecks: 10000, electronicKopecks: 10000, cardPayments: [], items: [], fiscalState: 'unconfirmed',
  }, new Map());
  assert.deepEqual(check?.cashier, { ref: 'cashier-milana', name: 'Чеченова Милана' });
});

test('preserves explicit offsets and rejects invalid dates', () => {
  assert.equal(normalizeOneCDateTime('2026-08-09T10:15:30.000Z'), '2026-08-09T10:15:30.000Z');
  assert.equal(normalizeOneCDateTime('invalid'), '');
});
