import type { Prisma } from '@prisma/client';
import { cashEncashmentExceptionPrefix } from '@/lib/workday-cash-encashment-exception';
import { prisma } from '@/lib/prisma';

type DbClient = Prisma.TransactionClient | typeof prisma;

const cashCarryLimit = 50_000;
const moneyTolerance = 1;

function readRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function readCashBalance(value: unknown) {
  const handover = readRecord(value);
  const personalCash = readRecord(handover?.personalCash);
  if (personalCash?.cashBalance === null || personalCash?.cashBalance === undefined || personalCash.cashBalance === '') return null;
  const balance = Number(personalCash?.cashBalance);
  return Number.isFinite(balance) ? balance : null;
}

function resolutionNote(input: { operationId: number; operationDate: string; amount: number }) {
  return `Автоматически устранено инкассацией ${input.operationDate}: ${input.amount.toLocaleString('ru-RU')} ₽ (операция #${input.operationId}).`;
}

export function requiredCashEncashmentAmount(balance: number) {
  return Math.max(0, balance - cashCarryLimit);
}

export async function resolveCarriedCashEncashmentExceptions(db: DbClient, input: {
  employeeId: number;
  operationId: number;
  operationDate: string;
  operationAmount: number;
  operationCreatedAt: Date;
  apply?: boolean;
}) {
  const candidates = await db.workdayCloseExceptionRequest.findMany({
    where: {
      employeeId: input.employeeId,
      status: 'approved',
      consumedAt: { not: null },
      reasonCode: { startsWith: cashEncashmentExceptionPrefix },
      requestedAt: { lt: input.operationCreatedAt },
    },
    select: {
      id: true,
      decisionComment: true,
      requestedAt: true,
      workDayEntry: {
        select: {
          date: true,
          shiftControlRun: {
            select: {
              tasks: {
                where: { category: 'handover' },
                orderBy: { id: 'desc' },
                take: 1,
                select: { handoverData: true },
              },
            },
          },
        },
      },
    },
    orderBy: { requestedAt: 'desc' },
  });

  if (!candidates.length) return { resolvedIds: [] as string[], requiredAmount: null, reason: 'no_candidates' as const };

  const latestBalance = readCashBalance(candidates[0].workDayEntry.shiftControlRun?.tasks[0]?.handoverData);
  if (latestBalance === null) return { resolvedIds: [] as string[], requiredAmount: null, reason: 'missing_balance' as const };

  const requiredAmount = requiredCashEncashmentAmount(latestBalance);
  if (input.operationAmount + moneyTolerance < requiredAmount) {
    return { resolvedIds: [] as string[], requiredAmount, reason: 'insufficient_amount' as const };
  }

  const note = resolutionNote({
    operationId: input.operationId,
    operationDate: input.operationDate,
    amount: input.operationAmount,
  });
  if (input.apply !== false) {
    for (const candidate of candidates) {
      await db.workdayCloseExceptionRequest.update({
        where: { id: candidate.id },
        data: {
          status: 'resolved',
          decisionComment: [candidate.decisionComment, note].filter(Boolean).join(' '),
        },
      });
    }
  }

  return { resolvedIds: candidates.map((candidate) => candidate.id), requiredAmount, reason: 'resolved' as const };
}
