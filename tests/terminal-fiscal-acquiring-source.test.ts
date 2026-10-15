import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeOneCAcquiringOperation } from '../lib/terminal-fiscal-sources';

test('normalizes a native 1C acquiring operation into terminal evidence', () => {
  const result = normalizeOneCAcquiringOperation({
    period: '14.10.2026 17:41:41',
    registrar: 'Эквайринговая операция 00OF-000081 от 14.10.2026 17:41:41',
    registrar_type: 'Эквайринговая операция',
    movement_kind: 'Приход',
    money_type: 'Поступление по платежной карте',
    terminal: { name: 'Терминал Ногмова Бэла ИП', ref: 'f3942aeb-d5a2-11f0-b07c-002590803daf' },
    amount: 19900,
  });
  assert.ok(result);
  assert.equal(result.sourceType, 'acquiring_operation');
  assert.equal(result.operationType, 'sale');
  assert.equal(result.dateTime, '2026-10-14T14:41:41.000Z');
  assert.equal(result.electronicKopecks, 1_990_000);
  assert.equal(result.cardPayments[0].acquiringTerminalRef, 'f3942aeb-d5a2-11f0-b07c-002590803daf');
});

test('does not normalize KKM movements or malformed acquiring rows', () => {
  assert.equal(normalizeOneCAcquiringOperation({ registrar_type: 'Чек ККМ' }), null);
  assert.equal(normalizeOneCAcquiringOperation({
    registrar_type: 'Эквайринговая операция', movement_kind: 'Приход',
    money_type: 'Поступление по платежной карте', amount: 19900,
  }), null);
});
