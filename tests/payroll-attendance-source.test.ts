import assert from 'node:assert/strict';
import test from 'node:test';
import type { AttendanceRow } from '../lib/google-sheets';
import { mergePayrollAttendanceSources } from '../lib/payroll-attendance-source';
import { buildFormSummaries } from '../lib/payroll-attendance-summary';

const employee = 'Хурзокова Лиана';
const mark = (date: string, name = employee, time = '08:50'): AttendanceRow => ({
  employee: name, date, timestamp: `${date.slice(8)}.${date.slice(5,7)}.${date.slice(0,4)} ${time}:00`,
  time, action: 'Начало рабочего дня', shift: '09:00–19:00', comment: '',
});
const day = (date: string, status = 'completed') => ({ userId: 8, date, status, startedAt: new Date(`${date}T08:46:00+03:00`) });
function merge(rows: AttendanceRow[], days = [day('2026-10-18'), day('2026-10-19', 'active')], periodKey = '2026-10') {
  return mergePayrollAttendanceSources({ googleRows: rows, appUsers: [{ id: 8, name: employee, payrollName: employee, workDays: days }], periodKey, throughDate: '2026-10-31' });
}

test('cutover preserves 16 October Google arrival; overlap counts once; open PWA day counts as arrival', () => {
  const result = merge([mark('2026-10-16'), mark('2026-10-18')], [day('2026-10-16'), day('2026-10-18'), day('2026-10-19', 'active')]);
  assert.equal(result.formSummaries[0].uniqueFormDates, 3);
  assert.equal(result.formSummaries[0].lateCount, 0);
  assert.deepEqual(result.sources[0].appDates, ['2026-10-18', '2026-10-19']);
  assert.deepEqual(result.sources[0].overlapDates, ['2026-10-18']);
});

test('Google is the fallback for missing app dates, including a full app outage', () => {
  const rows = [mark('2026-10-18'), mark('2026-10-19'), mark('2026-10-20')];
  const result = merge(rows);
  assert.equal(result.formSummaries[0].uniqueFormDates, 3);
  assert.deepEqual(result.sources[0].googleFallbackDates, ['2026-10-20']);
  assert.deepEqual(merge(rows, []).sources[0].googleFallbackDates, ['2026-10-18', '2026-10-19', '2026-10-20']);
});

test('late app synchronization replaces Google without increasing days; repeated refresh is idempotent', () => {
  const rows = [mark('2026-10-20'), mark('2026-10-20', ' Лиана '), mark('2026-10-20', 'Ляна')];
  const before = merge(rows, []);
  const after = merge(rows, [day('2026-10-20')]);
  assert.equal(before.formSummaries[0].uniqueFormDates, 1);
  assert.equal(after.formSummaries[0].uniqueFormDates, 1);
  assert.deepEqual(after.sources[0].googleFallbackDates, []);
  assert.deepEqual(after.sources[0].overlapDates, ['2026-10-20']);
  assert.deepEqual(merge(rows, [day('2026-10-20')]), after);
});

test('only approved employee changes; previous months stay byte-equivalent to Google summary', () => {
  const rows = [mark('2026-10-18'), mark('2026-10-19', 'Другой сотрудник', '09:15')];
  const actual = merge(rows).formSummaries.find((row) => row.employee === 'Другой сотрудник');
  assert.deepEqual(actual, buildFormSummaries(rows, '2026-10').find((row) => row.employee === 'Другой сотрудник'));
  const history = [mark('2026-07-08')];
  const result = mergePayrollAttendanceSources({ googleRows: history, appUsers: [], periodKey: '2026-07', throughDate: '2026-07-31' });
  assert.deepEqual(result.formSummaries, buildFormSummaries(history, '2026-07'));
  assert.deepEqual(result.sources, []);
});

test('PWA times do not introduce penalties or erase existing Google lateness', () => {
  const appDay = { ...day('2026-10-18'), startedAt: new Date('2026-10-18T17:00:00+03:00') };
  assert.equal(merge([mark('2026-10-18')], [appDay]).formSummaries[0].lateCount, 0);
  assert.equal(merge([mark('2026-10-18', employee, '09:20')], [appDay]).formSummaries[0].lateCount, 1);
});

test('Moscow calendar boundary, later months and future rows are scoped correctly', () => {
  const input = { googleRows: [mark('2026-11-01'), mark('2026-11-02')], appUsers: [{ id: 8, name: employee, payrollName: employee, workDays: [{ ...day('2026-11-01'), startedAt: new Date('2026-10-31T21:01:00Z') }, day('2026-11-02')] }], periodKey: '2026-11', throughDate: '2026-11-01' };
  const result = mergePayrollAttendanceSources(input);
  assert.equal(result.formSummaries[0].uniqueFormDates, 1);
  assert.deepEqual(result.sources[0].appDates, ['2026-11-01']);
});

test('missing/wrong identity and corrupt application data fail instead of producing partial salary days', () => {
  assert.throws(() => mergePayrollAttendanceSources({ googleRows: [], appUsers: [], periodKey: '2026-10', throughDate: '2026-10-19' }), /подтвердить/);
  for (const days of [[day('2026-10-18'), day('2026-10-18')], [{ ...day('2026-10-18'), userId: 9 }], [{ ...day('2026-10-18'), startedAt: new Date('invalid') }], [day('2026-10-18', 'cancelled')]]) {
    assert.throws(() => merge([], days), /Проверьте/);
  }
});

test('departure marks and repeated Google submissions do not add extra salary days', () => {
  const arrival = mark('2026-10-20');
  const result = merge([arrival, arrival, { ...arrival, action: 'Окончание рабочего дня', time: '19:00' }], []);
  assert.equal(result.formSummaries[0].uniqueFormDates, 1);
  assert.equal(result.formSummaries[0].workedDays, 1);
});
