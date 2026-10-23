import 'server-only';
import type { Prisma } from '@prisma/client';
import { getMoscowDateKey } from './workday';
import { scheduleCoverage, schedulePersonName } from './work-schedule-coverage';

export const scheduleNoticeKinds = ['schedule_fill_request', 'schedule_replacement_request', 'schedule_replacement_digest'];
type Db = Prisma.TransactionClient;
type Notice = { id: number; kind: string; fingerprint: string; title: string; readAt: Date | null; scheduledAt: Date };
export type DatedScheduleNotice = { date: string; notice: Notice };

export function scheduleNoticeRef(fingerprint: string) {
  const match = /^schedule-coverage:([^:]+):(\d{4}-\d{2}-\d{2}):(\d+)$/.exec(fingerprint);
  return match ? { department: match[1], date: match[2], userId: Number(match[3]) } : null;
}

export function scheduleQuestionKind(input: { status?: string; onVacation: boolean; shortage: boolean; requestKnownOff: boolean }) {
  if (input.onVacation || !input.shortage || input.status === 'working') return null;
  if (!input.status) return 'schedule_fill_request';
  return input.status === 'off' && input.requestKnownOff ? 'schedule_replacement_request' : null;
}

export function scheduleQuestionIsActive(input: { kind: string; status?: string; onVacation: boolean; shortage: boolean; date: string; today: string }) {
  if (input.date < input.today || input.onVacation || input.status === 'working') return false;
  // Once asked, an employee still needs to fill their own plan even if colleagues
  // have already supplied the minimum coverage. A replacement is no longer needed.
  if (input.kind === 'schedule_fill_request') return !input.status;
  return input.shortage;
}

/** Older monthly digests did not store dates. Only expose reductions backed by
 * their author's audit records AND a still-unchanged day off. Never infer dates
 * from message text. Explicit date-specific records/answers take precedence. */
export async function datedScheduleNotices(db: Db, user: { id: number; department: string }, notices: Notice[], today: string): Promise<DatedScheduleNotice[]> {
  const dated: DatedScheduleNotice[] = [];
  const direct = notices.filter(row => row.kind !== 'schedule_replacement_digest');
  for (const notice of direct) {
    const ref = scheduleNoticeRef(notice.fingerprint);
    if (ref && ref.userId === user.id && ref.department === user.department && ref.date >= today) dated.push({ date: ref.date, notice });
  }
  const digests = notices.filter(row => row.kind === 'schedule_replacement_digest');
  if (!digests.length) return dated;
  const answered = await db.workdayNotification.findMany({ where: {
    userId: user.id, fingerprint: { startsWith: `schedule-coverage:${user.department}:` },
  }, select: { fingerprint: true } });
  const directDates = new Set(answered.map(row => scheduleNoticeRef(row.fingerprint)?.date));
  for (const notice of digests) {
    const ref = /^schedule-coverage-digest:([^:]+):(\d{4}-\d{2}):(\d+):(\d+)$/.exec(notice.fingerprint);
    if (!ref || ref[1] !== user.department || Number(ref[4]) !== user.id || ref[2] < today.slice(0, 7)) continue;
    const where = { userId: Number(ref[3]), department: user.department, date: { startsWith: `${ref[2]}-` }, source: 'employee_bulk_edit', previousStatus: 'working', nextStatus: 'off', createdAt: { lte: notice.scheduledAt } };
    const changes = await db.workScheduleChange.findMany({ where, select: { date: true }, distinct: ['date'] });
    const unchanged = await db.workScheduleEntry.findMany({ where: {
      userId: Number(ref[3]), department: user.department, status: 'off',
      date: { in: changes.map(row => row.date) }, updatedAt: { lte: notice.scheduledAt },
    }, select: { date: true } });
    for (const { date } of unchanged) if (date >= today && !directDates.has(date)) dated.push({ date, notice });
  }
  return dated;
}

/** Shared by attention, bell and push: never send stale date/recipient requests. */
export async function activeScheduleNotices(db: Db, rows: Array<{ id: number; kind: string; fingerprint: string }>, today = getMoscowDateKey()) {
  const ids = rows.filter(row => scheduleNoticeKinds.includes(row.kind)).map(row => row.id);
  if (!ids.length) return new Map<number, DatedScheduleNotice[]>();
  const notices = await db.workdayNotification.findMany({ where: { id: { in: ids }, status: { in: ['pending', 'sent'] }, user: { role: 'EMPLOYEE', isActive: true } }, include: { user: { select: { id: true, department: true } } } });
  const result = new Map<number, DatedScheduleNotice[]>();
  const userIds = [...new Set(notices.map(row => row.userId))];
  for (const userId of userIds) {
    const ownNotices = notices.filter(row => row.userId === userId);
    const user = ownNotices[0].user;
    const dated = await datedScheduleNotices(db, user, ownNotices, today);
    const dates = [...new Set(dated.map(row => row.date))].sort();
    if (!dates.length) continue;
    const [entries, vacations] = await Promise.all([
      db.workScheduleEntry.findMany({ where: { department: user.department, date: { in: dates }, user: { role: 'EMPLOYEE', isActive: true, department: user.department } } }),
      db.employeeVacation.findMany({ where: { department: user.department, status: 'active', dateFrom: { lte: dates.at(-1)! }, dateTo: { gte: today } } }),
    ]);
    for (const item of dated) {
      const onVacation = (id: number) => vacations.some(row => row.userId === id && row.dateFrom <= item.date && row.dateTo >= item.date);
      const day = entries.filter(row => row.date === item.date);
      const own = day.find(row => row.userId === userId);
      if (item.notice.kind === 'schedule_replacement_digest' && own && own.updatedAt > item.notice.scheduledAt) continue;
      if (!scheduleQuestionIsActive({ kind: item.notice.kind, status: own?.status, onVacation: onVacation(userId), shortage: scheduleCoverage(user.department, day.filter(row => row.status === 'working' && !onVacation(row.userId)).length).needsReplacement, date: item.date, today })) continue;
      result.set(item.notice.id, [...(result.get(item.notice.id) ?? []), item]);
    }
  }
  return result;
}

