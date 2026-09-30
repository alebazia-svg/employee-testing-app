import 'server-only';

import type { PrismaClient } from '@prisma/client';

export type TerminalFiscalSourceName = 'aqsi' | 'oneC' | 'ofd';

export const TERMINAL_FISCAL_SOURCE_FAILURE_THRESHOLD = 3;

type SourceCompletenessRun = {
  tbankComplete: boolean;
  oneCComplete: boolean;
  ofdComplete: boolean;
};

const SOURCE_COMPLETENESS_FIELD = {
  aqsi: 'tbankComplete',
  oneC: 'oneCComplete',
  ofd: 'ofdComplete',
} as const satisfies Record<TerminalFiscalSourceName, keyof SourceCompletenessRun>;

const SOURCE_LABEL: Record<TerminalFiscalSourceName, string> = {
  aqsi: 'aQsi',
  oneC: '1С',
  ofd: 'ОФД',
};

export function hasConsecutiveTerminalFiscalSourceFailures(
  source: TerminalFiscalSourceName,
  runs: SourceCompletenessRun[],
  threshold = TERMINAL_FISCAL_SOURCE_FAILURE_THRESHOLD,
) {
  if (runs.length < threshold) return false;
  const field = SOURCE_COMPLETENESS_FIELD[source];
  return runs.slice(0, threshold).every((run) => run[field] === false);
}

export async function syncTerminalFiscalSourceHealth(db: PrismaClient, input: {
  mappingId: string;
  mappingLabel: string;
  periodFrom: Date;
  checkedAt: Date;
  sources: Record<TerminalFiscalSourceName, { complete: boolean; errorCode?: string }>;
}) {
  const admins = await db.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } });
  if (!admins.length) return { created: 0 };
  let created = 0;
  for (const source of Object.keys(input.sources) as TerminalFiscalSourceName[]) {
    const state = input.sources[source];
    const sourceId = `terminal-fiscal:${input.mappingId}:${source}`;
    const latest = await db.adminInboxEvent.findFirst({
      where: { sourceType: 'dependency', sourceId, type: { in: ['dependency.down', 'dependency.recovered'] } },
      orderBy: { occurredAt: 'desc' }, select: { id: true, type: true },
    });
    const consecutiveFailure = !state.complete && latest?.type !== 'dependency.down'
      ? hasConsecutiveTerminalFiscalSourceFailures(source, await db.terminalFiscalMatchRun.findMany({
          where: { mappingId: input.mappingId, periodFrom: input.periodFrom, status: 'completed' },
          orderBy: { createdAt: 'desc' },
          take: TERMINAL_FISCAL_SOURCE_FAILURE_THRESHOLD,
          select: { tbankComplete: true, oneCComplete: true, ofdComplete: true },
        }))
      : false;
    const type = state.complete
      ? latest?.type === 'dependency.down' ? 'dependency.recovered' : null
      : latest?.type !== 'dependency.down' && consecutiveFailure ? 'dependency.down' : null;
    if (!type) continue;
    const label = SOURCE_LABEL[source];
    const checkedAt = input.checkedAt.toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
    const event = await db.adminInboxEvent.create({ data: {
      eventKey: `${sourceId}:${type}:${input.checkedAt.toISOString()}`,
      type,
      title: type === 'dependency.down' ? `Нет полных данных · ${label}` : `Данные снова поступают · ${label}`,
      body: type === 'dependency.down'
        ? `${input.mappingLabel}: с ${checkedAt} портал не получает полный ответ от ${label}. Код: ${state.errorCode || 'SOURCE_INCOMPLETE'}. Проверка оплат временно неполная; система повторит запрос автоматически.`
        : `${input.mappingLabel}: ${label} снова отвечает полностью. Пропущенный период будет перепроверен автоматически.`,
      href: '/admin/inbox', sourceType: 'dependency', sourceId, occurredAt: input.checkedAt,
    } });
    await db.adminInboxReceipt.createMany({ data: admins.map(({ id }) => ({ eventId: event.id, userId: id })), skipDuplicates: true });
    if (type === 'dependency.recovered' && latest?.type === 'dependency.down') {
      await db.adminInboxReceipt.updateMany({
        where: { eventId: latest.id, readAt: null },
        data: { readAt: input.checkedAt },
      });
    }
    created += 1;
  }
  return { created };
}
