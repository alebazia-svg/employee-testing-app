import 'server-only';
import { prisma } from './prisma';
import { activeScheduleNotices, scheduleNoticeKinds, scheduleQuestionIsActive } from './work-schedule-notifications';
import { getMoscowDateKey } from './workday';
import { scheduleCoverage, schedulePersonName } from './work-schedule-coverage';
import type { EmployeeAttentionItem } from './employee-attention';
import { scheduleNearDates, scheduleNearReminder, SCHEDULE_NEAR_KIND } from './schedule-near-reminder';

/** Reading a notice does not answer the request. Recheck the current plan. */
export async function loadEmployeeScheduleAttention(userId: number): Promise<EmployeeAttentionItem[]> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { department: true, role: true, isActive: true } });
  if (!user || user.role !== 'EMPLOYEE' || !user.isActive || !['retail','wholesale'].includes(user.department)) return [];
  const notices = await prisma.workdayNotification.findMany({ where: { userId, kind: { in: scheduleNoticeKinds }, status: { in: ['pending', 'sent'] } }, orderBy: { scheduledAt: 'desc' } });
  const today = getMoscowDateKey();
  const dated = [...(await activeScheduleNotices(prisma, notices, today)).values()].flat();
  const dates = [...new Set([...dated.map(row => row.date), ...scheduleNearDates(today)])];
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
  const near = scheduleNearReminder({today,entries:entries.filter(e=>e.userId===userId),vacations:vacations.filter(v=>v.userId===userId)});
  if (['retail','wholesale'].includes(department) && near.active) {
    result.set(`schedule-plan:${today}`, {
      id:`schedule-plan:${today}`,kind:'schedule',title:near.title,state:'action',status:near.qualifier,
      // Older clients open the ordinary month when this calendar intent has no weekStart.
      priority:3,date:near.missing[0],detail:near.body,scheduleAction:'week',scheduleDate:near.missing[0],
      scheduleOpenEditor:near.missing.length===1,
      notificationIds:dated.filter(d=>d.notice.kind===SCHEDULE_NEAR_KIND&&!d.notice.readAt).map(d=>d.notice.id),
    });
  }
  for (const { notice, date } of dated) {
    if (date < today) continue;
    if (!['schedule_replacement_request','schedule_replacement_digest'].includes(notice.kind)) continue;
    const vacationIds = new Set(vacations.filter(row => row.dateFrom <= date && row.dateTo >= date).map(row => row.userId));
    const day = entries.filter(row => row.date === date);
    const own = day.find(row => row.userId === userId);
    if (!scheduleQuestionIsActive({ kind: notice.kind, status: own?.status, onVacation: vacationIds.has(userId), shortage: scheduleCoverage(department, day.filter(row => row.status === 'working' && !vacationIds.has(row.userId)).length).needsReplacement, date, today })) continue;
    const id = `schedule:${date}`;
    if (result.has(id)) continue;
    const fill = !own;
    const names = day.filter(row => row.status === 'working' && !vacationIds.has(row.userId)).map(row => schedulePersonName(row.user.name)).join(', ');
    const workingCount = day.filter(row => row.status === 'working' && !vacationIds.has(row.userId)).length;
    const staffing = names ? `По графику: ${names}.` : 'На этот день в графике пока никто не отмечен.';
    const dateLabel = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'Europe/Moscow' }).format(new Date(`${date}T12:00:00Z`));
    result.set(id, {
      id, kind: 'schedule', title: fill ? `Отметьте график на ${dateLabel}` : `Сможете работать ${dateLabel}?`,
      state: 'action', status: fill ? 'График не отмечен' : 'Нужен ваш ответ', priority: 3, date,
      detail: fill ? 'Выберите: работаете вы или у вас выходной.' : `${staffing} У вас выходной. Сможете выйти?`,
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
