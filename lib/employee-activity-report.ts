import 'server-only';
import { prisma } from './prisma';
import { employeeNotificationOpening } from './notification-opening';
import { activitySections, activityDayBounds, ACTIVITY_RETENTION_DAYS, type ActivitySection } from './employee-activity-policy';
import { expenseOutstanding, EMPLOYEE_EXPENSE_KIND } from './employee-expense-policy';
import { expenseRecord as record, expenseText as text } from './expense-request-list-view';

export type ActivityFact = { id: string; section: ActivitySection; at: string; title: string; note: string; visit: boolean };
export type ActivityObligation = { id: number; title: string; body: string; sentAt: string; openedAt: string | null; legacyReadAt: string | null; push: string; result: string; resultAt: string | null; note: string };
export type EmployeeActivityReport = {
  date: string; checkedAt: string; startedAt: string | null; retentionDays: number; truncated: boolean;
  sections: { id: ActivitySection; label: string; visits: number; actions: number; lastAt: string | null; events: ActivityFact[] }[];
  obligations: ActivityObligation[];
};
/** Reads local evidence only: no reconciliation, 1C calls or notification mutations. */
export async function employeeActivityReport(userId: number, date: string, now = new Date()): Promise<EmployeeActivityReport> {
  const bounds = activityDayBounds(date)!;
  const range = { gte: bounds.start, lt: bounds.end };
  const [coverage, events, days, tasks, schedules, cash, notifications] = await Promise.all([
    prisma.portalActivityCoverage.findUnique({ where: { id: 1 } }),
    prisma.portalActivityEvent.findMany({ where: { userId, createdAt: range, session: { isService: false } }, orderBy: { createdAt: 'desc' }, take: 601 }),
    prisma.workDayEntry.findMany({ where: { userId, OR: [{ startedAt: range }, { endedAt: range }] }, take: 10 }),
    prisma.shiftControlTask.findMany({ where: { run: { userId }, completedAt: range, status: 'done' }, orderBy: { completedAt: 'desc' }, take: 201 }),
    prisma.workScheduleChange.findMany({ where: { userId, source: { in: ['employee', 'employee_bulk', 'employee_bulk_edit'] }, createdAt: range }, orderBy: { createdAt: 'desc' }, take: 201 }),
    prisma.cashOperation.findMany({ where: { userId, createdAt: range }, orderBy: { createdAt: 'desc' }, take: 201 }),
    prisma.workdayNotification.findMany({ where: { userId, sentAt: range }, orderBy: { sentAt: 'desc' }, take: 201,
      include: { task: { select: { status: true, title: true, completedAt: true, numericValue: true } }, issue: { select: { status: true, resolvedAt: true } }, review: { select: { status: true, resolvedAt: true } } } }),
  ]);
  const opens = notifications.length ? await prisma.portalActivityEvent.findMany({ where: { userId, kind: 'notification_open', notificationId: { in: notifications.map(n => n.id) }, session: { isService: false } }, take: 201 }) : [];
  const expenseRef = (n: typeof notifications[number]) => n.kind === EMPLOYEE_EXPENSE_KIND ? n.fingerprint.split(':')[3] || '' : '';
  const refs = notifications.map(expenseRef).filter(Boolean);
  const cases = refs.length ? await prisma.expenseRequestAdminCase.findMany({ where: { oneCRequestRef: { in: refs } }, include: { evaluations: { orderBy: { evaluatedAt: 'desc' }, take: 1 } } }) : [];
  const facts: ActivityFact[] = events.map(e => ({ id: e.id, section: e.section as ActivitySection, at: e.createdAt.toISOString(),
    title: e.kind === 'visit' ? 'Открыл раздел' : notifications.some(n => n.id === e.notificationId) ? `Открыл уведомление «${notifications.find(n => n.id === e.notificationId)!.title}»` : 'Открыл уведомление', note: e.kind === 'visit' ? 'Раздел был открыт в видимом приложении.' : 'Открытие в приложении зафиксировано; это не подтверждает выполнение поручения.', visit: e.kind === 'visit' }));
  const add = (id: string, section: ActivitySection, at: Date | null, title: string, note = 'Подтверждено сохранённой записью портала.') => {
    if (at && at >= bounds.start && at < bounds.end) facts.push({ id, section, at: at.toISOString(), title, note, visit: false });
  };
  for (const d of days) {
    add(`start:${d.id}`, 'day', d.startedAt, 'Начало смены', 'Сохранённая отметка начала смены.');
    add(`end:${d.id}`, 'day', d.endedAt, 'Смена завершена', 'Факт завершения; это мог сделать и администратор.');
  }
  for (const t of tasks) add(`task:${t.id}`, 'day', t.completedAt, `${t.title}${t.numericValue !== null ? ` · ${t.numericValue.toLocaleString('ru-RU')}` : ''}`);
  for (const s of schedules) add(`schedule:${s.id}`, 'schedule', s.createdAt, `Сохранил график: ${new Date(`${s.date}T12:00:00+03:00`).toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow', day: 'numeric', month: 'long' })} — ${s.nextStatus === 'working' ? 'рабочий день' : 'выходной'}`);
  for (const c of cash) add(`cash:${c.id}`, 'day', c.createdAt, `Кассовая операция · ${c.amount.toLocaleString('ru-RU')} ₽`, c.oneCPostedAt ? `Проведено в 1С · № ${c.oneCDocumentNumber || 'не передан'}` : 'Запись в портале; проведение в 1С не подтверждено.');
  facts.sort((a,b) => b.at.localeCompare(a.at));
  const obligations: ActivityObligation[] = notifications.slice(0,200).map(n => {
    const opened = opens.find(e => e.notificationId === n.id);
    let result = 'Выполнение не подтверждено', resultAt: string | null = null, title = n.task?.title || n.title;
    if (employeeNotificationOpening(n) === 'notice') result = 'Информационное сообщение';
    let note = 'Отметка прочтения и закрытие сообщения сами по себе не подтверждают выполнение.';
    if (n.task?.status === 'done' && n.task.completedAt) {
      result = 'Задача выполнена'; resultAt = n.task.completedAt.toISOString();
      note = n.task.numericValue !== null ? `Сохранён результат: ${n.task.numericValue.toLocaleString('ru-RU')}.` : 'Подтверждено записью задачи в портале.';
    } else if (n.issue?.resolvedAt || n.review?.resolvedAt) {
      result = 'Вопрос закрыт'; resultAt = (n.issue?.resolvedAt || n.review?.resolvedAt)!.toISOString();
      note = 'Закрытие подтверждено системой; это не обязательно личное действие сотрудника.';
    }
    const c = cases.find(c => c.oneCRequestRef === expenseRef(n));
    if (c) {
      title = `Расход · ${c.amount?.toString() || '—'} ₽ · № ${c.oneCNumber}`;
      const evaluation = c.evaluations.find(e => e.sourceHash === c.latestSourceHash);
      const source = record(evaluation?.normalizedSource);
      if (evaluation?.sourceComplete && expenseOutstanding(source) === 0) {
        result = 'Расходник проведён';
        const rows = record(source.linkedCashExpenseOrders).rows;
        const orders = Array.isArray(rows) ? rows.map(record).filter(r => r.posted === true && r.deletion_mark === false) : [];
        note = `${orders.map(r => `№ ${text(r.number)} · время документа ${text(r.date)}`).join('; ')}. По данным на ${c.lastSeenAt.toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}. Автор и точное время проведения не подтверждены.`;
      } else { note = 'По сохранённым данным 1С полное исполнение не подтверждено. Здесь не выполняется дополнительный запрос в 1С.'; }
    }
    return { id: n.id, title, body: n.body, sentAt: n.sentAt!.toISOString(), openedAt: opened?.createdAt.toISOString() ?? null,
      legacyReadAt: n.readAt?.toISOString() ?? null, push: n.pushDeliveredAt ? 'Push принят службой доставки; показ на устройстве не подтверждён.' : 'Приём push службой доставки не подтверждён.', result, resultAt, note };
  });
  return { date, checkedAt: now.toISOString(), startedAt: coverage?.startedAt.toISOString() ?? null, retentionDays: ACTIVITY_RETENTION_DAYS,
    truncated: events.length >= 600 || tasks.length > 200 || schedules.length > 200 || cash.length > 200 || notifications.length > 200,
    sections: Object.entries(activitySections).map(([id,label]) => {
      const rows = facts.filter(f => f.section === id);
      return { id: id as ActivitySection, label, visits: rows.filter(f => f.visit).length, actions: rows.filter(f => !f.visit).length, lastAt: rows[0]?.at || null, events: rows };
    }), obligations };
}
