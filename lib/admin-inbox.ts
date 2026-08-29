import 'server-only';

import type { Prisma } from '@prisma/client';

type AdminInboxDb = Pick<Prisma.TransactionClient, 'user' | 'adminInboxEvent' | 'adminInboxReceipt' | 'adminInboxDelivery'>;

export function isAdminInboxTelegramEnabled(env: Record<string, string | undefined> = process.env) {
  return env.ADMIN_INBOX_TELEGRAM_ENABLED === '1';
}

export async function queueAdminInboxTelegramDelivery(input: { db: Pick<Prisma.TransactionClient, 'adminInboxDelivery'>; eventId: string }) {
  if (!isAdminInboxTelegramEnabled()) return;
  await input.db.adminInboxDelivery.upsert({
    where: { eventId_channel_recipientKey: { eventId: input.eventId, channel: 'telegram', recipientKey: 'offonika_control_owner' } },
    create: { eventId: input.eventId, channel: 'telegram', recipientKey: 'offonika_control_owner' },
    update: {},
  });
}

function text(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function short(value: unknown, max = 100) {
  const normalized = text(value);
  return normalized.length <= max ? normalized : `${normalized.slice(0, max - 1).trimEnd()}…`;
}

function money(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number)
    ? `${number.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽`
    : 'сумма не указана';
}

export function expenseRequestInboxEventKey(oneCRequestRef: string, notApprovedCycle: number) {
  return `expense_request:not_approved:${oneCRequestRef}:${notApprovedCycle}`;
}

export function expenseRequestInboxBody(input: {
  requestedByName: string;
  amount: unknown;
  operation: string;
  comment: unknown;
}) {
  const parts = [
    text(input.requestedByName) || 'КтоЗаявил не указан',
    money(input.amount),
    text(input.operation) || 'категория не определена',
  ];
  const comment = short(input.comment);
  if (comment) parts.push(comment);
  return parts.join(' · ');
}

export async function createExpenseRequestAdminInboxEvent(input: {
  db: AdminInboxDb;
  oneCRequestRef: string;
  caseId: string;
  notApprovedCycle: number;
  occurredAt: Date;
  requestedByName: string;
  amount: unknown;
  operation: string;
  comment: unknown;
  queueTelegramDelivery?: boolean;
}) {
  const admins = await input.db.user.findMany({
    where: { role: 'ADMIN', isActive: true },
    select: { id: true },
  });
  const event = await input.db.adminInboxEvent.upsert({
    where: { eventKey: expenseRequestInboxEventKey(input.oneCRequestRef, input.notApprovedCycle) },
    create: {
      eventKey: expenseRequestInboxEventKey(input.oneCRequestRef, input.notApprovedCycle),
      type: 'expense_request.created',
      title: 'Новая заявка на расход',
      body: expenseRequestInboxBody(input),
      href: `/admin/expense-requests/${input.caseId}`,
      sourceType: 'expense_request',
      sourceId: input.oneCRequestRef,
      occurredAt: input.occurredAt,
    },
    update: {},
  });
  if (admins.length > 0) {
    await input.db.adminInboxReceipt.createMany({
      data: admins.map((admin) => ({ eventId: event.id, userId: admin.id })),
      skipDuplicates: true,
    });
  }
  if (input.queueTelegramDelivery) {
    await queueAdminInboxTelegramDelivery({ db: input.db, eventId: event.id });
  }
  return { eventId: event.id, recipientCount: admins.length };
}
