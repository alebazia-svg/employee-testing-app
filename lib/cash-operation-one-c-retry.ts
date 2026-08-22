import 'server-only';

import type { PrismaClient } from '@prisma/client';
import { createOneCCashExpenseOrder, getCashStatementDimensions } from '@/lib/one-c';
import { resolveCarriedCashEncashmentExceptions } from '@/lib/workday-cash-encashment-resolution';

const retryingStatus = 'retrying_1c';
const retryableStatus = 'one_c_error';
const retryLeaseMs = 10 * 60 * 1000;

const targetCashboxNameByDirection = {
  phone_reserve: 'резерв под телефоны',
  deposit_safe: 'сейф депозитный',
} as const;

function normalizeSearchText(value: string) {
  return value.trim().toLowerCase().replace(/ё/g, 'е');
}

function errorText(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim() ? error.message.trim() : fallback;
}

export async function retryCashOperationInOneC(
  db: PrismaClient,
  operationId: number,
  now = new Date(),
  dependencies: {
    getDimensions?: typeof getCashStatementDimensions;
    createPair?: typeof createOneCCashExpenseOrder;
    resolveCarried?: typeof resolveCarriedCashEncashmentExceptions;
  } = {},
) {
  const operation = await db.cashOperation.findUnique({
    where: { id: operationId },
    include: { user: { select: { id: true, name: true } } },
  });
  if (!operation) return { ok: false as const, reason: 'not_found' as const };
  if (operation.status === 'posted_1c_pair') return { ok: true as const, reason: 'already_posted' as const, operation };
  if (operation.status === 'manual_in_progress' || operation.status === 'resolved_manual') {
    return { ok: false as const, reason: 'manual_control' as const, operation };
  }

  const staleRetry = operation.status === retryingStatus && operation.updatedAt.getTime() <= now.getTime() - retryLeaseMs;
  if (operation.status !== retryableStatus && !staleRetry) {
    return { ok: false as const, reason: 'not_retryable' as const, operation };
  }

  const claimed = await db.cashOperation.updateMany({
    where: {
      id: operation.id,
      ...(staleRetry
        ? { status: retryingStatus, updatedAt: { lte: new Date(now.getTime() - retryLeaseMs) } }
        : { status: retryableStatus }),
    },
    data: { status: retryingStatus },
  });
  if (claimed.count !== 1) return { ok: false as const, reason: 'not_claimed' as const, operation };

  const fail = async (message: string) => {
    const failed = await db.cashOperation.update({
      where: { id: operation.id },
      data: { status: retryableStatus, oneCError: message },
    });
    return { ok: false as const, reason: 'one_c_error' as const, operation: failed };
  };

  try {
    const mapping = await db.userOneCCashboxMapping.findUnique({ where: { userId: operation.userId } });
    const dimensions = await (dependencies.getDimensions ?? getCashStatementDimensions)();
    const organization = dimensions.organizations.find((item) => normalizeSearchText(item.name).includes('оффоника'))
      ?? dimensions.organizations[0]
      ?? null;
    const targetName = targetCashboxNameByDirection[operation.direction as keyof typeof targetCashboxNameByDirection];
    const targetCashbox = targetName
      ? dimensions.cashboxes.find((item) => normalizeSearchText(item.name) === targetName) ?? null
      : null;
    if (!mapping?.isActive) return fail('Касса сотрудника не привязана к 1С.');
    if (!dimensions.ok || !organization) return fail('Организация или справочник касс 1С недоступны.');
    if (!targetCashbox) return fail('Касса-получатель для инкассации не найдена в 1С.');

    const result = await (dependencies.createPair ?? createOneCCashExpenseOrder)({
      idempotencyKey: operation.idempotencyKey,
      organizationRef: organization.ref,
      cashboxRef: mapping.oneCCashboxRef,
      targetCashboxRef: targetCashbox.ref,
      employeeName: operation.user.name,
      amount: operation.amount,
      direction: operation.direction as 'phone_reserve' | 'deposit_safe',
      employeeComment: operation.comment,
    });
    if (!result.ok || !result.document || !result.receiptDocument || !result.pairComplete) {
      return fail(result.error || '1С не создала и не провела связанную пару РКО и ПКО.');
    }

    const saved = await db.cashOperation.update({
      where: { id: operation.id },
      data: {
        status: 'posted_1c_pair',
        oneCDocumentRef: result.document.ref,
        oneCDocumentNumber: result.document.number,
        oneCReceiptDocumentRef: result.receiptDocument.ref,
        oneCReceiptDocumentNumber: result.receiptDocument.number,
        oneCError: '',
        oneCCreatedAt: now,
        oneCPostedAt: now,
      },
    });
    await (dependencies.resolveCarried ?? resolveCarriedCashEncashmentExceptions)(db, {
      employeeId: operation.userId,
      operationId: saved.id,
      operationDate: saved.date,
      operationAmount: saved.amount,
      operationCreatedAt: saved.createdAt,
    });
    return { ok: true as const, reason: 'posted' as const, operation: saved };
  } catch (error) {
    return fail(errorText(error, 'Связь с 1С прервалась при повторном проведении инкассации.'));
  }
}
