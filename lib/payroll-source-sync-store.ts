import type { PrismaClient } from '@prisma/client';
import { prisma } from './prisma';

export async function isPayrollSourceSyncEligible(periodKey: string, db: PrismaClient = prisma, now = new Date()) {
  const period = await db.payrollPeriod.findUnique({ where: { periodKey }, select: { status: true } });
  if (period?.status === 'CLOSED') return false;
  if (await db.payrollRun.count({ where: { period: { periodKey }, status: 'FINAL' } })) return false;
  const current = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit' }).format(now);
  if (periodKey === current) return true;
  if (!period) return false;
  return !!await db.payrollDraftRevision.count({ where: { periodKey } });
}
