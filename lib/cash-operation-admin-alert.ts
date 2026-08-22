import 'server-only';

import type { Prisma } from '@prisma/client';
import { queueAdminInboxTelegramDelivery } from '@/lib/admin-inbox';

type DbClient = Pick<Prisma.TransactionClient, 'user' | 'adminInboxEvent' | 'adminInboxReceipt' | 'adminInboxDelivery'>;

const directionLabels: Record<string, string> = {
  phone_reserve: 'в резерв',
  deposit_safe: 'в депозитный сейф',
};

export async function createCashOperationFailureAlert(input: {
  db: DbClient;
  operation: { id: number; userId: number; date: string; direction: string; amount: number };
  employeeName: string;
  error: string;
  occurredAt: Date;
}) {
  const event = await input.db.adminInboxEvent.upsert({
    where: { eventKey: `cash-operation:${input.operation.id}:one-c-error` },
    create: {
      eventKey: `cash-operation:${input.operation.id}:one-c-error`,
      type: 'workday.cash_operation_failed',
      title: 'Инкассация не проведена в 1С',
      body: `${input.employeeName} · ${input.operation.amount.toLocaleString('ru-RU')} ₽ ${directionLabels[input.operation.direction] ?? ''}. ${input.error}`.replace(/\s+/g, ' ').trim(),
      href: `/admin/workday?date=${input.operation.date}&employee=${input.operation.userId}`,
      sourceType: 'cash_operation',
      sourceId: String(input.operation.id),
      occurredAt: input.occurredAt,
    },
    update: {},
  });
  const admins = await input.db.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } });
  if (admins.length) {
    await input.db.adminInboxReceipt.createMany({
      data: admins.map((admin) => ({ eventId: event.id, userId: admin.id })),
      skipDuplicates: true,
    });
  }
  await queueAdminInboxTelegramDelivery({ db: input.db, eventId: event.id });
  return event;
}
