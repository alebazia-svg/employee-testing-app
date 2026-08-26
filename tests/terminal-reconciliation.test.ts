import assert from 'node:assert/strict';
import test from 'node:test';
import { reconcileTerminalOperations, tBankTerminalOneCMapping } from '../lib/terminal-reconciliation';

const operation = {
  rrn: 'rrn', transactionDate: '2026-08-17T16:26:39.000Z', amountKopecks: 50_000,
  amountRubles: 500, type: 'Debit' as const, maskedCardNumber: '•••• 0000',
};
const check = {
  ref: 'check-ref', number: '00OF-002948', datetime: '2026-08-17T19:33:56', amount: 500,
  paymentForm: 'Платежная карта', cashRegister: { ref: 'cashbox', name: 'Касса Абшаева ККМ' },
  organization: { ref: 'organization', name: 'ОООФОНИКА' },
  cashier: { ref: 'cashier', name: 'Костеренко Магомед' },
  cashReceived: 0,
};

test('reconciles the real 17 August payment with its unique check seven minutes later', () => {
  const result = reconcileTerminalOperations({ operations: [operation], checks: [check], cashRegisterName: 'Касса Абшаева ККМ' });
  assert.equal(result.matched.length, 1);
  assert.equal(result.matched[0].check.number, '00OF-002948');
  assert.equal(result.matched[0].timeDifferenceSeconds, 437);
  assert.equal(result.onlyTBank.length, 0);
  assert.equal(result.onlyOneC.length, 0);
});

test('both physical T-Bank terminals are mapped to their own 1C cash registers', () => {
  assert.deepEqual(tBankTerminalOneCMapping['1010808747019437'], {
    cashRegisterName: 'Касса Чеченова ККМ',
    acquiringTerminalName: 'Терминал Ногмова Бэла ИП',
  });
  assert.deepEqual(tBankTerminalOneCMapping['2332022071'], {
    cashRegisterName: 'Касса Абшаева ККМ',
    acquiringTerminalName: 'Терминал Ногмова Бэла ИП',
  });
});

test('does not guess when only part of a repeated-amount bucket has a check', () => {
  const second = { ...operation, rrn: 'rrn-2', transactionDate: '2026-08-17T17:00:00.000Z' };
  const result = reconcileTerminalOperations({ operations: [operation, second], checks: [check], cashRegisterName: 'Касса Абшаева ККМ' });
  assert.equal(result.matched.length, 0);
  assert.equal(result.onlyTBank.length, 2);
  assert.equal(result.onlyOneC.length, 1);
});
