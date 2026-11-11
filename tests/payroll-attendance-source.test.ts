import assert from 'node:assert/strict';
import test from 'node:test';
import type { AttendanceRow } from '../lib/google-sheets';
import { mergePayrollAttendanceSources, PAYROLL_APP_ATTENDANCE_CUTOVERS } from '../lib/payroll-attendance-source';
import { buildReviewDaySources } from '../lib/payroll-day-review-sources';
import { applyAutomaticAttendanceInputs } from '../lib/payroll-calculation-engine';
import { buildFormSummaries } from '../lib/payroll-attendance-summary';

const cutovers = [PAYROLL_APP_ATTENDANCE_CUTOVERS[0]];
const employee = 'Хурзокова Лиана';
const mark = (date: string, name = employee, time = '08:50'): AttendanceRow => ({
  employee: name, date, timestamp: `${date.slice(8)}.${date.slice(5,7)}.${date.slice(0,4)} ${time}:00`,
  time, action: 'Начало рабочего дня', shift: '09:00–19:00', comment: '',
});
const day = (date: string, status = 'completed') => ({ userId: 8, date, status, startedAt: new Date(`${date}T08:46:00+03:00`) });
function merge(rows: AttendanceRow[], days = [day('2026-10-18'), day('2026-10-19', 'active')], periodKey = '2026-10') {
  return mergePayrollAttendanceSources({ googleRows: rows, appUsers: [{ id: 8, name: employee, payrollName: employee, workDays: days }], periodKey, throughDate: '2026-10-31', cutovers });
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
  const input = { googleRows: [mark('2026-11-01'), mark('2026-11-02')], appUsers: [{ id: 8, name: employee, payrollName: employee, workDays: [{ ...day('2026-11-01'), startedAt: new Date('2026-10-31T21:01:00Z') }, day('2026-11-02')] }], periodKey: '2026-11', throughDate: '2026-11-01', cutovers };
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

// October audit regression: real source dates, no money or financial mutations.
const octoberCases = [
  {
    "id": 3,
    "employee": "Чеченова Милана",
    "googleName": "Чеченова Милана",
    "google": [
      "2026-10-01",
      "2026-10-03",
      "2026-10-04",
      "2026-10-05",
      "2026-10-07",
      "2026-10-08",
      "2026-10-11",
      "2026-10-12",
      "2026-10-13",
      "2026-10-14",
      "2026-10-15",
      "2026-10-19",
      "2026-10-20",
      "2026-10-21",
      "2026-10-22",
      "2026-10-23"
    ],
    "app": [
      "2026-10-05",
      "2026-10-07",
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29"
    ],
    "expected": 20
  },
  {
    "id": 4,
    "employee": "Абшаева Зухра",
    "googleName": "Абшаева Зухра",
    "google": [
      "2026-10-02",
      "2026-10-03",
      "2026-10-05",
      "2026-10-06",
      "2026-10-10",
      "2026-10-11",
      "2026-10-12",
      "2026-10-16",
      "2026-10-17",
      "2026-10-18",
      "2026-10-19",
      "2026-10-20"
    ],
    "app": [
      "2026-10-06",
      "2026-10-16",
      "2026-10-24",
      "2026-10-25",
      "2026-10-26",
      "2026-10-27",
      "2026-10-30",
      "2026-10-31"
    ],
    "expected": 18
  },
  {
    "id": 7,
    "employee": "Ахобекова Залина",
    "googleName": "Ахобекова Залина",
    "google": [
      "2026-10-03",
      "2026-10-04",
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
      "2026-10-10",
      "2026-10-11",
      "2026-10-12",
      "2026-10-13",
      "2026-10-14",
      "2026-10-17"
    ],
    "app": [
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-31"
    ],
    "expected": 15
  },
  {
    "id": 5,
    "employee": "Костеренко Магомед",
    "googleName": "Магомед",
    "google": [
      "2026-10-01",
      "2026-10-02",
      "2026-10-04",
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
      "2026-10-09",
      "2026-10-10",
      "2026-10-14",
      "2026-10-15",
      "2026-10-16",
      "2026-10-17",
      "2026-10-18",
      "2026-10-21",
      "2026-10-22",
      "2026-10-23",
      "2026-10-24",
      "2026-10-25"
    ],
    "app": [
      "2026-10-06",
      "2026-10-24",
      "2026-10-25",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31"
    ],
    "expected": 22
  },
  {
    "id": 8,
    "employee": "Хурзокова Лиана",
    "googleName": "Хурзокова Лиана",
    "google": [
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
      "2026-10-09",
      "2026-10-10",
      "2026-10-13",
      "2026-10-14",
      "2026-10-15",
      "2026-10-16",
      "2026-10-18"
    ],
    "app": [
      "2026-10-16",
      "2026-10-18",
      "2026-10-19",
      "2026-10-20",
      "2026-10-21",
      "2026-10-22",
      "2026-10-23",
      "2026-10-24",
      "2026-10-25",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31"
    ],
    "expected": 25
  }
];

test('approved five-person union restores all 18 missing October dates without doubling overlaps', () => {
  const googleRows = octoberCases.flatMap(c => c.google.map(d => mark(d, c.googleName)));
  const appUsers = octoberCases.map(c => ({ id: c.id, name: c.employee, payrollName: c.employee,
    workDays: c.app.map(d => ({ ...day(d), userId: c.id })) }));
  const input = { googleRows, appUsers, periodKey: '2026-10', throughDate: '2026-10-31' };
  const result = mergePayrollAttendanceSources(input);
  assert.equal(result.sources.length, 5);
  for (const c of octoberCases) {
    const matches = result.formSummaries.filter(r => r.employee === c.employee);
    assert.equal(matches.length, 1, c.employee);
    assert.equal(matches[0].uniqueFormDates, c.expected, c.employee);
    assert.equal(matches[0].workedDays, c.expected, c.employee);
    const source = result.sources.find(r => r.userId === c.id)!;
    assert.deepEqual(source.appDates, c.app.filter(d => d >= '2026-10-18'));
    assert.deepEqual(source.overlapDates, c.app.filter(d => d >= '2026-10-18' && c.google.includes(d)));
  }
  const provenance = buildReviewDaySources({ periodKey: input.periodKey, through: input.throughDate,
    users: appUsers.map(u => ({ ...u, role: 'EMPLOYEE', isActive: true, portalArea: 'WORKDAY' })),
    googleRows, formSummaries: result.formSummaries, appSources: result.sources, dianaDates: [] });
  const preview = { period: { periodKey: '2026-10', monthIndex: 9, year: 2026 },
    attendanceMode: 'google-sheets+pwa' as const, attendanceMessage: '', scheduleMode: 'google-sheets' as const,
    scheduleMessage: '', formSummaries: result.formSummaries, scheduleSummaries: [],
    snapshot: { servedFrom: 'refreshed' as const, sourceCheckedAt: '2026-10-31T18:07:36.740Z', savedAt: '2026-10-31T18:07:36.740Z' } };
  const inputs = applyAutomaticAttendanceInputs(octoberCases.map(c => c.employee), {}, preview, input.periodKey);
  for (const c of octoberCases) {
    assert.equal(provenance.find(p => p.userId === c.id)?.dates.length, c.expected, c.employee);
    assert.equal(inputs[c.employee].workedDays, String(c.expected), c.employee);
  }
  const manual = { workedDays: '9', lateCount: '2', advance: '750', comment: 'Confirmed correction', source: 'manualCorrection' as const };
  assert.deepEqual(applyAutomaticAttendanceInputs([octoberCases[0].employee], { [octoberCases[0].employee]: manual }, preview, input.periodKey)[octoberCases[0].employee], manual);
  assert.deepEqual(mergePayrollAttendanceSources(input), result);
});

test('new cutovers retain pre-pilot Google days and lateness, reject wrong identities, and leave other staff unchanged', () => {
  for (const rule of PAYROLL_APP_ATTENDANCE_CUTOVERS.slice(1).filter(rule => rule.fromDate === '2026-10-18')) {
    const ownDay = (date: string) => ({ ...day(date), userId: rule.userId });
    const user = { id: rule.userId, name: rule.employee, payrollName: rule.employee,
      workDays: [ownDay('2026-10-16'), ownDay('2026-10-18'), ownDay('2026-10-19')] };
    const rows = [mark('2026-10-15', rule.employee, '09:20'), mark('2026-10-18', rule.aliases[1]),
      mark('2026-10-18', rule.employee), mark('2026-10-20', rule.employee), mark('2026-10-18', 'Другой сотрудник')];
    const input = { googleRows: rows, appUsers: [user], cutovers: [rule], periodKey: '2026-10', throughDate: '2026-10-31' };
    const result = mergePayrollAttendanceSources(input);
    const own = result.formSummaries.find(r => r.employee === rule.employee)!;
    assert.equal(own.uniqueFormDates, 4); // Google15, overlap18, app19, fallback20; app16 stays before cutover.
    assert.equal(own.lateCount, 1);
    assert.deepEqual(result.formSummaries.find(r => r.employee === 'Другой сотрудник'),
      buildFormSummaries(rows, '2026-10').find(r => r.employee === 'Другой сотрудник'));
    assert.throws(() => mergePayrollAttendanceSources({ ...input, appUsers: [{ ...user, payrollName: 'Другая личность' }] }), /подтвердить/);
    assert.throws(() => mergePayrollAttendanceSources({ ...input, appUsers: [] }), /подтвердить/);
  }
});
