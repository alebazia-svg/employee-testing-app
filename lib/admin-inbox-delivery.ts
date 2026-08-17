import 'server-only';

import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';

const TELEGRAM_CHANNEL = 'telegram';
const OWNER_RECIPIENT = 'offonika_control_owner';
const LEASE_MS = 5 * 60 * 1000;

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
};

export async function claimAdminInboxTelegramDelivery(db: PrismaClient, now = new Date()): Promise<ClaimedAdminInboxTelegramDelivery | null> {
  return db.$transaction(async (tx) => {
    const candidate = await tx.adminInboxDelivery.findFirst({
      where: { channel: TELEGRAM_CHANNEL, recipientKey: OWNER_RECIPIENT, status: 'pending' },
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
    const comment = sourceComment(evaluation?.normalizedSource);
    const message = [
      'Новая заявка на расход',
      `Заявитель: ${text(caseRow?.requestedByName) || 'не указан'}`,
      `Сумма: ${money(caseRow?.amount)}`,
      `Операция: ${text(caseRow?.businessOperationName) || text(caseRow?.latestCategory) || 'не определена'}`,
      ...(comment ? [`Комментарий: ${short(comment)}`] : []),
    ].join('\n');
    return { deliveryId: candidate.id, leaseToken, text: message, href: candidate.event.href };
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
