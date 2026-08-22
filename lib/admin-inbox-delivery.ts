import 'server-only';

import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';

const TELEGRAM_CHANNEL = 'telegram';
const OWNER_RECIPIENT = 'offonika_control_owner';
const LEASE_MS = 5 * 60 * 1000;
const TELEGRAM_EVENT_TYPES = [
  'expense_request.created',
  'workday.close_exception_requested',
  'workday.cash_encashment_exception_requested',
  'workday.cash_operation_failed',
  'workday_issue.employee_message',
  'terminal_fiscal_review.employee_message',
] as const;

function text(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function short(value: unknown, max = 180) {
  const normalized = text(value);
  return normalized.length <= max ? normalized : `${normalized.slice(0, max - 1).trimEnd()}…`;
}

function money(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? `${amount.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ₽`
    : 'не указана';
}

function sourceComment(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  return text((value as Record<string, unknown>).comment);
}

export type ClaimedAdminInboxTelegramDelivery = {
  deliveryId: string;
  leaseToken: string;
  text: string;
  href: string;
  buttonLabel: 'Открыть заявку' | 'Открыть сообщение' | 'Открыть контроль' | 'Принять решение';
};

function messageForEvent(input: {
  type: string;
  title: string;
  body: string;
  expense?: { requestedByName: string | null; amount: unknown; businessOperationName: string | null; latestCategory: string | null; normalizedSource: unknown } | null;
}) {
  if (input.type === 'expense_request.created') {
    const comment = sourceComment(input.expense?.normalizedSource);
    return {
      text: [
        'Новая заявка на расход',
        `Заявитель: ${text(input.expense?.requestedByName) || 'не указан'}`,
        `Сумма: ${money(input.expense?.amount)}`,
        `Операция: ${text(input.expense?.businessOperationName) || text(input.expense?.latestCategory) || 'не определена'}`,
        ...(comment ? [`Комментарий: ${short(comment)}`] : []),
      ].join('\n'),
      buttonLabel: 'Открыть заявку' as const,
    };
  }
  if (input.type === 'workday.close_exception_requested' || input.type === 'workday.cash_encashment_exception_requested') {
    return { text: `${input.title}\n${input.body}`, buttonLabel: 'Принять решение' as const };
  }
  if (input.type === 'workday.cash_operation_failed') {
    return { text: `${input.title}\n${input.body}`, buttonLabel: 'Открыть контроль' as const };
  }
  return { text: `${input.title}\n${input.body}`, buttonLabel: 'Открыть сообщение' as const };
}

export async function claimAdminInboxTelegramDelivery(db: PrismaClient, now = new Date()): Promise<ClaimedAdminInboxTelegramDelivery | null> {
  return db.$transaction(async (tx) => {
    const candidate = await tx.adminInboxDelivery.findFirst({
      where: {
        channel: TELEGRAM_CHANNEL,
        recipientKey: OWNER_RECIPIENT,
        status: 'pending',
        event: { type: { in: [...TELEGRAM_EVENT_TYPES] } },
      },
      orderBy: { createdAt: 'asc' },
      include: { event: true },
    });
    if (!candidate) return null;
    const leaseToken = randomUUID();
    const claimed = await tx.adminInboxDelivery.updateMany({
      where: { id: candidate.id, status: 'pending' },
      data: { status: 'sending', leaseToken, leaseUntil: new Date(now.getTime() + LEASE_MS), attemptCount: { increment: 1 }, lastErrorCode: null },
    });
    if (claimed.count !== 1) return null;
    const caseRow = await tx.expenseRequestAdminCase.findUnique({ where: { oneCRequestRef: candidate.event.sourceId } });
    const evaluation = caseRow ? await tx.expenseRequestAdminEvaluation.findFirst({ where: { caseId: caseRow.id }, orderBy: { evaluatedAt: 'desc' } }) : null;
    const message = messageForEvent({
      type: candidate.event.type,
      title: candidate.event.title,
      body: candidate.event.body,
      expense: caseRow ? {
        requestedByName: caseRow.requestedByName,
        amount: caseRow.amount,
        businessOperationName: caseRow.businessOperationName,
        latestCategory: caseRow.latestCategory,
        normalizedSource: evaluation?.normalizedSource,
      } : null,
    });
    return {
      deliveryId: candidate.id,
      leaseToken,
      text: message.text,
      href: `/admin/inbox/open/${candidate.event.id}`,
      buttonLabel: message.buttonLabel,
    };
  });
}

export async function markAdminInboxTelegramDeliverySent(input: { db: PrismaClient; deliveryId: string; leaseToken: string; externalMessageId: string; now?: Date }) {
  const result = await input.db.adminInboxDelivery.updateMany({
    where: { id: input.deliveryId, status: 'sending', leaseToken: input.leaseToken },
    data: { status: 'sent', sentAt: input.now ?? new Date(), externalMessageId: text(input.externalMessageId), leaseToken: null, leaseUntil: null, lastErrorCode: null },
  });
  if (result.count !== 1) throw new Error('ADMIN_INBOX_DELIVERY_LEASE_MISMATCH');
}

export async function markAdminInboxTelegramDeliveryFailed(input: { db: PrismaClient; deliveryId: string; leaseToken: string; errorCode: string; uncertain?: boolean; retryable?: boolean }) {
  const result = await input.db.adminInboxDelivery.updateMany({
    where: { id: input.deliveryId, status: 'sending', leaseToken: input.leaseToken },
    data: { status: input.uncertain ? 'uncertain' : input.retryable ? 'pending' : 'failed', leaseToken: null, leaseUntil: null, lastErrorCode: text(input.errorCode).slice(0, 80) || 'TELEGRAM_DELIVERY_FAILED' },
  });
  if (result.count !== 1) throw new Error('ADMIN_INBOX_DELIVERY_LEASE_MISMATCH');
}
