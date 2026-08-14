import assert from 'node:assert/strict';
import test from 'node:test';
import {
  aggregateTerminalFiscalRecords,
  attributeTerminalFiscalRecordsToEmployees,
  presentTerminalFiscalEmployeeControl,
  summarizeTerminalFiscalOutput,
} from '../lib/terminal-fiscal-summary';

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

test('attributes a fiscal result only to one exact KKM assignment interval', () => {
  const result = attributeTerminalFiscalRecordsToEmployees([
    {
      status: 'mismatch',
      reasonCode: 'OFD_ELECTRONIC_AMOUNT_MISMATCH',
      candidateCount: 1,
      bankOperationAt: new Date('2026-08-09T07:30:00.000Z'),
      oneCCashRegisterRef: 'kkm-1',
    },
  ], [
    {
      userId: 7,
      oneCCashRegisterRef: 'kkm-1',
      effectiveFrom: new Date('2026-08-09T06:00:00.000Z'),
      effectiveTo: new Date('2026-08-09T15:00:00.000Z'),
    },
  ]);
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
  };
  const result = attributeTerminalFiscalRecordsToEmployees([record], [
    { userId: 7, oneCCashRegisterRef: 'kkm-1', effectiveFrom: new Date('2026-08-09T06:00:00.000Z'), effectiveTo: null },
    { userId: 8, oneCCashRegisterRef: 'kkm-1', effectiveFrom: new Date('2026-08-09T07:00:00.000Z'), effectiveTo: null },
  ]);
  assert.equal(result.byUser.size, 0);
  assert.equal(result.unassigned.statuses.mismatch, 1);
});

test('uses half-open assignment intervals at a KKM handover boundary', () => {
  const record = {
    status: 'confirmed' as const,
    reasonCode: 'MATCH_CONFIRMED' as const,
    candidateCount: 1,
    bankOperationAt: new Date('2026-08-09T09:00:00.000Z'),
    oneCCashRegisterRef: 'kkm-1',
  };
  const result = attributeTerminalFiscalRecordsToEmployees([record], [
    { userId: 7, oneCCashRegisterRef: 'kkm-1', effectiveFrom: new Date('2026-08-09T06:00:00.000Z'), effectiveTo: new Date('2026-08-09T09:00:00.000Z') },
    { userId: 8, oneCCashRegisterRef: 'kkm-1', effectiveFrom: new Date('2026-08-09T09:00:00.000Z'), effectiveTo: null },
  ]);
  assert.equal(result.byUser.has(7), false);
  assert.equal(result.byUser.get(8)?.statuses.confirmed, 1);
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