export async function reconcileScheduleQuestions(db: Db, input: { actorId: number; department: string; date: string; requestKnownOff: boolean }) {
  const { department, date } = input;
  const now = new Date();
  const prefix = `schedule-coverage:${department}:${date}:`;
  const [employees, entries, vacations, notices] = await Promise.all([
    db.user.findMany({ where: { role: 'EMPLOYEE', isActive: true, department }, select: { id: true, name: true } }),
    db.workScheduleEntry.findMany({ where: { department, date, user: { role: 'EMPLOYEE', isActive: true, department } } }),
    db.employeeVacation.findMany({ where: { department, status: 'active', dateFrom: { lte: date }, dateTo: { gte: date } }, select: { userId: true } }),
    db.workdayNotification.findMany({ where: { fingerprint: { startsWith: prefix } } }),
  ]);
  const vacationIds = new Set(vacations.map(row => row.userId));
  const working = entries.filter(row => row.status === 'working' && !vacationIds.has(row.userId));
  const shortage = scheduleCoverage(department, working.length).needsReplacement;
  const activeIds = new Set(employees.map(row => row.id));
  const cancelIds = notices.filter(notice => {
    const status = entries.find(row => row.userId === notice.userId)?.status;
    return !activeIds.has(notice.userId) || notice.userId === input.actorId || !scheduleQuestionIsActive({ kind: notice.kind, status, onVacation: vacationIds.has(notice.userId), shortage, date, today: getMoscowDateKey() });
  }).map(row => row.id);
  // Keep an explicit answer distinct from a question retired by restored coverage.
  // Only the latter may become relevant again after another colleague changes plans.
  for (const [actor, status] of [[true, 'answered'], [false, 'resolved']] as const) {
    const ids = notices.filter(row => cancelIds.includes(row.id) && (row.userId === input.actorId) === actor).map(row => row.id);
    if (ids.length) await db.workdayNotification.updateMany({ where: { id: { in: ids }, status: { in: ['pending', 'sent'] } }, data: { status, pushStatus: 'cancelled', nextPushAttemptAt: null } });
  }
  if (date < getMoscowDateKey()) return;
  const dateLabel = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'Europe/Moscow' }).format(new Date(`${date}T12:00:00Z`));
  const names = working.map(row => schedulePersonName(employees.find(person => person.id === row.userId)?.name ?? '')).join(', ');
  const staffing = names ? (working.length === 1 ? `По графику работает один сотрудник — ${names}.` : `По графику работают: ${names}.`) : 'На этот день пока никто не отметил работу.';
  for (const employee of employees) {
    if (employee.id === input.actorId) continue;
    const status = entries.find(row => row.userId === employee.id)?.status;
    const old = notices.find(row => row.userId === employee.id);
    const kind = old && ['pending', 'sent'].includes(old.status) && !cancelIds.includes(old.id) ? old.kind : scheduleQuestionKind({ status, onVacation: vacationIds.has(employee.id), shortage, requestKnownOff: input.requestKnownOff });
    if (!kind) continue;
    // One question per employee/date. Reading keeps it open; an answer is final.
    if (old && !['pending', 'sent', 'resolved'].includes(old.status)) continue;
    const title = kind === 'schedule_fill_request' ? `Отметьте график на ${dateLabel}` : `Сможете работать ${dateLabel}?`;
    const body = `${staffing} ${kind === 'schedule_fill_request' ? 'Отметьте рабочий день или выходной.' : 'У вас отмечен выходной.'}`;
    if (old?.status === 'resolved') {
      await db.workdayNotification.update({ where: { id: old.id }, data: { kind, title, body, status: 'pending', scheduledAt: now, sentAt: null, readAt: null, pushStatus: 'pending', pushDeliveredAt: null, nextPushAttemptAt: null, lastError: '', attemptCount: 0 } });
    } else if (old) {
      if (!cancelIds.includes(old.id) && (old.title !== title || old.body !== body)) await db.workdayNotification.update({ where: { id: old.id }, data: { title, body } });
    } else await db.workdayNotification.create({ data: { userId: employee.id, fingerprint: `${prefix}${employee.id}`, kind, title, body, scheduledAt: now } });
  }
}
