import 'server-only';
import { prisma } from './prisma';

export const ADMIN_SOURCE_OUTAGE_DELAY_MS = 60 * 60_000;
export function sourceCheckIsStale(checkedAt: Date | null | undefined, now: Date) {
  return Boolean(checkedAt && Number.isFinite(checkedAt.getTime()) && now.getTime() - checkedAt.getTime() >= ADMIN_SOURCE_OUTAGE_DELAY_MS);
}
export async function expenseSyncLastSuccess() {
  const last = await prisma.expenseRequestSyncRun.findFirst({where:{status:'completed',sourceComplete:true},orderBy:{completedAt:'desc'},select:{completedAt:true}});
  return last?.completedAt ?? null;
}
