import 'server-only';

import { prisma } from '@/lib/prisma';
import type { MatchingReasonCode, MatchingStatus, TerminalFiscalMatchingOutput } from '@/lib/terminal-fiscal-matching';

const STATUSES: MatchingStatus[] = ['confirmed', 'pending', 'mismatch', 'unavailable', 'needs_review'];

export type TerminalFiscalAggregate = {
  total: number;
  statuses: Record<MatchingStatus, number>;
  reasonCodes: Partial<Record<MatchingReasonCode, number>>;
  ambiguities: number;
};

export function aggregateTerminalFiscalRecords(records: Array<{ status: string; reasonCode: string; candidateCount: number }>): TerminalFiscalAggregate {
  const statuses = Object.fromEntries(STATUSES.map((status) => [status, 0])) as Record<MatchingStatus, number>;
  const reasonCodes: Partial<Record<MatchingReasonCode, number>> = {};
  let ambiguities = 0;
  for (const record of records) {
    if (STATUSES.includes(record.status as MatchingStatus)) statuses[record.status as MatchingStatus] += 1;
    reasonCodes[record.reasonCode as MatchingReasonCode] = (reasonCodes[record.reasonCode as MatchingReasonCode] ?? 0) + 1;
    if (record.candidateCount > 1) ambiguities += 1;
  }
  return { total: records.length, statuses, reasonCodes, ambiguities };
}

export function summarizeTerminalFiscalOutput(output: TerminalFiscalMatchingOutput) {
  return {
    algorithmVersion: output.version,
    evaluatedAt: output.evaluatedAt,
    ...aggregateTerminalFiscalRecords(output.records),
    safety: { employeeVisible: false, incidentCreation: false, notifications: false } as const,
  };
}

export async function getTerminalFiscalAuditSummary(input: { mappingId: string; periodFrom: Date; periodTo: Date }) {
  const run = await prisma.terminalFiscalMatchRun.findFirst({
    where: { mappingId: input.mappingId, periodFrom: input.periodFrom, periodTo: input.periodTo },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, algorithmVersion: true, periodFrom: true, periodTo: true, status: true,
      attemptCount: true, tbankComplete: true, oneCComplete: true, ofdComplete: true,
      tbankCheckedAt: true, oneCCheckedAt: true, ofdCheckedAt: true,
      lastErrorCode: true, startedAt: true, completedAt: true, createdAt: true,
    },
  });
  if (!run) return null;
  const matches = await prisma.terminalFiscalMatch.findMany({
    where: { runId: run.id },
    select: { status: true, reasonCode: true, candidateCount: true },
  });
  return {
    run,
    completeness: { tbank: run.tbankComplete, oneC: run.oneCComplete, ofd: run.ofdComplete },
    ...aggregateTerminalFiscalRecords(matches),
    safety: { employeeVisible: false, incidentCreation: false, notifications: false } as const,
  };
}
