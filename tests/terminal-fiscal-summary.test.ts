import assert from 'node:assert/strict';
import test from 'node:test';
import {
  aggregateTerminalFiscalRecords,
  attributeTerminalFiscalRecordsToEmployees,
  presentTerminalFiscalEmployeeControl,
  summarizeTerminalFiscalOutput,
} from '../lib/terminal-fiscal-summary';
import { suggestTerminalFiscalCashierMappings } from '../lib/terminal-fiscal-attribution';

test('aggregates only safe status, reason and ambiguity counters', () => {
  const aggregate = aggregateTerminalFiscalRecords([
    { status: 'confirmed', reasonCode: 'MATCH_CONFIRMED', candidateCount: 1 },
    { status: 'needs_review', reasonCode: 'ONE_C_MULTIPLE_CANDIDATES', candidateCount: 2 },
  ]);
  assert.deepEqual(aggregate.statuses, { confirmed: 1, pending: 0, mismatch: 0, unavailable: 0, needs_review: 1 });
  assert.deepEqual(aggregate.reasonCodes, { MATCH_CONFIRMED: 1, ONE_C_MULTIPLE_CANDIDATES: 1 });
  assert.equal(aggregate.total, 2);
  assert.equal(aggregate.ambiguities, 1);
  assert.equal(JSON.stringify(aggregate).includes('bankOperationKey'), false);
});

test('runner output summary keeps all employee and incident side effects disabled', () => {
  const summary = summarizeTerminalFiscalOutput({ version: 'mvp-1', evaluatedAt: '2026-08-11T00:00:00.000Z', records: [] });
  assert.deepEqual(summary.safety, { employeeVisible: false, incidentCreation: false, notifications: false });
});

test('uses names only to suggest a cashier mapping that still requires confirmation', () => {
  const suggestions = suggestTerminalFiscalCashierMappings([
    { ref: 'cashier-milana', name: 'Чеченова Милана' },
  ], [
    { userId: 8, name: 'Чеченова Милана' },
    { userId: 7, name: 'Абшаева Зухра' },
  ]);
  assert.deepEqual(suggestions, [{
    cashierRef: 'cashier-milana', cashierName: 'Чеченова Милана', employeeId: 8, candidateCount: 1, confirmationRequired: true,
  }]);
});

test('attributes a fiscal result by the 1C cashier when assignment agrees', () => {
  const result = attributeTerminalFiscalRecordsToEmployees([
    {
      status: 'mismatch',
      reasonCode: 'OFD_ELECTRONIC_AMOUNT_MISMATCH',
      candidateCount: 1,
      bankOperationAt: new Date('2026-08-09T07:30:00.000Z'),
      oneCCashRegisterRef: 'kkm-1',
      oneCCashierRef: 'cashier-milana',
    },
  ], [
    {
      userId: 7,
      oneCCashRegisterRef: 'kkm-1',
      effectiveFrom: new Date('2026-08-09T06:00:00.000Z'),
      effectiveTo: new Date('2026-08-09T15:00:00.000Z'),
    },
  ], [{ userId: 7, oneCCashierRef: 'cashier-milana' }]);
  assert.equal(result.byUser.get(7)?.statuses.mismatch, 1);
  assert.equal(result.unassigned.total, 0);
});

test('does not accuse an employee when KKM assignments overlap or are absent', () => {
  const record = {
    status: 'mismatch' as const,
    reasonCode: 'OFD_TOTAL_AMOUNT_MISMATCH' as const,
    candidateCount: 1,
    bankOperationAt: new Date('2026-08-09T07:30:00.000Z'),
    oneCCashRegisterRef: 'kkm-1',
    oneCCashierRef: null,
  };
  const result = attributeTerminalFiscalRecordsToEmployees([record], [
    { userId: 7, oneCCashRegisterRef: 'kkm-1', effectiveFrom: new Date('2026-08-09T06:00:00.000Z'), effectiveTo: null },
    { userId: 8, oneCCashRegisterRef: 'kkm-1', effectiveFrom: new Date('2026-08-09T07:00:00.000Z'), effectiveTo: null },
  ]);
  assert.equal(result.byUser.size, 0);
  assert.equal(result.unassigned.statuses.needs_review, 1);
});

test('uses half-open assignment intervals at a KKM handover boundary', () => {
  const record = {
    status: 'confirmed' as const,
    reasonCode: 'MATCH_CONFIRMED' as const,
    candidateCount: 1,
    bankOperationAt: new Date('2026-08-09T09:00:00.000Z'),
    oneCCashRegisterRef: 'kkm-1',
    oneCCashierRef: null,
  };
  const result = attributeTerminalFiscalRecordsToEmployees([record], [
    { userId: 7, oneCCashRegisterRef: 'kkm-1', effectiveFrom: new Date('2026-08-09T06:00:00.000Z'), effectiveTo: new Date('2026-08-09T09:00:00.000Z') },
    { userId: 8, oneCCashRegisterRef: 'kkm-1', effectiveFrom: new Date('2026-08-09T09:00:00.000Z'), effectiveTo: null },
  ]);
  assert.equal(result.byUser.has(7), false);
  assert.equal(result.byUser.get(8)?.statuses.confirmed, 1);
});

