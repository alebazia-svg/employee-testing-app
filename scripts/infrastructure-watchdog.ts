import { createHash } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { queueAdminInboxTelegramDelivery } from '@/lib/admin-inbox';
import { parseInfrastructureChecks } from '@/lib/infrastructure-watchdog';

async function publish(input: { eventKey: string; type: string; title: string; body: string; sourceId: string }) {
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } });
  const event = await prisma.adminInboxEvent.upsert({
    where: { eventKey: input.eventKey },
    create: {
      eventKey: input.eventKey, type: input.type, title: input.title, body: input.body,
      href: '/admin/inbox', sourceType: 'infrastructure', sourceId: input.sourceId, occurredAt: new Date(),
    },
    update: {},
  });
  await prisma.adminInboxReceipt.createMany({ data: admins.map(({ id }) => ({ eventId: event.id, userId: id })), skipDuplicates: true });
  await queueAdminInboxTelegramDelivery({ db: prisma, eventId: event.id });
}

async function main() {
  const checks = parseInfrastructureChecks(process.env.INFRASTRUCTURE_CHECKS_JSON);
  for (const check of checks) {
    const latest = await prisma.adminInboxEvent.findFirst({
      where: { sourceType: 'infrastructure', sourceId: check.key, type: { in: ['infrastructure.down', 'infrastructure.recovered'] } },
      orderBy: { occurredAt: 'desc' },
    });
    const suffix = createHash('sha256').update(new Date().toISOString()).digest('hex').slice(0, 16);
    if (!check.ok && latest?.type !== 'infrastructure.down') {
      await publish({
        eventKey: `infrastructure:${check.key}:down:${suffix}`, type: 'infrastructure.down',
        title: `Сбой: ${check.label}`, body: `${check.detail || 'Проверка завершилась ошибкой'}. Требуется техническая проверка.`, sourceId: check.key,
      });
    }
    if (check.ok && latest?.type === 'infrastructure.down') {
      await publish({
        eventKey: `infrastructure:${check.key}:recovered:${suffix}`, type: 'infrastructure.recovered',
        title: `Восстановлено: ${check.label}`, body: 'Проверка снова проходит успешно.', sourceId: check.key,
      });
    }
  }
  console.log(JSON.stringify({ ok: checks.every((check) => check.ok), checks: checks.map(({ key, ok }) => ({ key, ok })) }));
}

main().finally(() => prisma.$disconnect());
