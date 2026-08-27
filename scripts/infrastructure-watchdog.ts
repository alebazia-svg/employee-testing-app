import { createHash } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { queueAdminInboxTelegramDelivery } from '@/lib/admin-inbox';
import { infrastructureAction, parseInfrastructureChecks, type InfrastructureState } from '@/lib/infrastructure-watchdog';

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
      where: { sourceType: 'infrastructure', sourceId: check.key, type: { in: [
        'infrastructure.pending_1', 'infrastructure.pending_2', 'infrastructure.down',
        'infrastructure.recovered', 'infrastructure.transient',
      ] } },
      orderBy: { occurredAt: 'desc' },
    });
    const suffix = createHash('sha256').update(new Date().toISOString()).digest('hex').slice(0, 16);
    const state: InfrastructureState = latest?.type === 'infrastructure.pending_1' ? 'pending_1'
      : latest?.type === 'infrastructure.pending_2' ? 'pending_2'
        : latest?.type === 'infrastructure.down' ? 'down' : 'healthy';
    const action = infrastructureAction(state, check.ok);
    if (action === 'record_pending_1' || action === 'record_pending_2') {
      await prisma.adminInboxEvent.create({ data: {
        eventKey: `infrastructure:${check.key}:${action}:${suffix}`,
        type: action === 'record_pending_1' ? 'infrastructure.pending_1' : 'infrastructure.pending_2',
        title: `Техническая проверка: ${check.label}`,
        body: check.detail || 'Проверка завершилась ошибкой', href: '/admin/inbox',
        sourceType: 'infrastructure', sourceId: check.key, occurredAt: new Date(),
      } });
    }
    if (action === 'alert_down') {
      await publish({
        eventKey: `infrastructure:${check.key}:down:${suffix}`, type: 'infrastructure.down',
        title: `Требуется проверка: ${check.label}`,
        body: `${check.detail || 'Проверка завершилась ошибкой'}. Сбой сохраняется около 20 минут.`, sourceId: check.key,
      });
    }
    if (action === 'recover_silently' && latest) {
      await prisma.adminInboxEvent.update({ where: { id: latest.id }, data: {
        type: 'infrastructure.transient',
        title: `Краткий сбой устранён автоматически: ${check.label}`,
        body: 'Уведомление владельцу не требовалось.',
      } });
    }
    if (action === 'alert_recovered') {
      await publish({
        eventKey: `infrastructure:${check.key}:recovered:${suffix}`, type: 'infrastructure.recovered',
        title: `Работа восстановлена: ${check.label}`, body: 'Продолжительный сбой устранён, проверка снова проходит успешно.', sourceId: check.key,
      });
    }
  }
  console.log(JSON.stringify({ ok: checks.every((check) => check.ok), checks: checks.map(({ key, ok }) => ({ key, ok })) }));
}

main().finally(() => prisma.$disconnect());
