import 'server-only';

import { prisma } from '@/lib/prisma';
import type { MatchingReasonCode, MatchingStatus, TerminalFiscalMatchingOutput } from '@/lib/terminal-fiscal-matching';
import {
  attributeTerminalFiscalEmployee,
  type TerminalFiscalCashierEmployeeMapping,
} from '@/lib/terminal-fiscal-attribution';

const STATUSES: MatchingStatus[] = ['confirmed', 'pending', 'mismatch', 'unavailable', 'needs_review'];

export type TerminalFiscalAggregate = {
  total: number;
  statuses: Record<MatchingStatus, number>;
  reasonCodes: Partial<Record<MatchingReasonCode, number>>;
  ambiguities: number;
};

export type TerminalFiscalWorkdaySummary = TerminalFiscalAggregate & {
  runs: number;
  attempts: number;
  completeness: { tbank: boolean; oneC: boolean; ofd: boolean };
  lastCompletedAt: Date | null;
  attributionRecords?: TerminalFiscalAttributionRecord[];
};

export type TerminalFiscalAttributionRecord = {
  status: MatchingStatus;
  reasonCode: MatchingReasonCode;
  candidateCount: number;
  bankOperationAt: Date | null;
  oneCCashierRef: string | null;
};

export type TerminalFiscalEmployeeControl = TerminalFiscalAggregate & {
  userId: number;
  lastOperationAt: Date | null;
};

export function presentTerminalFiscalEmployeeControl(control: TerminalFiscalEmployeeControl | null) {
  const mismatch = control?.statuses.mismatch ?? 0;
  const review = (control?.statuses.needs_review ?? 0) + (control?.statuses.unavailable ?? 0);
  if (mismatch > 0) return { tone: 'error' as const, text: `Автосверка терминала: расхождений ${mismatch}` };
  if (review > 0) return { tone: 'attention' as const, text: `Автосверка терминала: проверить ${review}` };
  if ((control?.statuses.pending ?? 0) > 0) return { tone: 'pending' as const, text: 'Автосверка терминала ожидает данные' };
  if (control && control.total > 0) return { tone: 'normal' as const, text: `Операции терминала подтверждены: ${control.statuses.confirmed}` };
  return { tone: 'none' as const, text: '' };
}

export function attributeTerminalFiscalRecordsToEmployees(
  records: TerminalFiscalAttributionRecord[],
  cashierMappings: TerminalFiscalCashierEmployeeMapping[] = [],
) {
  const attributed = new Map<number, TerminalFiscalAttributionRecord[]>();
  const unassigned: TerminalFiscalAttributionRecord[] = [];
  for (const record of records) {
    const attribution = attributeTerminalFiscalEmployee(record, cashierMappings);
    const effectiveRecord = attribution.effectiveStatus === record.status ? record : { ...record, status: attribution.effectiveStatus };
    if (attribution.employeeId === null) {
      unassigned.push(effectiveRecord);
      continue;
    }
    const rows = attributed.get(attribution.employeeId) ?? [];
    rows.push(effectiveRecord);
    attributed.set(attribution.employeeId, rows);
  }
  const byUser = new Map<number, TerminalFiscalEmployeeControl>();
  for (const [userId, rows] of attributed) {
    byUser.set(userId, {
      userId,
      lastOperationAt: rows.reduce<Date | null>((latest, row) => (
        row.bankOperationAt && (!latest || row.bankOperationAt > latest) ? row.bankOperationAt : latest
      ), null),
      ...aggregateTerminalFiscalRecords(rows),
    });
  }
  return { byUser, recordsByUser: attributed, unassigned: aggregateTerminalFiscalRecords(unassigned) };
}

export type TerminalFiscalWorkdayPresentation = {
  status: 'confirmed' | 'pending' | 'mismatch' | 'unavailable' | 'needs_review' | 'not_run';
  label: string;
  detail: string;
};

