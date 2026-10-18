import { attendanceEmployeeKey } from '@/lib/attendance-identity';

// Owner-approved rollout: Google remains active; only Liana uses the app pilot.
// This is presentation policy, never an import or a change to saved schedules.
export function usesAppSchedule(name: string) {
  return attendanceEmployeeKey(name) === attendanceEmployeeKey('Хурзокова Лиана');
}
export function dateKeyFromGoogle(value: string) {
  const ru = value.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (ru) return `${ru[3]}-${ru[2].padStart(2, '0')}-${ru[1].padStart(2, '0')}`;
  return /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : '';
}
export function clockMinutes(value: string) {
  const m = value.match(/(\d{1,2}):(\d{2})/);
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}
export function clockLabel(value: number | null) {
  return value === null ? '—' : `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}
export type TeamGoogleDay = { plan: 'working' | 'off' | null; arrival: number | null; departure: number | null; shift: string; lateMinutes: number; note: string; ambiguous: boolean };
export function googleDay(name: string, date: string, schedules: Array<{ employee: string; date: string; plannedWork: boolean | null; scheduleNote: string }>, marks: Array<{employee: string; date: string; timestamp: string; action: string; time: string; shift: string}>) : TeamGoogleDay {
  const match = (r: {employee: string; date: string}) => attendanceEmployeeKey(r.employee) === attendanceEmployeeKey(name) && dateKeyFromGoogle(r.date) === date;
  const plans = schedules.filter(match);
  const values = new Set(plans.map(r => r.plannedWork).filter(v => v !== null));
  const rows = marks.filter(r => match({...r, date: r.date || r.timestamp}));
  const arrivals = rows.filter(r => /начало|приход/i.test(r.action)).map(r => clockMinutes(r.time || r.timestamp)).filter((v): v is number => v !== null);
  const departures = rows.filter(r => /окончание|уход/i.test(r.action)).map(r => clockMinutes(r.time || r.timestamp)).filter((v): v is number => v !== null);
  const arrival = arrivals.length ? Math.min(...arrivals) : null;
  const departure = departures.length ? Math.max(...departures) : null;
  const shifts = new Set(rows.map(r=>r.shift.trim()).filter(Boolean));
  const shift = shifts.size === 1 ? [...shifts][0] : '';
  const start = clockMinutes(shift);
  return { plan: values.size === 1 ? ([...values][0] ? 'working' : 'off') : null, arrival, departure, shift, lateMinutes: start !== null && arrival !== null ? Math.max(0, arrival-start) : 0, note: plans.map(r=>r.scheduleNote).filter(Boolean).join('; '), ambiguous: values.size > 1 || shifts.size > 1 };
}
export function taskTimingLabel(planned: number | null, completedAt: string | null, date: string, overdueMinutes?: number | null) {
  if (planned === null) return { text: 'Без срока', tone: 'neutral' };
  if (!completedAt) return overdueMinutes !== undefined && overdueMinutes !== null ? {text:`Просрочено на ${overdueMinutes} мин`,tone:'amber'} : {text:'Не выполнено',tone:'neutral'};
  const p = new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(completedAt));
  const v = Object.fromEntries(p.map(x=>[x.type,x.value]));
  const days = (Date.parse(`${v.year}-${v.month}-${v.day}T00:00:00Z`)-Date.parse(`${date}T00:00:00Z`))/86400000;
  const late = days*1440+Number(v.hour)*60+Number(v.minute)-planned;
  return late > 0 ? {text:`Позже на ${late} мин`,tone:'amber'} : {text:'В срок',tone:'green'};
}

// A missing mark is an exception only after a known shift start (or a past day).
export function teamStartControl(plan: string, hasStart: boolean, marksAvailable: boolean, date: string, today: string, now: number, plannedStart: number | null) {
  const eligible = plan === 'working' && !hasStart && marksAvailable && date <= today;
  return { missing: eligible && (date < today || plannedStart !== null && now > plannedStart), unknownTime: eligible && date === today && plannedStart === null };
}
export function teamOperationAlerts(requests: Array<{status:string}>, operations: Array<{status:string}>) {
  const pending = requests.filter(r => r.status === 'pending').length;
  const failed = operations.filter(o => ['one_c_error','manual_in_progress','retrying_1c'].includes(o.status)).length;
  const waiting = operations.filter(o => o.status !== 'posted_1c_pair' && !['one_c_error','manual_in_progress','retrying_1c'].includes(o.status)).length;
  return [pending ? `Запросов на завершение: ${pending}` : '', failed ? `Инкассаций без подтверждения 1С: ${failed}` : '', waiting ? `Инкассаций в обработке: ${waiting}` : ''].filter(Boolean);
}
