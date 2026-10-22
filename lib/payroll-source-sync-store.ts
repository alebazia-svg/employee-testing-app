import type { PrismaClient } from '@prisma/client';
import { prisma } from './prisma';

export async function isPayrollSourceSyncEligible(periodKey: string, db: PrismaClient = prisma) {
  const period = await db.payrollPeriod.findUnique({ where: { periodKey }, select: { status: true } });
  if (!period || period.status === 'CLOSED') return false;
  if (await db.payrollRun.count({ where: { period: { periodKey }, status: 'FINAL' } })) return false;
  return !!await db.payrollDraftRevision.count({ where: { periodKey } });
}