export function presentTerminalFiscalWorkdaySummary(summary: TerminalFiscalWorkdaySummary | null): TerminalFiscalWorkdayPresentation {
  if (!summary) {
    return { status: 'not_run', label: 'Сверка ещё не запускалась', detail: 'За выбранный день сверка ещё не запускалась.' };
  }
  const sourcesComplete = summary.completeness.tbank && summary.completeness.oneC && summary.completeness.ofd;
  const missingOneCChecks = summary.reasonCodes.ONE_C_CANDIDATE_NOT_FOUND ?? 0;
  const periodCoveredChecks = summary.attributionRecords?.filter((record) => (
    record.reasonCode === 'ONE_C_CANDIDATE_NOT_FOUND' && Boolean(record.oneCCashierRef)
  )).length ?? 0;
  const uncoveredOneCChecks = Math.max(0, missingOneCChecks - periodCoveredChecks);
  const legacyItemReviews = summary.reasonCodes.OFD_ITEMS_MISMATCH ?? 0;
  const itemReviews = legacyItemReviews
    + (summary.reasonCodes.OFD_ITEM_PRESENTATION_DIFFERENCE ?? 0)
    + (summary.reasonCodes.OFD_ITEM_VALUES_MISMATCH ?? 0);
  const otherNeedsReview = Math.max(0, summary.statuses.needs_review - legacyItemReviews - periodCoveredChecks);
  const status = summary.statuses.mismatch > 0 || uncoveredOneCChecks > 0
    ? 'mismatch'
    : otherNeedsReview > 0 || itemReviews > 0
      ? 'needs_review'
      : !sourcesComplete || summary.statuses.unavailable > 0
        ? 'unavailable'
        : summary.statuses.pending > 0
          ? 'pending'
          : 'confirmed';
  if (summary.total === 0 && (status === 'unavailable' || status === 'pending')) {
    return {
      status,
      label: 'Ожидаются данные',
      detail: 'Сверка Т-Банк → 1С → ОФД пока не завершена. Операций для подтверждения ещё нет.',
    };
  }
  const labels = {
    confirmed: 'Всё подтверждено',
    pending: 'Ожидаем данные',
    mismatch: 'Есть расхождение',
    unavailable: 'Сверка временно неполная',
    needs_review: 'Требует проверки',
  } as const;
  const parts = [
    `точно сопоставлено ${summary.statuses.confirmed} из ${summary.total}`,
    periodCoveredChecks > 0 ? `покрыто общей сверкой ${periodCoveredChecks}` : '',
    summary.statuses.pending > 0 ? `ожидают ${summary.statuses.pending}` : '',
    otherNeedsReview > 0 ? `проверить ${otherNeedsReview}` : '',
    itemReviews > 0 ? `состав проверить ${itemReviews}` : '',
    summary.statuses.mismatch > 0 ? `расхождений ${summary.statuses.mismatch}` : '',
    summary.statuses.unavailable > 0 ? `недоступно ${summary.statuses.unavailable}` : '',
  ].filter(Boolean);
  if (uncoveredOneCChecks > 0) parts.push(`оплат без покрытия чеком 1С ${uncoveredOneCChecks}`);
  return {
    status,
    label: uncoveredOneCChecks > 0 && summary.statuses.mismatch === 0
      ? 'Есть проблема эквайринга'
      : itemReviews > 0 && status === 'needs_review' && otherNeedsReview === 0
        ? 'Проверить состав чека'
        : labels[status],
    detail: `Т-Банк → 1С → ОФД: ${parts.join(' · ')}.`,
  };
}

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

export async function getTerminalFiscalWorkdaySummary(input: { periodFrom: Date; periodTo: Date }): Promise<TerminalFiscalWorkdaySummary | null> {
  const runs = await prisma.terminalFiscalMatchRun.findMany({
    where: {
      periodFrom: { gte: input.periodFrom },
      periodTo: { lte: input.periodTo },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      mappingId: true,
      attemptCount: true,
      tbankComplete: true,
      oneCComplete: true,
      ofdComplete: true,
      completedAt: true,
    },
  });
  if (runs.length === 0) return null;
  const latestRunByMapping = new Map<string, (typeof runs)[number]>();
  for (const run of runs) {
    if (!latestRunByMapping.has(run.mappingId)) latestRunByMapping.set(run.mappingId, run);
  }
  const latestByMapping = [...latestRunByMapping.values()];
  const matches = await prisma.terminalFiscalMatch.findMany({
    where: { runId: { in: latestByMapping.map((run) => run.id) } },
    select: {
      status: true,
      reasonCode: true,
      candidateCount: true,
      bankOperationAt: true,
      oneCCashierRef: true,
    },
  });
  const attributionRecords: TerminalFiscalAttributionRecord[] = matches.map((match) => ({
    status: match.status as MatchingStatus,
    reasonCode: match.reasonCode as MatchingReasonCode,
    candidateCount: match.candidateCount,
    bankOperationAt: match.bankOperationAt,
    oneCCashierRef: match.oneCCashierRef,
  }));
  return {
    runs: latestByMapping.length,
    attempts: latestByMapping.reduce((sum, run) => sum + run.attemptCount, 0),
    completeness: {
      tbank: latestByMapping.every((run) => run.tbankComplete),
      oneC: latestByMapping.every((run) => run.oneCComplete),
      ofd: latestByMapping.every((run) => run.ofdComplete),
    },
    lastCompletedAt: latestByMapping.reduce<Date | null>((latest, run) => (
      run.completedAt && (!latest || run.completedAt > latest) ? run.completedAt : latest
    ), null),
    attributionRecords,
    ...aggregateTerminalFiscalRecords(matches),
  };
}
