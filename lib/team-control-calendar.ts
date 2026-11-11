import { resolveCalendarFact } from './team-calendar-fact';

// Day accounting does not complete, hide or rewrite an actual app shift.
// The saved plan remains a separate field in both the list and employee card.
export function resolveControlCalendarDay(input: Parameters<typeof resolveCalendarFact>[0] & { hasWorkDay: boolean }) {
  const fact = resolveCalendarFact(input);
  const settled = fact.factual && !input.hasWorkDay;
  const state = !settled ? null : fact.state === 'off' ? 'Выходной'
    : fact.state === 'working' ? 'Рабочий день'
    : fact.state === 'vacation' ? 'Отпуск' : null;
  const sourceLabel = fact.factual && (!input.hasWorkDay || input.qrAccepted || fact.source === 'Исправлено администратором')
    ? fact.source === 'Автоматически' ? 'Автоматически — без QR' : fact.source === 'Приложение' ? 'План из приложения' : fact.source
    : !input.hasWorkDay && input.source === 'Приложение' ? 'План из приложения' : undefined;
  const stateNote = settled && fact.state === 'off' && fact.source === 'Автоматически'
    ? 'Выходной учтён автоматически: нет QR-отметки начала смены' : undefined;
  return { fact, sourceLabel, stateNote, startNote: undefined, settled: settled && state !== null, state,
    calendarState: settled && ['working', 'off', 'vacation'].includes(fact.state) ? fact.state : undefined };
}
