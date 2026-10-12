import type { AttentionUrgency } from './admin-inbox-attention-policy';
import { attentionDay } from './admin-inbox-attention-policy';

export type DecisionDeadline = { key: string; at: string; label: string };
export function deadlineAt(date: string, minutes: number | null): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || minutes === null || !Number.isInteger(minutes) || minutes < 0 || minutes >= 1440) return null;
  const start = Date.parse(`${date}T00:00:00+03:00`);
  return Number.isFinite(start) ? new Date(start + minutes * 60_000).toISOString() : null;
}
export function urgentDeadline(deadlines: DecisionDeadline[], now: Date): AttentionUrgency | undefined {
  const deadline = [...deadlines].filter(d => Number.isFinite(Date.parse(d.at))).sort((a,b) => a.at.localeCompare(b.at))[0];
  if (!deadline || Date.parse(deadline.at) - +now > 30 * 60_000) return undefined;
  const phase = (at: string) => Date.parse(at) <= +now ? 'due' as const : 'upcoming' as const;
  const signals = deadlines.filter(d => Date.parse(d.at) - +now <= 30 * 60_000).map(d => `${d.key}:${phase(d.at)}`).sort();
  return { ...deadline, phase: phase(deadline.at), signals };
}
export function deadlineLabel(deadline: AttentionUrgency) {
  const time = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit' }).format(new Date(deadline.at));
  const date = attentionDay(new Date(deadline.at)).split('-').reverse().slice(0,2).join('.');
  return `${deadline.phase === 'due' ? 'Срок наступил в' : 'Решить до'} ${time} · ${date} · ${deadline.label}`;
}
export function buyerDeadline(requestedAt: Date): DecisionDeadline {
  // Owner-confirmed hours for the fixed accountable recipient, not a guessed manager shift.
  return { key: `buyer:${attentionDay(requestedAt)}`, at: deadlineAt(attentionDay(requestedAt), 18 * 60)!, label: 'Астемир уходит в 18:00' };
}
export type DecisionShift = { id: number; date: string; startedAt: Date; endedAt: Date | null; shiftEndMinutes: number | null;
  deviations: { requestedEndMinutes: number | null }[];
  shiftControlRun: { tasks: { id: number; plannedTimeMinutes: number | null; status: string; completedAt: Date | null }[] } | null };
export function shiftDeadlines(shift: DecisionShift | null | undefined, requestedAt: Date, now: Date): DecisionDeadline[] {
  if (!shift || shift.date !== attentionDay(now) || shift.startedAt > now) return [];
  const endMinutes = [shift.shiftEndMinutes, ...shift.deviations.map(d => d.requestedEndMinutes)].filter((n): n is number => n !== null);
  const end = shift.endedAt?.toISOString() ?? deadlineAt(shift.date, endMinutes.length ? Math.min(...endMinutes) : null);
  const deadlines: DecisionDeadline[] = end ? [{ key: `shift:${shift.id}:${end}`, at: end, label: shift.endedAt ? 'Смена уже завершена' : 'Окончание смены' }] : [];
  if (!shift.endedAt) for (const task of shift.shiftControlRun?.tasks ?? []) {
    if (task.completedAt || task.status !== 'pending') continue;
    const at = deadlineAt(shift.date, task.plannedTimeMinutes);
    // An old unfinished morning task must not make a newly created request overdue.
    if (at && Date.parse(at) >= +requestedAt) deadlines.push({ key: `cash:${task.id}:${at}`, at, label: 'Пересчёт кассы' });
  }
  return deadlines;
}
export function cashIssueDeadline(scheduledAt: Date, shiftStartedAt?: Date): DecisionDeadline {
  const at = new Date(Math.max(+scheduledAt, +(shiftStartedAt ?? scheduledAt)) + 60 * 60_000).toISOString();
  return { key: `issue:${at}`, at, label: 'Час без подтверждения выдачи в 1С' };
}
