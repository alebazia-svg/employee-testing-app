import { createHash, randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import type { MatchingAuditRecord, TerminalFiscalMatchingOutput } from '@/lib/terminal-fiscal-matching';

export const TERMINAL_FISCAL_LEASE_MS = 15 * 60 * 1000;

function digest(parts: string[]) {
  return createHash('sha256').update(parts.join('|')).digest('hex');
}

export function terminalFiscalRunKey(input: {
  algorithmVersion: string;
  mappingId: string;
  periodFrom: Date;
  periodTo: Date;
}) {
  return digest([input.algorithmVersion, input.mappingId, input.periodFrom.toISOString(), input.periodTo.toISOString()]);
}

export function terminalFiscalCycleKey(input: {
  runKey: string;
  sourceIdentityHashes: string[];
  evaluationIdentityHashes?: string[];
}) {
  return digest([
    input.runKey,
    ...[...input.sourceIdentityHashes].sort(),
    ...[...(input.evaluationIdentityHashes ?? [])].sort(),
  ]);
}

export type RunLease = { runId: string; runKey: string; leaseToken: string; leaseUntil: Date };

export async function acquireTerminalFiscalRunLease(prisma: PrismaClient, input: {
  algorithmVersion: string;
  mappingId: string;
  periodFrom: Date;
  periodTo: Date;
  now?: Date;
}): Promise<RunLease | null> {
  const now = input.now ?? new Date();
  const runKey = terminalFiscalRunKey(input);
  const leaseToken = randomUUID();
  const leaseUntil = new Date(now.getTime() + TERMINAL_FISCAL_LEASE_MS);
  const run = await prisma.terminalFiscalMatchRun.upsert({
    where: { runKey },
    create: {
      runKey,
      algorithmVersion: input.algorithmVersion,
      mappingId: input.mappingId,
      periodFrom: input.periodFrom,
      periodTo: input.periodTo,
    },
    update: {},
    select: { id: true },
  });
  const claimed = await prisma.terminalFiscalMatchRun.updateMany({
    where: {
      id: run.id,
      OR: [{ leaseToken: null }, { leaseUntil: null }, { leaseUntil: { lte: now } }],
    },
    data: {
      leaseToken,
      leaseUntil,
      status: 'running',
      startedAt: now,
      completedAt: null,
      lastErrorCode: null,
      attemptCount: { increment: 1 },
    },
  });
  return claimed.count === 1 ? { runId: run.id, runKey, leaseToken, leaseUntil } : null;
}

export async function heartbeatTerminalFiscalRunLease(prisma: PrismaClient, lease: RunLease, now = new Date()) {
  const leaseUntil = new Date(now.getTime() + TERMINAL_FISCAL_LEASE_MS);
  const result = await prisma.terminalFiscalMatchRun.updateMany({
    where: { id: lease.runId, leaseToken: lease.leaseToken, leaseUntil: { gt: now } },
    data: { leaseUntil },
  });
  if (result.count !== 1) throw new Error('TERMINAL_FISCAL_LEASE_LOST');
  return { ...lease, leaseUntil };
}

function matchPersistenceData(record: MatchingAuditRecord, runId: string) {
  const matchingId = digest([record.matchingKey]);
  const bankOperationHash = digest([record.bankOperationKey]);
  const oneCSourceRef = record.reasonCode === 'ONE_C_CHECK_REUSED' ? null : record.oneCCheckKey ?? null;
  return {
    matchingId,
    runId,
    mappingId: record.mappingId ?? null,
    algorithmVersion: record.version,
    status: record.status,
    reasonCode: record.reasonCode,
    operationType: record.operationType ?? null,
    bankOperationHash,
    oneCSourceRef,
    oneCSourceHash: record.oneCCheckKey ? digest([record.oneCCheckKey]) : null,
    ofdFiscalKeyHash: record.ofdReceiptKey ? digest([record.ofdReceiptKey]) : null,
    candidateCount: record.candidateCount,
    timeDifferenceSeconds: record.timeDifferenceSeconds ?? null,
    graceUntil: new Date(record.graceUntil),
    tbankComplete: record.sourceCompleteness.tbank,
    oneCComplete: record.sourceCompleteness.oneC,
    ofdComplete: record.sourceCompleteness.ofd,
    checkedAt: new Date(record.evaluatedAt),
  };
}

export async function persistTerminalFiscalCycle(prisma: PrismaClient, input: {
  lease: RunLease;
  cycleKey: string;
  output: TerminalFiscalMatchingOutput;
  sourceCheckedAt: { tbank: string; oneC: string; ofd: string };
  sourceCompleteness: { tbank: boolean; oneC: boolean; ofd: boolean };
}) {
  return prisma.$transaction(async (tx) => {
    const owned = await tx.terminalFiscalMatchRun.findFirst({
      where: { id: input.lease.runId, leaseToken: input.lease.leaseToken, leaseUntil: { gt: new Date() } },
      select: { id: true },
    });
    if (!owned) throw new Error('TERMINAL_FISCAL_LEASE_LOST');

    let evaluationsCreated = 0;
    for (const record of input.output.records) {
      const data = matchPersistenceData(record, input.lease.runId);
      const identities = await tx.terminalFiscalMatch.findMany({
        where: {
          OR: [
            { matchingId: data.matchingId },
            { bankOperationHash: data.bankOperationHash },
            ...(data.oneCSourceRef ? [{ oneCSourceRef: data.oneCSourceRef }] : []),
            ...(data.ofdFiscalKeyHash ? [{ ofdFiscalKeyHash: data.ofdFiscalKeyHash }] : []),
          ],
        },
        select: { id: true },
      });
      const identityIds = [...new Set(identities.map(({ id }) => id))];
      if (identityIds.length > 1) throw new Error('TERMINAL_FISCAL_ASSIGNMENT_CONFLICT');
      const match = identityIds.length === 1
        ? await tx.terminalFiscalMatch.update({ where: { id: identityIds[0] }, data, select: { id: true } })
        : await tx.terminalFiscalMatch.create({ data, select: { id: true } });
      const evaluation = await tx.terminalFiscalMatchEvaluation.createMany({
        data: [{
          matchId: match.id,
          runId: input.lease.runId,
          cycleKey: input.cycleKey,
          algorithmVersion: record.version,
          status: record.status,
          reasonCode: record.reasonCode,
          mappingId: record.mappingId ?? null,
          bankOperationHash: data.bankOperationHash,
          oneCSourceRef: data.oneCSourceRef,
          oneCSourceHash: data.oneCSourceHash,
          ofdFiscalKeyHash: data.ofdFiscalKeyHash,
          candidateCount: record.candidateCount,
          timeDifferenceSeconds: record.timeDifferenceSeconds ?? null,
          graceUntil: new Date(record.graceUntil),
          tbankComplete: record.sourceCompleteness.tbank,
          oneCComplete: record.sourceCompleteness.oneC,
          ofdComplete: record.sourceCompleteness.ofd,
          evaluatedAt: new Date(record.evaluatedAt),
        }],
        skipDuplicates: true,
      });
      evaluationsCreated += evaluation.count;
    }

    const released = await tx.terminalFiscalMatchRun.updateMany({
      where: { id: input.lease.runId, leaseToken: input.lease.leaseToken },
      data: {
        cycleKey: input.cycleKey,
        status: 'completed',
        tbankComplete: input.sourceCompleteness.tbank,
        oneCComplete: input.sourceCompleteness.oneC,
        ofdComplete: input.sourceCompleteness.ofd,
        tbankCheckedAt: new Date(input.sourceCheckedAt.tbank),
        oneCCheckedAt: new Date(input.sourceCheckedAt.oneC),
        ofdCheckedAt: new Date(input.sourceCheckedAt.ofd),
        completedAt: new Date(input.output.evaluatedAt),
        leaseToken: null,
        leaseUntil: null,
      },
    });
    if (released.count !== 1) throw new Error('TERMINAL_FISCAL_LEASE_LOST');
    return { evaluationsCreated, records: input.output.records.length };
  }, { isolationLevel: 'Serializable' as Prisma.TransactionIsolationLevel });
}

export async function failTerminalFiscalRun(prisma: PrismaClient, lease: RunLease, errorCode: string) {
  await prisma.terminalFiscalMatchRun.updateMany({
    where: { id: lease.runId, leaseToken: lease.leaseToken },
    data: { status: 'failed', lastErrorCode: errorCode, completedAt: new Date(), leaseToken: null, leaseUntil: null },
  });
}
