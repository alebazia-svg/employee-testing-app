import { getMoscowDateKey, getMoscowMinutes } from './workday';
import { orderEmployeeAttention, type EmployeeAttentionItem } from './employee-attention';
import { scheduleWeekHref } from './schedule-week-reminder';

export type ReminderWorkday = {
  workDay: { status: string; date: string; endedAt?: string | Date | null } | null;
  unfinishedWorkDay?: { date: string } | null;
  shiftControl: {
    run: { date: string; status: string; completedAt?: string | Date | null } | null;
    tasks: Array<{ id: number; title: string; category: string; status: string; sortOrder: number; plannedTimeMinutes: number | null }>;
  };
};
export type EmployeeActionReminder = { id: string; title: string; href: string; target: 'checklist' | 'attention' | 'cash_issue' | 'schedule' };

/** Uses unresolved source actions, never notification read state. */
export function employeeActionReminder(workday: ReminderWorkday | null, attention: EmployeeAttentionItem[] | null, now = new Date()): EmployeeActionReminder | null {
  const actions = orderEmployeeAttention(attention ?? []).filter(item => item.state === 'action');
  const schedule = actions.find(item => item.kind === 'schedule');
  const scheduleReminder: EmployeeActionReminder | null = schedule ? { id: schedule.id, title: schedule.title, href: schedule.scheduleAction==='week'?scheduleWeekHref(schedule.scheduleDate!,schedule.scheduleWeekStart):`/employee?attention=schedule&item=${encodeURIComponent(schedule.id)}`, target: schedule.scheduleAction==='week'?'schedule':'attention' } : null;
  const issue = actions.find(item => item.kind !== 'schedule');
  if (issue) return {
    id: issue.id, title: issue.kind === 'receipt' ? 'Проверьте чеки' : issue.kind === 'cash' ? 'Оформите расходники в 1С' : issue.title,
    href: issue.kind === 'cash_issue' ? `/employee?cashIssue=${encodeURIComponent(issue.id.slice('cash-issue:'.length))}` : `/employee?attention=${issue.kind}&item=${encodeURIComponent(issue.id)}`,
    target: issue.kind === 'cash_issue' ? 'cash_issue' : 'attention',
  };
  const today = getMoscowDateKey(now);
  if (!workday?.workDay || workday.workDay.date !== today || workday.workDay.endedAt || !['active', 'missing_checkout'].includes(workday.workDay.status)) return scheduleReminder;
  if (workday.unfinishedWorkDay && workday.unfinishedWorkDay.date < today) return scheduleReminder;
  const { run, tasks } = workday.shiftControl;
  if (!run || run.date !== today || run.status === 'completed' || run.completedAt) return scheduleReminder;
  const task = [...tasks].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id).find(task => task.status !== 'done' && (task.plannedTimeMinutes === null || getMoscowMinutes(now) >= task.plannedTimeMinutes));
  return task ? { id: `task:${task.id}`, title: task.category === 'cash' ? 'Введите остаток по кассе' : task.title, href: '/employee#pwa-current-action', target: 'checklist' } : scheduleReminder;
}
