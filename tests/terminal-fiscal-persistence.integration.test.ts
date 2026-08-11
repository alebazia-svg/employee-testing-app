import assert from 'node:assert/strict';
import test from 'node:test';
import { PrismaClient } from '@prisma/client';
import {
  acquireTerminalFiscalRunLease,
  persistTerminalFiscalCycle,
  terminalFiscalCycleKey,
  terminalFiscalRunKey,
} from '../lib/terminal-fiscal-persistence';
import type { TerminalFiscalMatchingOutput } from '../lib/terminal-fiscal-matching';
import { runTerminalFiscalHistoricalDryRun } from '../lib/terminal-fiscal-runner';
import { getTerminalFiscalAuditSummary } from '../lib/terminal-fiscal-summary';

const prisma = new PrismaClient();
const marker = `test-${Date.now()}`;
let persistedMappingId = '';
const persistedPeriodFrom = new Date('2026-08-10T06:00:00.000Z');
const persistedPeriodTo = new Date('2026-08-10T07:00:00.000Z');

test.after(async () => {
  const mappings = await prisma.terminalFiscalMapping.findMany({ where: { label: marker }, select: { id: true } });
  const mappingIds = mappings.map(({ id }) => id);
  const runs = await prisma.terminalFiscalMatchRun.findMany({ where: { mappingId: { in: mappingIds } }, select: { id: true } });
  const runIds = runs.map(({ id }) => id);
  await prisma.terminalFiscalMatchEvaluation.deleteMany({ where: { runId: { in: runIds } } });
  await prisma.terminalFiscalMatch.deleteMany({ where: { mappingId: { in: mappingIds } } });
  await prisma.terminalFiscalMatchRun.deleteMany({ where: { id: { in: runIds } } });
  await prisma.terminalFiscalMapping.deleteMany({ where: { label: marker } });
  await prisma.$disconnect();
});

test('database lease is exclusive, expirable and cycle persistence is idempotent', async () => {
  const mapping = await prisma.terminalFiscalMapping.create({
    data: {
      label: marker,
      terminalKey: `${marker}-terminal`,
      oneCAcquiringTerminalRef: `${marker}-acquiring`,
      oneCCashRegisterRef: `${marker}-cash`,
      kktRegistrationNumber: `${marker}-kkt`,
      effectiveFrom: new Date('2026-08-10T00:00:00.000Z'),
    },
  });
  persistedMappingId = mapping.id;
  const periodFrom = persistedPeriodFrom;
  const periodTo = persistedPeriodTo;
  const leaseInput = { algorithmVersion: 'mvp-1', mappingId: mapping.id, periodFrom, periodTo };
  const [first, second] = await Promise.all([
    acquireTerminalFiscalRunLease(prisma, leaseInput),
    acquireTerminalFiscalRunLease(prisma, leaseInput),
  ]);
  const winner = first ?? second;
  assert.ok(winner);
  assert.equal([first, second].filter(Boolean).length, 1);
  assert.equal(winner.runKey, terminalFiscalRunKey(leaseInput));

  const checkedAt = { tbank: '2026-08-10T08:00:00.000Z', oneC: '2026-08-10T08:00:01.000Z', ofd: '2026-08-10T08:00:02.000Z' };
  const cycleKey = terminalFiscalCycleKey({ runKey: winner.runKey, sourceIdentityHashes: ['a', 'b'], evaluationIdentityHashes: ['confirmed'] });
  const evaluatedAt = '2026-08-10T08:00:03.000Z';
  const output: TerminalFiscalMatchingOutput = {
    version: 'mvp-1',
    evaluatedAt,
    records: [{
      matchingKey: `${marker}-match`, version: 'mvp-1', status: 'confirmed', reasonCode: 'MATCH_CONFIRMED',
      evaluatedAt, graceUntil: '2026-08-10T09:00:00.000Z', mappingId: mapping.id,
      bankOperationKey: `${marker}-bank`, oneCCheckKey: `${marker}-check`, ofdReceiptKey: `${marker}-ofd`,
      operationType: 'sale', amountKopecks: 100, timeDifferenceSeconds: 5, candidateCount: 1,
      evidence: { bankTransactionDate: evaluatedAt }, sourceCheckedAt: checkedAt,
      sourceCompleteness: { tbank: true, oneC: true, ofd: true },
      history: [{ at: evaluatedAt, status: 'confirmed', reasonCode: 'MATCH_CONFIRMED' }],
    }],
  };
  const persisted = await persistTerminalFiscalCycle(prisma, {
    lease: winner,
    cycleKey,
    output,
    sourceCheckedAt: checkedAt,
    sourceCompleteness: { tbank: true, oneC: true, ofd: true },
  });
  assert.deepEqual(persisted, { evaluationsCreated: 1, records: 1 });

  const retryLease = await acquireTerminalFiscalRunLease(prisma, leaseInput);
  assert.ok(retryLease);
  const retried = await persistTerminalFiscalCycle(prisma, {
    lease: retryLease,
    cycleKey,
    output,
    sourceCheckedAt: checkedAt,
    sourceCompleteness: { tbank: true, oneC: true, ofd: true },
  });
  assert.deepEqual(retried, { evaluationsCreated: 0, records: 1 });
  assert.equal(await prisma.terminalFiscalMatch.count({ where: { mappingId: mapping.id } }), 1);
  assert.equal(await prisma.terminalFiscalMatchEvaluation.count({ where: { runId: winner.runId } }), 1);

  const held = await acquireTerminalFiscalRunLease(prisma, leaseInput);
  assert.ok(held);
  assert.equal(await acquireTerminalFiscalRunLease(prisma, leaseInput), null);
  await prisma.terminalFiscalMatchRun.update({ where: { id: held.runId }, data: { leaseUntil: new Date(0) } });
  assert.ok(await acquireTerminalFiscalRunLease(prisma, leaseInput));
});

