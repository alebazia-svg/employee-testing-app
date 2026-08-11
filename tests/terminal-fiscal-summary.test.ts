import assert from 'node:assert/strict';
import test from 'node:test';
import { aggregateTerminalFiscalRecords, summarizeTerminalFiscalOutput } from '../lib/terminal-fiscal-summary';

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
