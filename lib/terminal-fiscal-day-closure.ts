import 'server-only';

import type { PrismaClient } from '@prisma/client';
import type { FiscalSettlement } from './terminal-fiscal-settlement';

export const TERMINAL_FISCAL_DAY_SETTLEMENT_RESOLVED = 'DAY_SETTLEMENT_RECONCILED';
export const TERMINAL_FISCAL_OWNER_DAY_TOTAL_RESOLVED = 'OWNER_REVIEWED_DAY_TOTAL_RECONCILED';

const FINAL_RESOLUTION_REASONS = new Set([
  TERMINAL_FISCAL_DAY_SETTLEMENT_RESOLVED,
  TERMINAL_FISCAL_OWNER_DAY_TOTAL_RESOLVED,
]);

export function terminalFiscalReviewHasFinalResolution(input: { status: string; reasonCode: string }) {
  return input.status === 'resolved' && FINAL_RESOLUTION_REASONS.has(input.reasonCode);
}

export type TerminalFiscalDayClosureInput = {
  configurationComplete: boolean;
  nativeFiscalComplete: boolean;
  nativeFiscalKopecks: number;
  ofdComplete: boolean;
  ofdKopecks: number;
  settlement: FiscalSettlement;
};

export function terminalFiscalDayClosureDecision(input: TerminalFiscalDayClosureInput) {
  if (!input.configurationComplete) return { close: false as const, reason: 'CONFIGURATION_INCOMPLETE' };
  if (!input.nativeFiscalComplete) return { close: false as const, reason: 'ONE_C_INCOMPLETE' };
  if (!input.ofdComplete) return { close: false as const, reason: 'OFD_INCOMPLETE' };
  if (input.nativeFiscalKopecks !== input.ofdKopecks) return { close: false as const, reason: 'ONE_C_OFD_DIFFERENCE' };
  if (!input.settlement.complete || input.settlement.status !== 'amount_equal') {
    return { close: false as const, reason: 'SETTLEMENT_NOT_CONFIRMED' };
  }
  if (input.settlement.fiscalKopecks !== input.nativeFiscalKopecks
    || input.settlement.differenceKopecks !== 0
    || input.settlement.settlementKopecks !== input.nativeFiscalKopecks) {
    return { close: false as const, reason: 'SETTLEMENT_AMOUNT_DIFFERENCE' };
  }
  return { close: true as const, reason: TERMINAL_FISCAL_DAY_SETTLEMENT_RESOLVED };
}

export async function resolveTerminalFiscalReviewsForDay(
  db: PrismaClient,
  input: { from: Date; to: Date; resolvedAt: Date },
) {
  return db.$transaction(async (tx) => {
    const reviews = await tx.terminalFiscalEmployeeReview.findMany({
      where: {
        bankOperationAt: { gte: input.from, lt: input.to },
        status: { in: ['open', 'admin_review', 'shadow_candidate'] },
        OR: [
          { reasonCode: { in: ['ONE_C_CANDIDATE_PENDING', 'ONE_C_CANDIDATE_NOT_FOUND'] } },
          { reasonCode: { startsWith: 'SOURCE_' } },
        ],
      },
      select: { id: true },
    });
    const ids = reviews.map((review) => review.id);
    if (!ids.length) return { resolved: 0, notificationsCancelled: 0 };
    const resolved = await tx.terminalFiscalEmployeeReview.updateMany({
      where: { id: { in: ids }, status: { in: ['open', 'admin_review', 'shadow_candidate'] } },
      data: {
        status: 'resolved',
        reasonCode: TERMINAL_FISCAL_DAY_SETTLEMENT_RESOLVED,
        resolvedAt: input.resolvedAt,
        lastCheckedAt: input.resolvedAt,
      },
    });
    const cancelled = await tx.workdayNotification.updateMany({
      where: { reviewId: { in: ids }, status: 'pending' },
      data: { status: 'cancelled', pushStatus: 'cancelled', nextPushAttemptAt: null },
    });
    return { resolved: resolved.count, notificationsCancelled: cancelled.count };
  });
}