test('migration contains partial unique assignment guards', async () => {
  const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
    SELECT indexname FROM pg_indexes
    WHERE schemaname = current_schema()
      AND indexname IN (
        'TerminalFiscalMatch_active_bank_operation_key',
        'TerminalFiscalMatch_active_one_c_check_key',
        'TerminalFiscalMatch_active_ofd_receipt_key'
      )
  `;
  assert.equal(indexes.length, 3);
});

test('cycle key ignores fetch timestamps but changes when evaluation state changes', () => {
  const common = { runKey: 'run', sourceIdentityHashes: ['source-b', 'source-a'] };
  const first = terminalFiscalCycleKey({ ...common, evaluationIdentityHashes: ['confirmed'] });
  const sameSnapshot = terminalFiscalCycleKey({ runKey: 'run', sourceIdentityHashes: ['source-a', 'source-b'], evaluationIdentityHashes: ['confirmed'] });
  const transitioned = terminalFiscalCycleKey({ ...common, evaluationIdentityHashes: ['needs-review'] });
  assert.equal(first, sameSnapshot);
  assert.notEqual(first, transitioned);
});

test('a corrected source identity reuses the existing audit match without violating assignment guards', async () => {
  const mapping = await prisma.terminalFiscalMapping.create({
    data: {
      label: marker,
      terminalKey: `${marker}-identity-terminal`,
      oneCAcquiringTerminalRef: `${marker}-identity-acquiring`,
      oneCCashRegisterRef: `${marker}-identity-cash`,
      kktRegistrationNumber: `${marker}-identity-kkt`,
      effectiveFrom: new Date('2026-08-10T00:00:00.000Z'),
    },
  });
  const leaseInput = {
    algorithmVersion: 'mvp-1', mappingId: mapping.id,
    periodFrom: new Date('2026-08-10T10:00:00.000Z'), periodTo: new Date('2026-08-10T11:00:00.000Z'),
  };
  const checkedAt = { tbank: '2026-08-10T12:00:00.000Z', oneC: '2026-08-10T12:00:01.000Z', ofd: '2026-08-10T12:00:02.000Z' };
  const makeOutput = (bankOperationKey: string, matchingKey: string, evaluatedAt: string): TerminalFiscalMatchingOutput => ({
    version: 'mvp-1', evaluatedAt,
    records: [{
      matchingKey, version: 'mvp-1', status: 'confirmed', reasonCode: 'MATCH_CONFIRMED', evaluatedAt,
      graceUntil: '2026-08-10T13:00:00.000Z', mappingId: mapping.id, bankOperationKey,
      oneCCheckKey: `${marker}-identity-check`, ofdReceiptKey: `${marker}-identity-ofd`, operationType: 'sale',
      amountKopecks: 100, timeDifferenceSeconds: 5, candidateCount: 1,
      evidence: { bankTransactionDate: evaluatedAt }, sourceCheckedAt: checkedAt,
      sourceCompleteness: { tbank: true, oneC: true, ofd: true },
      history: [{ at: evaluatedAt, status: 'confirmed', reasonCode: 'MATCH_CONFIRMED' }],
    }],
  });
  const firstLease = await acquireTerminalFiscalRunLease(prisma, leaseInput);
  assert.ok(firstLease);
  await persistTerminalFiscalCycle(prisma, {
    lease: firstLease, cycleKey: `${marker}-identity-cycle-1`,
    output: makeOutput(`${marker}-old-bank`, `${marker}-old-match`, '2026-08-10T12:00:03.000Z'),
    sourceCheckedAt: checkedAt, sourceCompleteness: { tbank: true, oneC: true, ofd: true },
  });
  const secondLease = await acquireTerminalFiscalRunLease(prisma, leaseInput);
  assert.ok(secondLease);
  await persistTerminalFiscalCycle(prisma, {
    lease: secondLease, cycleKey: `${marker}-identity-cycle-2`,
    output: makeOutput(`${marker}-corrected-bank`, `${marker}-corrected-match`, '2026-08-10T12:05:03.000Z'),
    sourceCheckedAt: checkedAt, sourceCompleteness: { tbank: true, oneC: true, ofd: true },
  });
  assert.equal(await prisma.terminalFiscalMatch.count({ where: { mappingId: mapping.id } }), 1);
  assert.equal(await prisma.terminalFiscalMatchEvaluation.count({ where: { runId: firstLease.runId } }), 2);
});

test('audit summary reads an existing run without changing any audit table', async () => {
  assert.ok(persistedMappingId);
  const before = await Promise.all([
    prisma.terminalFiscalMapping.count(), prisma.terminalFiscalMatchRun.count(),
    prisma.terminalFiscalMatch.count(), prisma.terminalFiscalMatchEvaluation.count(),
  ]);
  const summary = await getTerminalFiscalAuditSummary({
    mappingId: persistedMappingId,
    periodFrom: persistedPeriodFrom,
    periodTo: persistedPeriodTo,
  });
  assert.ok(summary);
  assert.equal(summary.total, 1);
  assert.equal(summary.statuses.confirmed, 1);
  assert.deepEqual(summary.safety, { employeeVisible: false, incidentCreation: false, notifications: false });
  assert.deepEqual(await Promise.all([
    prisma.terminalFiscalMapping.count(), prisma.terminalFiscalMatchRun.count(),
    prisma.terminalFiscalMatch.count(), prisma.terminalFiscalMatchEvaluation.count(),
  ]), before);
});

test('runner without explicit persist leaves all four audit tables unchanged', async () => {
  const mapping = await prisma.terminalFiscalMapping.create({
    data: {
      label: marker,
      terminalKey: `${marker}-dry-terminal`,
      oneCAcquiringTerminalRef: `${marker}-dry-acquiring`,
      oneCCashRegisterRef: `${marker}-dry-cash`,
      kktRegistrationNumber: `${marker}-dry-kkt`,
      effectiveFrom: new Date('2026-08-10T00:00:00.000Z'),
    },
  });
  const before = await Promise.all([
    prisma.terminalFiscalMapping.count(), prisma.terminalFiscalMatchRun.count(),
    prisma.terminalFiscalMatch.count(), prisma.terminalFiscalMatchEvaluation.count(),
  ]);
  const checkedAt = '2026-08-11T00:00:00.000Z';
  const result = await runTerminalFiscalHistoricalDryRun({
    mappingId: mapping.id,
    periodFrom: new Date('2026-08-10T06:00:00.000Z'),
    periodTo: new Date('2026-08-10T07:00:00.000Z'),
  }, {
    loadTbank: async () => ({ complete: true, checkedAt, data: [] }),
    loadOneC: async () => ({ complete: true, checkedAt, data: [] }),
    loadOfd: async () => ({ complete: true, checkedAt, data: [] }),
  });
  assert.equal(result.acquired, true);
  assert.equal(result.persisted, false);
  assert.deepEqual(await Promise.all([
    prisma.terminalFiscalMapping.count(), prisma.terminalFiscalMatchRun.count(),
    prisma.terminalFiscalMatch.count(), prisma.terminalFiscalMatchEvaluation.count(),
  ]), before);
});
