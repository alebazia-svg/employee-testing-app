import type { Prisma } from '@prisma/client';
import { queueAdminInboxTelegramDelivery } from '@/lib/admin-inbox';

export const staleWorkdayCloseReasons = [
  { code: 'forgot_close', label: 'Забыл закрыть смену' },
  { code: 'left_early', label: 'Ушёл раньше' },
  { code: 'no_internet', label: 'Не было интернета' },
  { code: 'portal_unavailable', label: 'Портал не открывался' },
  { code: 'other', label: 'Другое' },
] as const;

export type StaleWorkdayCloseReasonCode = typeof staleWorkdayCloseReasons[number]['code'];

const legacyReasonCodes: Record<string, StaleWorkdayCloseReasonCode> = {
  'Забыл закрыть рабочий день': 'forgot_close',
  'Не удалось закончить сдачу смены': 'other',
  'Техническая проблема': 'other',
  'По указанию администратора': 'other',
  'Другое': 'other',
};

export function readStaleWorkdayCloseReason(value: unknown) {
  const source = typeof value === 'string' ? value.trim() : '';
  const current = staleWorkdayCloseReasons.find((reason) => reason.code === source);
  const code = current?.code ?? legacyReasonCodes[source] ?? null;
  const reason = code ? staleWorkdayCloseReasons.find((item) => item.code === code)! : null;
  return reason ? { ...reason, legacy: !current } : null;
}

export function validateStaleWorkdayClose(input: { reason: unknown; comment: unknown }) {
  const reason = readStaleWorkdayCloseReason(input.reason);
  const comment = typeof input.comment === 'string' ? input.comment.trim() : '';
  if (!reason) return { ok: false as const, error: 'Выберите причину' };
  if (reason.code === 'other' && !comment) return { ok: false as const, error: 'Коротко опишите причину' };
  if (comment.length > 1000) return { ok: false as const, error: 'Комментарий должен быть не длиннее 1000 символов' };
  return { ok: true as const, reason, comment };
}

export function staleWorkdayCloseAuditComment(input: { reasonLabel: string; comment?: string }) {
  return [
    'Предыдущий рабочий день закрыт позже. Обязательные шаги пропущены.',
    `Причина: ${input.reasonLabel}.`,
    input.comment ? `Комментарий сотрудника: ${input.comment}` : '',
  ].filter(Boolean).join('\n');
}

function dateKeyMs(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return Date.UTC(year, month - 1, day);
}

export function carriedIssueAgeDays(originDate: string, currentDate: string) {
  const origin = dateKeyMs(originDate);
  const current = dateKeyMs(currentDate);
  if (origin === null || current === null) return 1;
  const difference = Math.round((current - origin) / 86_400_000);
  return Math.max(1, difference + 1);
}

export function carriedIssueAdminTitle(ageDays: number) {
  if (ageDays <= 1) return 'Ошибка осталась открытой';
  if (ageDays === 2) return 'Ошибка открыта второй день';
  if (ageDays === 3) return 'Ошибка открыта третий день';
  return `Ошибка открыта ${ageDays}-й день`;
}

function shortDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return 'дата не указана';
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(new Date(Date.UTC(year, month - 1, day)));
}

type CarryIssue = { id: number; originDate: string; title: string };
type Db = Pick<Prisma.TransactionClient, 'user' | 'adminInboxEvent' | 'adminInboxReceipt' | 'adminInboxDelivery'>;

export async function notifyAdminsAboutCarriedWorkdayIssues(input: {
  db: Db;
  employeeId: number;
  currentDate: string;
  issues: CarryIssue[];
  occurredAt: Date;
}) {
  if (!input.issues.length) return { eventCount: 0, recipientCount: 0 };
  const [employee, admins] = await Promise.all([
    input.db.user.findUnique({ where: { id: input.employeeId }, select: { name: true } }),
    input.db.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } }),
  ]);
  for (const issue of input.issues) {
    const ageDays = carriedIssueAgeDays(issue.originDate, input.currentDate);
    const event = await input.db.adminInboxEvent.upsert({
      where: { eventKey: `workday_issue:carried:${issue.id}:${input.currentDate}` },
      create: {
        eventKey: `workday_issue:carried:${issue.id}:${input.currentDate}`,
        type: 'workday.issue_carried',
        title: carriedIssueAdminTitle(ageDays),
        body: `${employee?.name || 'Сотрудник'} · ошибка от ${shortDate(issue.originDate)} · ${issue.title}`,
        href: `/admin/workday/issues/${issue.id}`,
        sourceType: 'workday_control_issue',
        sourceId: String(issue.id),
        occurredAt: input.occurredAt,
      },
      update: {},
    });
    if (admins.length) {
      await input.db.adminInboxReceipt.createMany({
        data: admins.map((admin) => ({ eventId: event.id, userId: admin.id })),
        skipDuplicates: true,
      });
    }
    await queueAdminInboxTelegramDelivery({ db: input.db, eventId: event.id });
  }
  return { eventCount: input.issues.length, recipientCount: admins.length };
}
