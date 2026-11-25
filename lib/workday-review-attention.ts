import 'server-only';
import type { PrismaClient } from '@prisma/client';
import type { WorkdayAttention } from './admin-review-attention';
import { fiscalRecipientWorkdayScope, TERMINAL_FISCAL_ADMIN_FIRST } from './terminal-fiscal-admin-gate';
import { isFiscalChainReason } from './terminal-fiscal-chain-review';
import { getMoscowDateKey } from './workday';
import { readWorkdayDecisionCount } from './workday-admin-attention';
import { loadOpenHandoverReviews } from './workday-handover-review-server';

type FiscalMatch = {
  status: string; reasonCode: string; oneCSourceRef: string | null;
  tbankComplete: boolean; oneCComplete: boolean;
};

/** The existing approval button also requires complete inputs and a recipient. */
export function canCountFiscalTransfer(reviewReason: string, match: FiscalMatch) {
  const cannotTransfer = (reason: string) => reason.startsWith('SOURCE_') ||
    ['OFD_RECEIPT_PENDING', 'OFD_CANDIDATE_REQUIRES_LINK', 'ONE_C_POSSIBLE_SPLIT_SALE'].includes(reason) ||
    isFiscalChainReason(reason);
  return match.status !== 'confirmed' && !match.oneCSourceRef && match.tbankComplete && match.oneCComplete &&
    !cannotTransfer(reviewReason) && !cannotTransfer(match.reasonCode);
}

async function countFiscalTransfers(db: PrismaClient, today: string) {
  if (!TERMINAL_FISCAL_ADMIN_FIRST) return 0;
  const endOfToday = new Date(Date.parse(`${today}T00:00:00+03:00`) + 86_400_000);
  const reviews = await db.terminalFiscalEmployeeReview.findMany({
    where: { status: 'admin_review', resolvedAt: null, bankOperationAt: { lt: endOfToday } },
    select: { matchingHash: true, reasonCode: true, bankOperationAt: true },
  });
  if (!reviews.length) return 0;

  const reasons = new Map(reviews.map(review => [review.matchingHash, review]));
  const matches = await db.terminalFiscalMatch.findMany({
    where: {
      matchingId: { in: [...reasons.keys()] }, status: { not: 'confirmed' },
      oneCSourceRef: null, tbankComplete: true, oneCComplete: true,
    },
    select: { matchingId: true, status: true, reasonCode: true, oneCSourceRef: true, tbankComplete: true, oneCComplete: true },
  });
  const days = matches.flatMap(match => {
    const review = reasons.get(match.matchingId);
    return review && canCountFiscalTransfer(review.reasonCode, match) ? [getMoscowDateKey(review.bankOperationAt)] : [];
  });
  if (!days.length) return 0;

  // The recipient resolver always returns at least one user when that day's
  // eligible shifts exist, even when it can't choose a unique primary user.
  const staffedDays = await db.workDayEntry.findMany({
    where: { date: { in: [...new Set(days)] }, ...fiscalRecipientWorkdayScope },
    distinct: ['date'], select: { date: true },
  });
  const eligibleDays = new Set(staffedDays.map(row => row.date));
  return days.filter(day => eligibleDays.has(day)).length;
}

export async function readWorkdayAttention(db: PrismaClient, today: string): Promise<WorkdayAttention> {
  const [shifts, receipts, handovers] = await Promise.all([
    readWorkdayDecisionCount(db, today),
    countFiscalTransfers(db, today),
    // Use precisely the queue shown under «Нужно действие» in Day Control.
    loadOpenHandoverReviews(db, { dateThrough: today }),
  ]);
  return { shifts, receipts, handovers: handovers.length };
}
