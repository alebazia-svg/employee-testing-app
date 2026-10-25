import 'server-only';
import { buildAuditTimeline, noticeAuditKey, type AuditEpisode } from './employee-audit-timeline';
import { readInteraction } from './employee-interaction-policy';
import { prisma } from './prisma';
import { employeeNotificationOpening } from './notification-opening';
import { activitySections, activityDayBounds, ACTIVITY_RETENTION_DAYS, type ActivitySection } from './employee-activity-policy';
import { expenseAllocations } from './employee-expense-routing';
import { expenseRemaining, EMPLOYEE_EXPENSE_KIND, EXPENSE_SOURCE_MAX_AGE_MS } from './employee-expense-policy';
import { expenseRecord as record, expenseText as text } from './expense-request-list-view';
import { readHandoverContext, handoverEventTitle } from './employee-handover-audit-policy';

export type ActivityFact = { id: string; section: ActivitySection; at: string; title: string; note: string; visit: boolean };
export type ActivityObligation = { id: number; title: string; body: string; sentAt: string; openedAt: string | null; legacyReadAt: string | null; push: string; result: string; resultAt: string | null; note: string; attention: 'owner' | 'employee' | 'unknown' | null; reason: string; sourceAt: string | null };
export type ActivityEpisode = { id: string; title: string; at: string; result: string; facts: ActivityFact[] };
export type EmployeeActivityReport = {
  date: string; checkedAt: string; startedAt: string | null; retentionDays: number; truncated: boolean;
  shift: { status: 'active' | 'completed' | 'unknown'; startedAt: string | null; endedAt: string | null };
  sections: { id: ActivitySection; label: string; visits: number; actions: number; lastAt: string | null; events: ActivityFact[] }[];
  audit?: AuditEpisode[];
  obligations: ActivityObligation[]; episodes: ActivityEpisode[];
};
/** Local persisted evidence only. Opening this screen never runs 1C reconciliation. */
export async function employeeActivityReport(userId: number, date: string, now = new Date()): Promise<EmployeeActivityReport> {
  const bounds = activityDayBounds(date)!;
  const range = { gte: bounds.start, lt: bounds.end };
  const [coverage, events, days, tasks, schedules, cash, notifications] = await Promise.all([
    prisma.portalActivityCoverage.findUnique({ where: { id: 1 } }),
    prisma.portalActivityEvent.findMany({ where: { userId, createdAt: range, session: { isService: false } }, orderBy: { createdAt: 'desc' }, take: 601 }),
    prisma.workDayEntry.findMany({ where: { userId, OR: [{ startedAt: range }, { endedAt: range }] }, orderBy: { startedAt: 'desc' }, take: 10 }),
    prisma.shiftControlTask.findMany({ where: { run: { userId }, completedAt: range, status: 'done' }, orderBy: { completedAt: 'desc' }, take: 201 }),
    prisma.workScheduleChange.findMany({ where: { userId, source: { in: ['employee', 'employee_bulk', 'employee_bulk_edit'] }, createdAt: range }, orderBy: { createdAt: 'desc' }, take: 201 }),
    prisma.cashOperation.findMany({ where: { userId, createdAt: range }, orderBy: { createdAt: 'desc' }, take: 201 }),
    prisma.workdayNotification.findMany({ where: { userId, sentAt: range }, orderBy: { sentAt: 'asc' }, take: 201,
      include: { task: { select: { status: true, title: true, completedAt: true, numericValue: true } }, issue: { select: { status: true, resolvedAt: true } }, review: { select: { status: true, resolvedAt: true } } } }),
  ]);
  const relatedIds=events.flatMap(e=>{const c=readInteraction(e.context);return e.notificationId?[e.notificationId]:c?.target==='notification'?[Number(c.ref)]:[];});
  const previousNotices=relatedIds.length?await prisma.workdayNotification.findMany({where:{userId,id:{in:relatedIds},NOT:{sentAt:range}},take:200}):[];
  const auditNotices=[...notifications,...previousNotices];
  const shift: EmployeeActivityReport['shift'] = { status: days[0]?.endedAt ? 'completed' : days[0]?.status === 'active' ? 'active' : 'unknown', startedAt: days[0]?.startedAt?.toISOString() ?? null, endedAt: days[0]?.endedAt?.toISOString() ?? null };
  const opens = notifications.length ? await prisma.portalActivityEvent.findMany({ where: { userId, kind: 'notification_open', notificationId: { in: notifications.map(n => n.id) }, session: { isService: false } }, orderBy: { createdAt: 'asc' }, take: 201 }) : [];
  const expenseRef = (n: typeof notifications[number]) => n.kind === EMPLOYEE_EXPENSE_KIND ? n.fingerprint.split(':')[3] || '' : '';
  const refs = notifications.map(expenseRef).filter(Boolean);
  const cases = refs.length ? await prisma.expenseRequestAdminCase.findMany({ where: { oneCRequestRef: { in: refs } }, include: { evaluations: { orderBy: { evaluatedAt: 'desc' }, take: 1 } } }) : [];
  const facts: ActivityFact[] = events.filter(e => ['visit','notification_open'].includes(e.kind)).map(e => ({ id: e.id, section: e.section as ActivitySection, at: e.createdAt.toISOString(),
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
  const episodes = new Map<number, ActivityEpisode>();
  for (const e of [...events].reverse()) {
    if (!['handover','handover_check'].includes(e.kind)) continue;
    const context = readHandoverContext(e.context, e.kind === 'handover_check');
    if (!context) continue;
    const item = episodes.get(context.taskId) || { id: `handover:${context.taskId}`, title: 'Сдача смены', at: e.createdAt.toISOString(), result: 'Завершение не подтверждено', facts: [] };
    item.at = e.createdAt.toISOString();
    item.facts.push({ id: e.id, section: 'day', at: e.createdAt.toISOString(), title: handoverEventTitle(context.stage), visit: false,
      note: context.durationMs !== undefined ? `Между началом и концом ожидания: ${Math.round(context.durationMs / 1000)} с, по данным приложения, включая время в фоне. Это не время бездействия сотрудника.` : context.stage === 'save_error' ? 'Текст этой ошибки не сохранён: журнал не копирует произвольные сообщения и содержимое форм.' : e.kind === 'handover_check' && context.stage === 'check_confirmed' ? 'Автор действия в 1С не установлен.' : '' });
    if (context.stage === 'check_confirmed') item.result = 'ККМ подтверждена; сдача смены проверяется отдельно';
    else if (context.stage.startsWith('check_')) item.result = 'Во время сдачи возникло препятствие';
    episodes.set(context.taskId, item);
  }
  for (const [taskId, item] of episodes) {
    const completed = tasks.find(t => t.id === taskId && t.completedAt);
    if (completed?.completedAt) { item.result = 'Сдача смены завершена'; item.at = completed.completedAt.toISOString(); item.facts.push({ id: `done:${taskId}`, section: 'day', at: item.at, title: item.result, note: 'Подтверждено сохранённой задачей. Завершить мог и администратор.', visit: false }); }
  }
  for (const item of episodes.values()) { item.facts.sort((a,b) => a.at.localeCompare(b.at)); item.at = item.facts.at(-1)!.at; }
  const grouped = new Map<string, ActivityObligation>();
  for (const n of notifications.slice(0,200)) {
    const opened = opens.find(e => e.notificationId === n.id);
    const informational = employeeNotificationOpening(n) === 'notice' || n.kind === EMPLOYEE_EXPENSE_KIND && n.fingerprint.endsWith(':coordinate');
    let result = informational ? 'Информационное сообщение' : 'Выполнение не подтверждено', resultAt: string | null = null, title = n.task?.title || n.title;
    let note = 'Отметка прочтения и закрытие сообщения сами по себе не подтверждают выполнение.';
    let knownOpen = Boolean(n.task && n.task.status !== 'done' || n.issue?.status === 'open' || n.review?.status === 'open');
    let sourceAt: string | null = null;
    if (n.task?.status === 'done' && n.task.completedAt) { result = 'Задача выполнена'; resultAt = n.task.completedAt.toISOString(); note = n.task.numericValue !== null ? `Сохранён результат: ${n.task.numericValue.toLocaleString('ru-RU')}.` : 'Подтверждено записью задачи в портале.'; }
    else if (n.issue?.status !== 'open' && n.issue?.resolvedAt || n.review?.status !== 'open' && n.review?.resolvedAt) { result = 'Вопрос закрыт'; resultAt = (n.issue?.resolvedAt || n.review?.resolvedAt)!.toISOString(); note = 'Закрытие подтверждено системой; это не обязательно личное действие сотрудника.'; }
    const c = cases.find(c => c.oneCRequestRef === expenseRef(n));
    if (c) {
      title = n.title;
      const evaluation = c.evaluations.find(e => e.sourceHash === c.latestSourceHash);
      const source = record(evaluation?.normalizedSource);
      sourceAt = c.lastSeenAt.toISOString();
      const cashboxRef = n.fingerprint.split(':')[2];
      const allocations = expenseAllocations(source);
      const own = allocations?.filter(a => a.cashboxRef === cashboxRef);
      const paidFromBox = Array.isArray(record(source.linkedCashExpenseOrders).rows) && (record(source.linkedCashExpenseOrders).rows as unknown[]).some(r => text(record(record(r).cashbox).ref).toLowerCase() === cashboxRef && record(r).posted === true && record(r).deletion_mark === false && Number(record(r).executed_amount) > 0);
      const outstanding = allocations === null || !own?.length && !paidFromBox && expenseRemaining(source, false) !== 0 ? null : own!.reduce((sum, a) => sum + a.remaining, 0);
      knownOpen = Boolean(evaluation?.sourceComplete && +now >= +c.lastSeenAt && +now - +c.lastSeenAt <= EXPENSE_SOURCE_MAX_AGE_MS && outstanding !== null && outstanding > 0);
      if (evaluation?.sourceComplete && outstanding === 0) {
        result = 'Часть заявки исполнена';
        const rows = record(source.linkedCashExpenseOrders).rows;
        const orders = Array.isArray(rows) ? rows.map(record).filter(r => r.posted === true && r.deletion_mark === false && text(record(r.cashbox).ref).toLowerCase() === cashboxRef) : [];
        note = `${orders.length ? '' : 'Заявка полностью исполнена по данным 1С. '}${orders.map(r => `№ ${text(r.number)} · время документа ${text(r.date)}`).join('; ')}. Автор и точное время проведения не подтверждены.`;
      } else note = knownOpen ? 'По полным сохранённым данным 1С исполнение ещё не подтверждено.' : 'Данные 1С неполные или устарели. По ним нельзя делать вывод о задержке сотрудника.';
    }
    const done = !['Выполнение не подтверждено','Информационное сообщение'].includes(result);
    const attention: ActivityObligation['attention'] = done || informational ? null : !knownOpen ? 'unknown' : shift.status === 'completed' ? 'owner' : shift.status === 'active' ? 'employee' : 'unknown';
    const reason = attention === 'owner' ? 'Смена завершена, а вопрос остался открытым. Уточните, что помешало выполнению.' : attention === 'employee' ? 'Сотрудник ещё на смене. Поручение остаётся в работе; просрочка не установлена.' : attention === 'unknown' ? 'Недостаточно свежих данных о результате или смене. Задержку сотрудника подтвердить нельзя.' : '';
    const item: ActivityObligation = { id: n.id, title, body: n.body, sentAt: n.sentAt!.toISOString(), openedAt: opened?.createdAt.toISOString() ?? null, legacyReadAt: n.readAt?.toISOString() ?? null,
      push: n.pushDeliveredAt ? 'Push принят службой доставки; показ на устройстве не подтверждён.' : 'Приём push службой доставки не подтверждён.', result, resultAt, note, attention, reason, sourceAt };
    const key = informational ? `notice:${n.id}` : n.taskId ? `task:${n.taskId}` : n.issueId ? `issue:${n.issueId}` : n.reviewId ? `review:${n.reviewId}` : expenseRef(n) ? `expense:${expenseRef(n)}` : n.fingerprint;
    const previous = grouped.get(key);
    if (previous) { item.sentAt = previous.sentAt; item.openedAt = [previous.openedAt, item.openedAt].filter((v): v is string => !!v).sort()[0] || null; }
    grouped.set(key, item);
  }
  const audit=buildAuditTimeline(events,auditNotices,date,[
    ...[...grouped.values()].filter(n=>!['Выполнение не подтверждено','Информационное сообщение'].includes(n.result)).map(n=>({id:noticeAuditKey(notifications.find(v=>v.id===n.id)!),title:n.title,result:n.result,at:n.resultAt})),
    ...[...episodes.values()].filter(e=>e.result==='Сдача смены завершена').map(e=>({id:e.id,title:e.title,result:e.result,at:tasks.find(t=>`handover:${t.id}`===e.id)?.completedAt?.toISOString()??null})),
  ]);
  return { audit, date, checkedAt: now.toISOString(), startedAt: coverage?.startedAt.toISOString() ?? null, retentionDays: ACTIVITY_RETENTION_DAYS, shift,
    truncated: events.length >= 600 || tasks.length > 200 || schedules.length > 200 || cash.length > 200 || notifications.length > 200,
    sections: Object.entries(activitySections).map(([id,label]) => { const rows = facts.filter(f => f.section === id); return { id: id as ActivitySection, label, visits: rows.filter(f => f.visit).length, actions: rows.filter(f => !f.visit).length, lastAt: rows[0]?.at || null, events: rows }; }),
    obligations: [...grouped.values()], episodes: [...episodes.values()].sort((a,b) => b.at.localeCompare(a.at)) };
}
