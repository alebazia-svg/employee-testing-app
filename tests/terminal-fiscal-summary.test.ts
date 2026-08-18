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

test('attributes a fiscal result by the 1C cashier', () => {
  const result = attributeTerminalFiscalRecordsToEmployees([
    {
      status: 'mismatch',
      reasonCode: 'OFD_ELECTRONIC_AMOUNT_MISMATCH',
      candidateCount: 1,
      bankOperationAt: new Date('2026-08-09T07:30:00.000Z'),
      oneCCashierRef: 'cashier-milana',
    },
  ], [{ userId: 7, oneCCashierRef: 'cashier-milana' }]);
  assert.equal(result.byUser.get(7)?.statuses.mismatch, 1);
  assert.equal(result.unassigned.total, 0);
});

test('does not accuse an employee when the 1C cashier is absent', () => {
  const record = {
    status: 'mismatch' as const,
    reasonCode: 'OFD_TOTAL_AMOUNT_MISMATCH' as const,
    candidateCount: 1,
    bankOperationAt: new Date('2026-08-09T07:30:00.000Z'),
    oneCCashierRef: null,
  };
  const result = attributeTerminalFiscalRecordsToEmployees([record]);
  assert.equal(result.byUser.size, 0);
  assert.equal(result.unassigned.statuses.mismatch, 1);
});

test('uses the 1C cashier when OFD is absent', () => {
  const result = attributeTerminalFiscalRecordsToEmployees([{
    status: 'needs_review', reasonCode: 'OFD_RECEIPT_NOT_FOUND', candidateCount: 1,
    bankOperationAt: new Date('2026-08-09T07:30:00.000Z'), oneCCashierRef: 'cashier-zukhra',
  }], [{ userId: 7, oneCCashierRef: 'cashier-zukhra' }]);
  assert.equal(result.byUser.get(7)?.statuses.needs_review, 1);
  assert.equal(result.unassigned.total, 0);
});

test('missing 1C check remains an admin problem without Employee', () => {
  const result = attributeTerminalFiscalRecordsToEmployees([{
    status: 'needs_review', reasonCode: 'ONE_C_CANDIDATE_NOT_FOUND', candidateCount: 0,
    bankOperationAt: new Date('2026-08-09T07:30:00.000Z'), oneCCashierRef: null,
  }]);
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

test('item presentation differences stay normal for the employee after financial confirmation', () => {
  const result = attributeTerminalFiscalRecordsToEmployees([{
    status: 'confirmed', reasonCode: 'OFD_ITEM_PRESENTATION_DIFFERENCE', candidateCount: 1,
    bankOperationAt: new Date('2026-08-18T07:03:22.000Z'), oneCCashierRef: 'cashier-milana',
  }], [{ userId: 3, oneCCashierRef: 'cashier-milana' }]);
  const control = result.byUser.get(3) ?? null;
  assert.equal(presentTerminalFiscalEmployeeControl(control).tone, 'normal');
  assert.match(presentTerminalFiscalEmployeeControl(control).text, /подтверждены: 1/);
});
