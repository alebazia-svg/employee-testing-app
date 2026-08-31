import assert from 'node:assert/strict';
import test from 'node:test';
import type { OneCCheck } from '../lib/terminal-fiscal-matching';
import { detectOneCReturnPaymentConflicts } from '../lib/one-c-return-payment-control';

function check(overrides: Partial<OneCCheck>): OneCCheck {
  return {
    sourceRef: 'return-1', sourceType: 'refund_check', operationType: 'refund', dateTime: '2026-08-16T16:52:16.000Z',
    cashRegisterRef: 'kkm-1', kktRegistrationNumber: 'kkt-1', totalKopecks: 50000, cashKopecks: 50000,
    electronicKopecks: 50000, cashier: { ref: 'cashier-1', name: 'Абшаева Зухра' },
    cardPayments: [{ lineNumber: '1', amountKopecks: 50000, acquiringTerminalRef: 'terminal-1', referenceNumber: '', authorizationCode: '', terminalReceiptNumber: '' }],
    items: [], fiscalState: 'confirmed', fiscalStateMeaning: 'data_state_only', ...overrides,
  };
}

test('detects a refund recorded as both cash and an active card payment', () => {
  const conflicts = detectOneCReturnPaymentConflicts([check({})]);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].cashKopecks, 50000);
  assert.equal(conflicts[0].activeCardKopecks, 50000);
});

test('accepts normal cash-only and card-only refunds', () => {
  const cashOnly = check({ electronicKopecks: 0, cardPayments: [] });
  const cardOnly = check({ cashKopecks: 0 });
  assert.deepEqual(detectOneCReturnPaymentConflicts([cashOnly, cardOnly]), []);
});
