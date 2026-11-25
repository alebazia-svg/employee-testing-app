import 'server-only';
import type { PrismaClient } from '@prisma/client';
import type { PayrollApprovalTarget } from './admin-review-attention';
import { payrollApprovalReview } from './payroll-automatic-approval';
import { payrollDayAccountingEnabled } from './payroll-day-review';

type Db = Pick<PrismaClient, 'payrollPeriod' | 'payrollDayReview'>;

export async function readPayrollApprovalTargets(db: Db, currentMonth: string,
  dayAccounting = payrollDayAccountingEnabled()): Promise<PayrollApprovalTarget[]> {
  const periods = await db.payrollPeriod.findMany({
    where: {
      status: { not: 'CLOSED' }, periodKey: { lt: currentMonth },
      runs: { some: { status: 'CHECKED' }, none: { status: 'FINAL' } },
    },
    orderBy: { periodKey: 'desc' },
    select: {
      periodKey: true,
      runs: {
        where: { status: 'CHECKED' },
        orderBy: { runNumber: 'desc' }, take: 1,
        select: { id: true, sourceSummary: true, reviewCount: true },
      },
    },
  });
  const candidates = periods.flatMap(period => {
    const run = period.runs[0];
    return run && !payrollApprovalReview(run.sourceSummary, run.reviewCount).pending.length
      ? [{ periodKey: period.periodKey, run }] : [];
  });
  const reviews = dayAccounting && candidates.length ? await db.payrollDayReview.findMany({
    where: { periodKey: { in: candidates.map(period => period.periodKey) }, accessOnly: false,
      status: { in: ['pending', 'approved'] } },
    select: { periodKey: true, id: true, status: true },
  }) : [];
  const pending = new Set(reviews.filter(review => review.status === 'pending').map(review => review.periodKey));
  const approved = new Map<string, string[]>();
  for (const row of reviews) {
    if (row.status === 'approved') {
      const ids = approved.get(row.periodKey) ?? [];
      approved.set(row.periodKey, [...ids, row.id]);
    }
  }

  return candidates.flatMap(({ periodKey, run }) => {
    if (pending.has(periodKey)) return [];
    const summary = run.sourceSummary as { kind?: unknown; approvedDayReviewIds?: unknown } | null;
    if (dayAccounting && summary?.kind === 'automatic-1c-v1') {
      const savedIds = Array.isArray(summary.approvedDayReviewIds) ? [...summary.approvedDayReviewIds].sort() : [];
      if (JSON.stringify(savedIds) !== JSON.stringify((approved.get(periodKey) ?? []).sort())) return [];
    }
    return [{ periodKey, runId: run.id }];
  });
}
