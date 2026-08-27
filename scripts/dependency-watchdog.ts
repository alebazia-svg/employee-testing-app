import { prisma } from '@/lib/prisma';
import { createHash } from 'node:crypto';
import { getAIAgentHealth } from '@/lib/one-c';
import { runSabyOfdProbe } from '@/lib/saby-ofd';
import { getTBankTerminals } from '@/lib/tbank-acquiring';
import { expiryWarning, parseDependencyExpiries, type DependencyProbe } from '@/lib/dependency-watchdog';
import { queueAdminInboxTelegramDelivery } from '@/lib/admin-inbox';

function moscowDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

function compact(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, 180);
}

async function platformaProbe(): Promise<DependencyProbe> {
  const checkedAt = new Date();
  const baseUrl = process.env.PLATFORMA_OFD_PROXY_BASE_URL?.trim().replace(/\/+$/, '');
  if (!baseUrl) return { key: 'platforma_ofd', label: 'Platforma ОФД', ok: false, checkedAt, detail: 'Не настроен адрес подключения' };
  try {
    const response = await fetch(`${baseUrl}/api/v1/ofd/platforma/kkts`, { cache: 'no-store', signal: AbortSignal.timeout(15_000) });
    return { key: 'platforma_ofd', label: 'Platforma ОФД', ok: response.ok, checkedAt, detail: response.ok ? '' : `HTTP ${response.status}` };
  } catch (error) {
    return { key: 'platforma_ofd', label: 'Platforma ОФД', ok: false, checkedAt, detail: error instanceof Error ? error.name : 'Нет ответа' };
  }
}

async function probes(): Promise<DependencyProbe[]> {
  const checkedAt = new Date();
  const date = moscowDate(checkedAt);
  const inn = process.env.SABY_OFD_ORGANIZATION_INN?.trim() ?? '';
  const [oneC, saby, tbank, platforma] = await Promise.all([
    getAIAgentHealth(),
    runSabyOfdProbe({ organizationInn: inn, dateFrom: date, dateTo: date, limit: 1 }),
    getTBankTerminals(),
    platformaProbe(),
  ]);
  return [
    { key: 'one_c', label: '1С', ok: oneC.ok, checkedAt, detail: oneC.ok ? '' : compact(oneC.errors.join('; ')) },
    { key: 'saby_ofd', label: 'СБИС ОФД', ok: saby.ok, checkedAt, detail: saby.ok ? '' : compact(saby.errors?.join('; ')) },
    { key: 'tbank_acquiring', label: 'Т-Банк — терминалы', ok: tbank.ok, checkedAt, detail: tbank.ok ? '' : compact(tbank.error) },
    platforma,
  ];
}

async function publish(input: { eventKey: string; type: string; title: string; body: string; sourceId: string; href?: string }) {
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } });
  const event = await prisma.adminInboxEvent.upsert({
    where: { eventKey: input.eventKey },
    create: { eventKey: input.eventKey, type: input.type, title: input.title, body: input.body, href: input.href ?? '/admin/inbox', sourceType: 'dependency', sourceId: input.sourceId, occurredAt: new Date() },
    update: {},
  });
  await prisma.adminInboxReceipt.createMany({ data: admins.map(({ id }) => ({ eventId: event.id, userId: id })), skipDuplicates: true });
  await queueAdminInboxTelegramDelivery({ db: prisma, eventId: event.id });
}

async function main() {
  const results = await probes();
  for (const result of results) {
    const latest = await prisma.adminInboxEvent.findFirst({ where: { sourceType: 'dependency', sourceId: result.key, type: { in: ['dependency.down', 'dependency.recovered'] } }, orderBy: { occurredAt: 'desc' } });
    if (!result.ok && latest?.type !== 'dependency.down') {
      await publish({ eventKey: `dependency:${result.key}:down:${createHash('sha256').update(result.checkedAt.toISOString()).digest('hex').slice(0, 16)}`, type: 'dependency.down', title: `Нет данных: ${result.label}`, body: `${result.detail || 'Источник не ответил'}. Ошибки сотрудников по зависимым проверкам не подтверждать до восстановления.`, sourceId: result.key });
    }
    if (result.ok && latest?.type === 'dependency.down') {
      await publish({ eventKey: `dependency:${result.key}:recovered:${createHash('sha256').update(result.checkedAt.toISOString()).digest('hex').slice(0, 16)}`, type: 'dependency.recovered', title: `Связь восстановлена: ${result.label}`, body: 'Источник снова доступен. Пропущенный период будет перепроверен действующими контрольными заданиями.', sourceId: result.key });
    }
  }

  for (const expiry of parseDependencyExpiries(process.env.DEPENDENCY_EXPIRIES_JSON)) {
    const warning = expiryWarning(expiry);
    if (!warning) continue;
    const body = warning.days < 0
      ? `Срок закончился ${expiry.expiresOn}. Проверьте продление и доступ к данным.`
      : warning.days === 0 ? 'Срок заканчивается сегодня. Требуется продление.' : `До окончания ${warning.days} дн. Срок: ${expiry.expiresOn}.`;
    await publish({ eventKey: warning.eventKey, type: warning.state === 'expired' ? 'dependency.expired' : 'dependency.expiring', title: `${expiry.label}: заканчивается доступ`, body, sourceId: expiry.key, href: expiry.renewalUrl || '/admin/inbox' });
  }
  console.log(JSON.stringify({ ok: results.every((item) => item.ok), checks: results.map(({ key, ok }) => ({ key, ok })) }));
}

main().finally(() => prisma.$disconnect());
