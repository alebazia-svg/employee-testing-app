import type { ScheduleRow } from './google-sheets';
import { buildScheduleSummaries } from './payroll-attendance-summary';
import { getMoscowDateKey } from './workday';

export const DIANA_DAY_SOURCE_FROM = '2026-10-01';
export const DIANA_DAY_SOURCE_NAME = 'Кумахова Диана';
const normalize = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ');
const aliases = new Set(['диана', 'кумахова диана']);
type AppUser = { id: number; name: string; payrollName: string | null; workDays: { userId: number; date: string; startedAt: Date; status: string }[] };
function dateKey(value: string) {
  const ru = value.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  const key = ru ? `${ru[3]}-${ru[2].padStart(2, '0')}-${ru[1].padStart(2, '0')}` : value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !Number.isFinite(Date.parse(key)) || new Date(key).toISOString().slice(0, 10) !== key) throw new Error('Некорректная дата графика Дианы.');
  return key;
}
/** Only actual app starts and Google schedule cells; the editable PWA plan is not attendance. */
export function mergeDianaPayrollDays(input: { googleRows: ScheduleRow[]; appUsers: AppUser[]; periodKey: string; throughDate: string }) {
  const summaries = buildScheduleSummaries(input.googleRows, input.periodKey);
  if (input.periodKey < DIANA_DAY_SOURCE_FROM.slice(0, 7)) return { summaries, message: '' };
  if (input.appUsers.length !== 1 || normalize(input.appUsers[0].payrollName || input.appUsers[0].name) !== normalize(DIANA_DAY_SOURCE_NAME)) throw new Error('Не удалось однозначно подтвердить Диану для учёта рабочих дней.');
  const user = input.appUsers[0];
  const googleDays = new Map<string, boolean | null>();
  for (const row of input.googleRows.filter(row => aliases.has(normalize(row.employee)))) {
    const date = dateKey(row.date);
    if (!date.startsWith(input.periodKey + '-') || date > input.throughDate) continue;
    if (googleDays.has(date) && googleDays.get(date) !== row.plannedWork) throw new Error('Противоречивый график Дианы.');
    googleDays.set(date, row.plannedWork);
  }
  if (!googleDays.size) throw new Error('В Google отсутствует график Дианы за выбранный месяц.');
  const appDates = new Set<string>();
  for (const day of user.workDays) {
    if (day.date < DIANA_DAY_SOURCE_FROM || !day.date.startsWith(input.periodKey + '-') || day.date > input.throughDate) continue;
    if (day.userId !== user.id || !['active', 'completed'].includes(day.status) || !Number.isFinite(day.startedAt.getTime()) || getMoscowDateKey(day.startedAt) !== day.date || appDates.has(day.date)) throw new Error('Проверьте отметки рабочего дня Дианы.');
    appDates.add(day.date);
  }
  const fallbackDates = [...googleDays].filter(([date, working]) => working === true && !appDates.has(date)).map(([date]) => date).sort();
  const countedDates = new Set([...appDates, ...fallbackDates]);
  return {
    summaries: [...summaries.filter(row => !aliases.has(normalize(row.employee))), { employee: DIANA_DAY_SOURCE_NAME, scheduleDays: countedDates.size }].sort((a,b) => a.employee.localeCompare(b.employee, 'ru')),
    message: `Диана: отметки приложения — ${[...appDates].sort().join(', ') || 'нет'}; резерв из графика Google — ${fallbackDates.join(', ') || 'нет'}.`,
  };
}
