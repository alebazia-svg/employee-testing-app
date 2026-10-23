import 'server-only';
import { prisma } from './prisma';
import { activeScheduleNotices, scheduleNoticeKinds, scheduleQuestionIsActive } from './work-schedule-notifications';
import { getMoscowDateKey } from './workday';
import { scheduleCoverage, schedulePersonName } from './work-schedule-coverage';
import type { EmployeeAttentionItem } from './employee-attention';

/** Reading a notice does not answer the request. Recheck the current plan. */
export async function loadEmployeeScheduleAttention(userId: number): Promise<EmployeeAttentionItem[]> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { department: true } });
  if (!user) return [];
  const notices = await prisma.workdayNotification.findMany({ where: { userId, kind: { in: scheduleNoticeKinds }, status: { in: ['pending', 'sent'] } }, orderBy: { scheduledAt: 'desc' } });
  const today = getMoscowDateKey();
  const dated = [...(await activeScheduleNotices(prisma, notices, today)).values()].flat();
  if (!dated.length) return [];
  const dates = [...new Set(dated.map(row => row.date))];
  const [entries, vacations] = await Promise.all([
    prisma.workScheduleEntry.findMany({ where: { department: user.department, date: { in: dates }, user: { role: 'EMPLOYEE', isActive: true, department: user.department } }, include: { user: { select: { name: true } } } }),
    prisma.employeeVacation.findMany({ where: { department: user.department, status: 'active', dateFrom: { lte: dates.slice().sort().at(-1)! }, dateTo: { gte: today } } }),
  ]);
  return scheduleAttentionItems({ userId, department: user.department, today, dated, entries, vacations });
}

export function scheduleAttentionItems({ userId, department, today, dated, entries, vacations }: {
  userId: number; department: string; today: string;
  dated: Array<{ date: string; notice: { id: number; kind: string; title: string; readAt: Date | null } }>;
  entries: Array<{ date: string; userId: number; status: string; user: { name: string } }>;
  vacations: Array<{ userId: number; dateFrom: string; dateTo: string }>;
}): EmployeeAttentionItem[] {
  const result = new Map<string, EmployeeAttentionItem>();
  for (const { notice, date } of dated) {
    if (date < today) continue;
    const vacationIds = new Set(vacations.filter(row => row.dateFrom <= date && row.dateTo >= date).map(row => row.userId));
    const day = entries.filter(row => row.date === date);
    const own = day.find(row => row.userId === userId);
    if (!scheduleQuestionIsActive({ kind: notice.kind, status: own?.status, onVacation: vacationIds.has(userId), shortage: scheduleCoverage(department, day.filter(row => row.status === 'working' && !vacationIds.has(row.userId)).length).needsReplacement, date, today })) continue;
    const id = `schedule:${date}`;
    if (result.has(id)) continue;
    const fill = !own;
    const names = day.filter(row => row.status === 'working' && !vacationIds.has(row.userId)).map(row => schedulePersonName(row.user.name)).join(', ');
    const workingCount = day.filter(row => row.status === 'working' && !vacationIds.has(row.userId)).length;
    const staffing = names ? (workingCount === 1 ? `По графику работает один сотрудник — ${names}.` : `По графику работают: ${names}.`) : 'На этот день пока никто не отметил работу.';
    const dateLabel = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'Europe/Moscow' }).format(new Date(`${date}T12:00:00Z`));
    result.set(id, {
      id, kind: 'schedule', title: fill ? `Отметьте график на ${dateLabel}` : `Сможете работать ${dateLabel}?`,
      state: 'action', status: fill ? 'График не отмечен' : 'Нужен ваш ответ', priority: 3, date,
      detail: `${staffing} ${fill ? 'Ваш график ещё не заполнен.' : 'У вас отмечен выходной.'}`,
      scheduleNoticeId: notice.id, scheduleExpectedStatus: own?.status === 'off' ? 'off' : null,
      scheduleDate: date, scheduleAction: fill ? 'fill' : 'replacement',
      notificationIds: notice.readAt ? [] : [notice.id],
      endpoint: '/api/employee/workday/schedule',
      actions: fill
        ? [{ label: 'Работаю', action: 'schedule_working' }, { label: 'Выходной', action: 'schedule_off' }]
        : [{ label: 'Могу выйти', action: 'schedule_working' }, { label: 'Оставить выходной', action: 'schedule_decline' }],
    });
  }
  return [...result.values()];
}
