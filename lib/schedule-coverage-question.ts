import { scheduleCoverage, schedulePersonName } from './work-schedule-coverage';
import { isValidScheduleDateKey } from './workday-schedule';

export const SCHEDULE_COVERAGE_SOURCE = 'work_schedule_coverage';
export function scheduleCoverageRef(ref: string) {
  const [department, date, extra] = ref.split(':');
  return !extra && ['retail','wholesale'].includes(department) && isValidScheduleDateKey(date ?? '') ? {department,date} : null;
}
export function scheduleQuestionDates(now: Date) {
  const local = new Date(+now + 3 * 3600000), today = local.toISOString().slice(0,10);
  const minutes = local.getUTCHours() * 60 + local.getUTCMinutes();
  return [...(minutes >= 510 ? [today] : []), ...(minutes >= 1080 ? [new Date(Date.parse(`${today}T12:00:00Z`) + 86400000).toISOString().slice(0,10)] : [])];
}
export function scheduleCoverageQuestion(input: {
  department: string; date: string; today: string;
  employees: Array<{id:number;name:string}>;
  entries: Array<{userId:number;status:string}>;
  vacations: Array<{userId:number;dateFrom:string;dateTo:string}>;
}) {
  const people = input.employees.filter(p => !input.vacations.some(v => v.userId === p.id && v.dateFrom <= input.date && v.dateTo >= input.date));
  const working = people.filter(p => input.entries.some(e => e.userId === p.id && e.status === 'working'));
  const missing = people.filter(p => !input.entries.some(e => e.userId === p.id));
  const coverage = scheduleCoverage(input.department, working.length);
  const tomorrow = new Date(Date.parse(`${input.today}T12:00:00Z`) + 86400000).toISOString().slice(0,10);
  const active = input.employees.length > 0 && input.date >= input.today && input.date <= tomorrow && missing.length === 0 && coverage.needsReplacement;
  const department = input.department === 'retail' ? 'Розница' : 'Опт';
  const date = new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',day:'numeric',month:'long'}).format(new Date(`${input.date}T12:00:00+03:00`));
  const title = `${department} · ${date}: ${working.length === 0 ? (missing.length ? 'нет запланированного выхода' : 'никто не работает по графику') : 'один сотрудник — нужна ли подмена?'}`;
  const body = input.employees.map(p => {
    const vacation = input.vacations.some(v=>v.userId===p.id&&v.dateFrom<=input.date&&v.dateTo>=input.date);
    const status = input.entries.find(e => e.userId === p.id)?.status;
    return `${schedulePersonName(p.name)} — ${vacation ? 'отпуск' : status === 'working' ? 'работает по графику' : status === 'off' ? 'выходной' : 'график не заполнен'}`;
  }).join('; ') + (working.length === 0 ? (missing.length ? '. Сначала отметьте рабочие дни или выходные.' : '. Уточните, кто сможет выйти.') : '. Для розницы обычно нужны двое. Это вопрос о подмене, а не ошибка сотрудника.');
  return {active,title,body,missingIds:missing.map(p=>p.id),workingCount:working.length};
}

/** Future calendar pushes wait until the previous evening, never a month at once. */
export function schedulePushAt(date: string, now: Date) {
  const previousEvening = new Date(Date.parse(`${date}T18:00:00+03:00`) - 86400000);
  return new Date(Math.max(+now, +previousEvening));
}
