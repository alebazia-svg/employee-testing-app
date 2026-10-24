import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveTeamAttendance, usesAppAttendance } from '../lib/team-attendance';
import { googleDay, teamStartControl, usesAppSchedule } from '../lib/team-control';

const google = { plan: 'working' as const, arrival: null, departure: null, shift: '', lateMinutes: 0, note: '', ambiguous: false };
const workDay = { startedAt: new Date('2026-10-24T05:59:00Z'), endedAt: null, status: 'active', shiftLabel: '09:00–18:00', lateMinutes: 0 };
const input = { date: '2026-10-24', today: '2026-10-24', google, googleAvailable: true, fallbackState: 'Ожидается начало' };

test('all employees use app marks from Oct 24, without changing past source or schedule policy', () => {
  assert.equal(usesAppAttendance('2026-10-23'), false);
  assert.equal(usesAppAttendance('2026-10-24'), true);
  assert.equal(usesAppAttendance('2026-10-25'), true);
  assert.equal(usesAppSchedule('Абшаева Зухра'), false);
});
test('Zukhra app start appears even with no Google mark', () => {
  const result = resolveTeamAttendance({ ...input, workDay });
  assert.equal(result.start, '08:59');
  assert.equal(result.startSource, 'app');
  assert.equal(result.sourceLabel, 'Приложение');
  assert.equal(result.state, 'Работает');
  assert.equal(result.late, 0);
});
test('Google start remains counted when there is no app day', () => {
  const result = resolveTeamAttendance({ ...input, google: { ...google, arrival: 661, shift: '11:00–20:00', lateMinutes: 1 } });
  assert.equal(result.start, '11:01');
  assert.equal(result.startSource, 'google');
  assert.equal(result.sourceLabel, 'Google · резерв');
  assert.equal(result.late, 1);
  assert.equal(result.state, 'Работает');
  assert.equal(result.active, false); // Never invent an application shift/checklist.
});
test('app wins duplicate marks and lateness even when Google has an earlier start', () => {
  const result = resolveTeamAttendance({ ...input, workDay: { ...workDay, startedAt: '2026-10-24T06:05:00Z', lateMinutes: 5 }, google: { ...google, arrival: 530, lateMinutes: 0 } });
  assert.equal(result.start, '09:05');
  assert.equal(result.late, 5);
});
test('each mark falls back independently with explicit provenance', () => {
  const mixed = resolveTeamAttendance({ ...input, workDay, google: { ...google, arrival: 550, departure: 1080 } });
  assert.equal(mixed.start, '08:59');
  assert.equal(mixed.end, '18:00');
  assert.equal(mixed.endSource, 'google');
  assert.equal(mixed.sourceLabel, 'Приложение + Google');
  assert.equal(mixed.active, false);
  assert.equal(mixed.state, 'Завершил · 18:00');
  assert.equal(workDay.status, 'active'); // Display fallback must not close persisted app state.
  const app = resolveTeamAttendance({ ...input, workDay: { ...workDay, endedAt: '2026-10-24T15:15:00Z' }, google: { ...google, departure: 1080 } });
  assert.equal(app.end, '18:15');
  assert.equal(app.endSource, 'app');
});
test('a Google checkout earlier than app start is not this shift completion', () => {
  const result = resolveTeamAttendance({ ...input, workDay, google: { ...google, departure: 500 } });
  assert.equal(result.end, '—');
  assert.equal(result.active, true);
});
test('Google-only completion and historical app-open state remain distinct', () => {
  assert.equal(resolveTeamAttendance({ ...input, google: { ...google, arrival: 540, departure: 1080 } }).state, 'Завершил · 18:00');
  assert.equal(resolveTeamAttendance({ ...input, today: '2026-10-25', workDay }).state, 'Не завершил смену');
  assert.equal(resolveTeamAttendance({ ...input, today: '2026-10-25', google: { ...google, arrival: 540 } }).state, 'Приход отмечен');
});
test('unavailable Google never erases app evidence or proves absence', () => {
  const app = resolveTeamAttendance({ ...input, workDay, googleAvailable: false, google: { ...google, departure: 1080 } });
  assert.equal(app.start, '08:59');
  assert.equal(app.end, '—');
  assert.equal(app.marksAvailable, true);
  const missing = resolveTeamAttendance({ ...input, googleAvailable: false, google: { ...google, arrival: 540 } });
  assert.equal(missing.start, '—');
  assert.equal(missing.marksAvailable, false);
  assert.equal(teamStartControl('working', false, missing.marksAvailable, input.date, input.today, 700, 540).missing, false);
});
test('technical completion without actual checkout is not displayed as still working', () => {
  const result = resolveTeamAttendance({ ...input, workDay: { ...workDay, status: 'completed' } });
  assert.equal(result.end, '—');
  assert.equal(result.state, 'Закрыта без времени завершения');
});
test('days off and vacation do not manufacture a start', () => {
  for (const fallbackState of ['Выходной', 'Отпуск']) {
    const result = resolveTeamAttendance({ ...input, fallbackState });
    assert.equal(result.start, '—');
    assert.equal(result.state, fallbackState);
  }
});
test('Google fallback respects identity and selected date', () => {
  const marks = [{ employee: 'Косторенко Магомед', date: '2026-10-23', timestamp: '', action: 'Начало рабочего дня', time: '11:01', shift: '11:00–20:00' }];
  assert.equal(resolveTeamAttendance({ ...input, google: googleDay('Костеренко Магомед', input.date, [], marks) }).start, '—');
  assert.equal(resolveTeamAttendance({ ...input, google: googleDay('Абшаева Зухра', '2026-10-23', [], marks) }).start, '—');
});
test('list and dialog consume the same resolved facts rather than choosing independent sources', () => {
  const page = readFileSync('app/(dashboard)/admin/workday/page.tsx', 'utf8');
  const detail = readFileSync('app/(dashboard)/admin/workday/AdminShiftControlDetails.tsx', 'utf8');
  assert.match(page, /const start = row\.attendance\?\.start/);
  assert.match(page, /state:row\.attendance\?\.state/);
  assert.match(page, /attendance=\{row\.attendance \?\? undefined\}/);
  assert.match(detail, /attendance\?\.start \?\? formatTime/);
  assert.match(detail, /attendance\?\.state \?\?/);
});
