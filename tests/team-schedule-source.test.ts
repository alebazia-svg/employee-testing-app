import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveTeamSchedule } from '../lib/team-control';
import { resolveTeamAttendance } from '../lib/team-attendance';

const input = { name: 'Ахобекова Залина', googlePlan: null, googleAvailable: true, vacation: false };

test('saved working and off days win for every manager, including contradictory or missing Google plans', () => {
  for (const name of ['Ахобекова Залина', 'Абшаева Зухра', 'Костеренко Магомед', 'Чеченова Милана', 'Хурзокова Лиана']) {
    for (const appStatus of ['working', 'off'] as const) {
      for (const googlePlan of ['working', 'off', null] as const) {
        for (const googleAvailable of [false, true]) {
          const plan = resolveTeamSchedule({ ...input, name, appStatus, googlePlan, googleAvailable });
          assert.equal(plan.state, appStatus);
          assert.equal(plan.status, appStatus);
          assert.equal(plan.source, 'Приложение');
          assert.equal(plan.label, appStatus === 'off' ? 'Выходной' : 'Рабочий день');
        }
      }
    }
  }
});

test('Google remains the reserve for a date without an app record; other dates do not enroll it', () => {
  const days = new Map([['2026-10-29', 'off']]);
  const today = resolveTeamSchedule({ ...input, appStatus: days.get('2026-10-29'), googlePlan: 'working' });
  const tomorrow = resolveTeamSchedule({ ...input, appStatus: days.get('2026-10-30'), googlePlan: 'working' });
  assert.equal(today.state, 'off');
  assert.equal(tomorrow.state, 'working');
  assert.equal(tomorrow.source, 'Google');
});

test('an empty or invalid record never becomes a working day or a day off', () => {
  for (const appStatus of [undefined, null, '', 'unset', 'unknown']) {
    const missing = resolveTeamSchedule({ ...input, appStatus });
    assert.equal(missing.state, 'unknown');
    assert.equal(missing.status, undefined);
    assert.equal(missing.label, 'Нет записи графика Google');
    const unavailable = resolveTeamSchedule({ ...input, appStatus, googleAvailable: false, googlePlan: 'working' });
    assert.equal(unavailable.state, 'unavailable');
    assert.equal(unavailable.status, undefined);
  }
});

test('the original app-only pilot does not fall back to a conflicting Google plan on an empty date', () => {
  const plan = resolveTeamSchedule({ ...input, name: 'Ляна', googlePlan: 'working' });
  assert.equal(plan.state, 'unknown');
  assert.equal(plan.source, 'Приложение');
});

test('active vacation wins both plans, without changing their saved values', () => {
  const saved = { ...input, appStatus: 'working', googlePlan: 'working' as const, vacation: true };
  const plan = resolveTeamSchedule(saved);
  assert.equal(plan.state, 'vacation');
  assert.equal(plan.status, 'off');
  assert.equal(plan.label, 'Отпуск');
  assert.equal(saved.appStatus, 'working');
});

test('fact of app attendance stays separate from an empty or contradictory schedule', () => {
  for (const appStatus of [undefined, 'off', 'working']) {
    const plan = resolveTeamSchedule({ ...input, appStatus });
    const attendance = resolveTeamAttendance({
      date: '2026-10-29', today: '2026-10-29', googleAvailable: false,
      google: { plan: null, arrival: null, departure: null, shift: '', lateMinutes: 0, note: '', ambiguous: false },
      fallbackState: plan.label,
      workDay: { startedAt: '2026-10-29T06:00:00Z', endedAt: null, status: 'active', shiftLabel: '09:00–18:00', lateMinutes: 0 },
    });
    assert.equal(attendance.state, 'Работает');
    assert.equal(attendance.start, '09:00');
    assert.equal(plan.state, appStatus ?? 'unknown');
  }
});

test('a direct saved edit immediately changes the resolved plan without waiting for Google refresh', () => {
  const google = { ...input, googlePlan: 'working' as const };
  assert.equal(resolveTeamSchedule({ ...google, appStatus: 'working' }).state, 'working');
  assert.equal(resolveTeamSchedule({ ...google, appStatus: 'off' }).state, 'off');
});
