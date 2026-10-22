import { prisma } from './prisma';
import type { PrismaClient } from '@prisma/client';

/** Shared by ADMIN refresh and the one-shot runner; released on failure/crash. */
export async function withPayrollSourceLock<T>(task: () => Promise<T>, db: PrismaClient = prisma) {
  return db.$transaction(async tx => {
    const [row] = await tx.$queryRaw<Array<{ locked: boolean }>>`
      SELECT pg_try_advisory_xact_lock(20261022, 3101) AS locked
    `;
    if (!row?.locked) return null;
    return task();
  }, { maxWait: 5_000, timeout: 10 * 60_000 });
}