test('uses the 1C cashier when OFD is absent', () => {
  const result = attributeTerminalFiscalRecordsToEmployees([{
    status: 'needs_review', reasonCode: 'OFD_RECEIPT_NOT_FOUND', candidateCount: 1,
    bankOperationAt: new Date('2026-08-09T07:30:00.000Z'), oneCCashRegisterRef: 'kkm-1', oneCCashierRef: 'cashier-zukhra',
  }], [], [{ userId: 7, oneCCashierRef: 'cashier-zukhra' }]);
  assert.equal(result.byUser.get(7)?.statuses.needs_review, 1);
  assert.equal(result.unassigned.total, 0);
});

test('falls back to one unambiguous KKM assignment when cashier is absent', () => {
  const result = attributeTerminalFiscalRecordsToEmployees([{
    status: 'mismatch', reasonCode: 'OFD_TOTAL_AMOUNT_MISMATCH', candidateCount: 1,
    bankOperationAt: new Date('2026-08-09T07:30:00.000Z'), oneCCashRegisterRef: 'kkm-1', oneCCashierRef: null,
  }], [{ userId: 7, oneCCashRegisterRef: 'kkm-1', effectiveFrom: new Date('2026-08-09T06:00:00.000Z'), effectiveTo: null }]);
  assert.equal(result.byUser.get(7)?.statuses.mismatch, 1);
});

test('cashier and assignment conflict becomes unassigned needs_review', () => {
  const result = attributeTerminalFiscalRecordsToEmployees([{
    status: 'mismatch', reasonCode: 'OFD_TOTAL_AMOUNT_MISMATCH', candidateCount: 1,
    bankOperationAt: new Date('2026-08-09T07:30:00.000Z'), oneCCashRegisterRef: 'kkm-1', oneCCashierRef: 'cashier-milana',
  }], [{ userId: 7, oneCCashRegisterRef: 'kkm-1', effectiveFrom: new Date('2026-08-09T06:00:00.000Z'), effectiveTo: null }], [{ userId: 8, oneCCashierRef: 'cashier-milana' }]);
  assert.equal(result.byUser.size, 0);
  assert.equal(result.unassigned.statuses.needs_review, 1);
  assert.equal(result.unassigned.statuses.mismatch, 0);
});

test('missing 1C check remains an admin problem without Employee even with an assignment', () => {
  const result = attributeTerminalFiscalRecordsToEmployees([{
    status: 'needs_review', reasonCode: 'ONE_C_CANDIDATE_NOT_FOUND', candidateCount: 0,
    bankOperationAt: new Date('2026-08-09T07:30:00.000Z'), oneCCashRegisterRef: 'kkm-1', oneCCashierRef: null,
  }], [{ userId: 7, oneCCashRegisterRef: 'kkm-1', effectiveFrom: new Date('2026-08-09T06:00:00.000Z'), effectiveTo: null }]);
  assert.equal(result.byUser.size, 0);
  assert.equal(result.unassigned.reasonCodes.ONE_C_CANDIDATE_NOT_FOUND, 1);
});

test('employee control presentation distinguishes proof from uncertain source states', () => {
  const base = {
    userId: 7,
    total: 1,
    statuses: { confirmed: 0, pending: 0, mismatch: 0, unavailable: 0, needs_review: 0 },
    reasonCodes: {},
    ambiguities: 0,
    lastOperationAt: new Date('2026-08-09T09:00:00.000Z'),
  };
  assert.equal(presentTerminalFiscalEmployeeControl({ ...base, statuses: { ...base.statuses, mismatch: 1 } }).tone, 'error');
  assert.equal(presentTerminalFiscalEmployeeControl({ ...base, statuses: { ...base.statuses, needs_review: 1 } }).tone, 'attention');
  assert.equal(presentTerminalFiscalEmployeeControl({ ...base, statuses: { ...base.statuses, unavailable: 1 } }).tone, 'attention');
  assert.equal(presentTerminalFiscalEmployeeControl({ ...base, statuses: { ...base.statuses, pending: 1 } }).tone, 'pending');
  assert.equal(presentTerminalFiscalEmployeeControl({ ...base, statuses: { ...base.statuses, confirmed: 1 } }).tone, 'normal');
  assert.equal(presentTerminalFiscalEmployeeControl(null).tone, 'none');
});
