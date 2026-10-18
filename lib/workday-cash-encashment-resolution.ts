import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

type DbClient = Prisma.TransactionClient | typeof prisma;

export function requiredCashEncashmentAmount(balance: number) {
  return Math.max(0, balance - 50_000);
}

// Compatibility entry point for existing cash-operation callers. An approved
// exception is final for its own shift; a later transfer must not rewrite it.
export async function resolveCarriedCashEncashmentExceptions(_db: DbClient, _input: {
  employeeId: number;
  operationId: number;
  operationDate: string;
  operationAmount: number;
  operationCreatedAt: Date;
  apply?: boolean;
}) {
  return { resolvedIds: [] as string[], requiredAmount: null, reason: 'approval_is_final' as const };
}
