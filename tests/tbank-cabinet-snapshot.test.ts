import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { loadTBankCabinetOperations, parseTBankCabinetSnapshot } from '../lib/tbank-cabinet-snapshot';

const now = new Date('2026-09-03T17:00:00.000Z');
const valid = {
  version: 1,
  generatedAt: '2026-09-03T16:55:00.000Z',
  periodFrom: '2026-09-01T00:00:00.000Z',
  periodTo: '2026-09-03T17:02:00.000Z',
  complete: true,
  operations: [{
    operationId: 'qr-operation', terminalKey: 'terminal-2', transactionDate: '2026-09-03T16:39:27+03:00',
    amountKopecks: 50000, type: 'Debit', source: 'TERM_SBP',
  }],
};

test('accepts a complete card-and-QR cabinet snapshot and produces a stable identity', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'tbank-cabinet-'));
  const file = path.join(directory, 'current.json');
  await writeFile(file, JSON.stringify(valid));
  const result = await loadTBankCabinetOperations({
    path: file, terminalKey: 'terminal-2', from: '2026-09-03T13:00:00.000Z', to: '2026-09-03T14:00:00.000Z', now,
  });
  assert.equal(result.complete, true);
  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].rrn, 'cabinet:qr-operation');
  assert.equal(result.data[0].rawType, 'TERM_SBP');
});

test('fails closed for stale or insufficient-period snapshots', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'tbank-cabinet-'));
  const file = path.join(directory, 'current.json');
  await writeFile(file, JSON.stringify({ ...valid, generatedAt: '2026-09-03T16:40:00.000Z' }));
  const stale = await loadTBankCabinetOperations({ path: file, terminalKey: 'terminal-2', from: '2026-09-03T13:00:00.000Z', to: '2026-09-03T14:00:00.000Z', now });
  assert.equal(stale.complete, false);
  assert.equal(stale.errorCode, 'TBANK_CABINET_SNAPSHOT_STALE');
  await writeFile(file, JSON.stringify(valid));
  const uncovered = await loadTBankCabinetOperations({ path: file, terminalKey: 'terminal-2', from: '2026-08-31T23:00:00.000Z', to: '2026-09-03T14:00:00.000Z', now });
  assert.equal(uncovered.complete, false);
  assert.equal(uncovered.errorCode, 'TBANK_CABINET_PERIOD_INCOMPLETE');
});

test('rejects unknown fields that would make an operation unsafe to reconcile', () => {
  assert.equal(parseTBankCabinetSnapshot({ ...valid, operations: [{ ...valid.operations[0], source: 'UNKNOWN' }] }), null);
  assert.equal(parseTBankCabinetSnapshot({ ...valid, operations: [...valid.operations, valid.operations[0]] }), null);
});
