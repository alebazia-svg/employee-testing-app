import assert from 'node:assert/strict';
import test from 'node:test';
import { attributeTerminalFiscalEmployee, suggestTerminalFiscalCashierMappings } from '../lib/terminal-fiscal-attribution';
import { terminalFiscalMappingConflictFields } from '../lib/terminal-fiscal-mapping-validation';

const from = new Date('2026-08-17T06:00:00.000Z');

test('shared 1C acquiring terminal is allowed for independent physical chains', () => {
  const first = {
    terminalKey: 'terminal-1', oneCAcquiringTerminalRef: 'shared-acquiring', oneCCashRegisterRef: 'kkm-1',
    kktRegistrationNumber: 'kkt-1', effectiveFrom: from, effectiveTo: null,
  };
  const second = {
    terminalKey: 'terminal-2', oneCAcquiringTerminalRef: 'shared-acquiring', oneCCashRegisterRef: 'kkm-2',
    kktRegistrationNumber: 'kkt-2', effectiveFrom: from, effectiveTo: null,
  };
  assert.deepEqual(terminalFiscalMappingConflictFields(second, first), []);
});

test('mapping rejects only overlapping physical identifiers and permits historical reuse', () => {
  const existing = {
    terminalKey: 'terminal-1', oneCAcquiringTerminalRef: 'shared', oneCCashRegisterRef: 'kkm-1',
    kktRegistrationNumber: 'kkt-1', effectiveFrom: from, effectiveTo: new Date('2026-08-18T00:00:00.000Z'),
  };
  const overlapping = { ...existing, oneCAcquiringTerminalRef: 'other', effectiveFrom: new Date('2026-08-17T12:00:00.000Z'), effectiveTo: null };
  assert.deepEqual(terminalFiscalMappingConflictFields(overlapping, existing), ['terminalKey', 'oneCCashRegisterRef', 'kktRegistrationNumber']);
  const later = { ...overlapping, effectiveFrom: new Date('2026-08-18T00:00:00.000Z') };
  assert.deepEqual(terminalFiscalMappingConflictFields(later, existing), []);
});

test('1C cashier is the only source of employee attribution', () => {
  const result = attributeTerminalFiscalEmployee({
    status: 'mismatch', reasonCode: 'OFD_TOTAL_AMOUNT_MISMATCH', oneCCashierRef: 'cashier-magomed',
  }, [{ userId: 5, oneCCashierRef: 'cashier-magomed' }]);
  assert.deepEqual(result, { employeeId: 5, effectiveStatus: 'mismatch', source: 'one_c_cashier', adminProblem: false });
});

test('bank operation without a 1C check stays admin-only and is never personalized', () => {
  const result = attributeTerminalFiscalEmployee({
    status: 'needs_review', reasonCode: 'ONE_C_CANDIDATE_NOT_FOUND', oneCCashierRef: null,
  }, []);
  assert.deepEqual(result, { employeeId: null, effectiveStatus: 'needs_review', source: 'none', adminProblem: true });
});

test('mismatch without a mapped 1C cashier remains unassigned', () => {
  const result = attributeTerminalFiscalEmployee({
    status: 'mismatch', reasonCode: 'OFD_TOTAL_AMOUNT_MISMATCH', oneCCashierRef: null,
  }, []);
  assert.deepEqual(result, { employeeId: null, effectiveStatus: 'mismatch', source: 'none', adminProblem: false });
});

test('duplicate active cashier mappings fail closed', () => {
  const result = attributeTerminalFiscalEmployee({
    status: 'mismatch', reasonCode: 'OFD_TOTAL_AMOUNT_MISMATCH', oneCCashierRef: 'cashier-milana',
  }, [
    { userId: 3, oneCCashierRef: 'cashier-milana' },
    { userId: 4, oneCCashierRef: 'cashier-milana' },
  ]);
  assert.deepEqual(result, { employeeId: null, effectiveStatus: 'needs_review', source: 'conflict', adminProblem: true });
});

test('Magomed cashier ref preview is unambiguous only for Employee 5 and still requires confirmation', () => {
  assert.deepEqual(suggestTerminalFiscalCashierMappings([
    { ref: '0ae3-confirmed-3daf', name: 'Костеренко Магомед' },
  ], [
    { userId: 3, name: 'Чеченова Милана' },
    { userId: 4, name: 'Абшаева Зухра' },
    { userId: 5, name: 'Костеренко Магомед' },
  ]), [{
    cashierRef: '0ae3-confirmed-3daf', cashierName: 'Костеренко Магомед', employeeId: 5,
    candidateCount: 1, confirmationRequired: true,
  }]);
});
