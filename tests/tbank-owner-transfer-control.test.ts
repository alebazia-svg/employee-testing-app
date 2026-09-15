import assert from 'node:assert/strict';
import test from 'node:test';
import { parseTBankOwnerTransferStatement, tbankTransferPeriod } from '../lib/tbank-owner-transfer-control';

const operation = (number: string, date: string, amount: number, purpose: string) => ({
  direction: 'outgoing', document_number: number, document_date: date, operation_date: date,
  amount, purpose,
});

function payload(operations: unknown[]) {
  return {
    ok: true, endpoint: 'bank-exchange-statement-operations',
    control_period: { date_from: '2026-08-22', date_to: '2026-09-15' },
    statement_summaries: [{ period_start: '2026-09-15', period_end: '2026-09-15', statement_balance_valid: true }],
    warnings: [],
    operations_found: operations.length, operations_returned: operations.length, operations,
  };
}

test('uses the 22nd as the tariff renewal boundary', () => {
  assert.deepEqual(tbankTransferPeriod('2026-09-15'), { periodFrom: '2026-08-22', renewsOn: '2026-09-22' });
  assert.deepEqual(tbankTransferPeriod('2026-09-22'), { periodFrom: '2026-09-22', renewsOn: '2026-10-22' });
});

test('deduplicates overlapping statements and calculates the live 1 percent remainder', () => {
  const rows = [
    operation('1', '2026-08-24', 700_000, 'Перевод собственных средств'),
    operation('2', '2026-08-24', 8_490, 'Комиссия за пакет Физлицам — без комиссии'),
    operation('3', '2026-08-28', 500_000, 'Перевод собственных средств'),
    operation('4', '2026-09-01', 400_000, 'Перевод собственных средств'),
    operation('5', '2026-09-03', 500_000, 'Перевод собственных средств'),
    operation('6', '2026-09-03', 8_490, 'Комиссия за пакет Физлицам — без комиссии'),
    operation('7', '2026-09-11', 700_000, 'Перевод собственных средств'),
    operation('8', '2026-09-14', 500_000, 'Перевод собственных средств'),
    operation('9', '2026-09-14', 1_059, 'Комиссия за вывод средств на физ. лицо'),
  ];
  const result = parseTBankOwnerTransferStatement(payload([...rows, rows[0]]), '2026-09-15');
  assert.equal(result.status, 'verified');
  assert.equal(result.transferredMinor, 330_000_000);
  assert.equal(result.packagesPurchased, 2);
  assert.equal(result.freeLimitMinor, 320_000_000);
  assert.equal(result.freeRemainingMinor, 0);
  assert.equal(result.tierOneUsedMinor, 10_000_000);
  assert.equal(result.tierOneRemainingMinor, 70_000_000);
  assert.equal(result.currentRateBps, 100);
  assert.equal(result.nextTransferFeeMinor?.(10_000_000), 105_900);
});

test('fails closed for a truncated or wrong-period statement', () => {
  assert.equal(parseTBankOwnerTransferStatement({ ...payload([]), operations_found: 2 }, '2026-09-15').status, 'unavailable');
  assert.equal(parseTBankOwnerTransferStatement({ ...payload([]), control_period: { date_from: '2026-09-01', date_to: '2026-09-15' } }, '2026-09-15').status, 'unavailable');
});

test('does not publish an exact limit from a stale statement', () => {
  const stale = { ...payload([]), statement_summaries: [{ period_end: '2026-09-14', statement_balance_valid: true }] };
  const result = parseTBankOwnerTransferStatement(stale, '2026-09-15');
  assert.equal(result.status, 'unavailable');
  assert.deepEqual(result.diagnostics, ['statement_not_current']);
});

test('requires commission evidence after entering a paid tier', () => {
  const rows = [
    operation('1', '2026-08-24', 1_600_000, 'Перевод собственных средств'),
    operation('2', '2026-08-24', 8_490, 'Комиссия за пакет'),
    operation('3', '2026-09-03', 8_490, 'Комиссия за пакет'),
    operation('4', '2026-09-14', 1_700_000, 'Перевод собственных средств'),
  ];
  const result = parseTBankOwnerTransferStatement(payload(rows), '2026-09-15');
  assert.equal(result.status, 'review');
  assert.deepEqual(result.diagnostics, ['paid_tier_fee_not_found']);
});
