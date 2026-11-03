import assert from 'node:assert/strict';
import test from 'node:test';
import {
  attachPayrollAttendanceSnapshotMeta,
  createPayrollAttendanceSnapshotPayload,
  getPayrollAttendanceSnapshotReplacementError,
  hasGooglePayrollAttendance,
  readPayrollAttendanceSnapshotPayload,
} from '../lib/payroll-attendance-snapshot';

const payload = createPayrollAttendanceSnapshotPayload({
  period: { monthIndex: 8, year: 2026, periodKey: '2026-09' },
  attendanceMode: 'google-sheets',
  attendanceMessage: 'Данные загружены.',
  scheduleMode: 'google-sheets',
  scheduleMessage: 'График загружен.',
  formSummaries: [{ employee: 'Сотрудник', formRows: 8, uniqueFormDates: 4, workedDays: 4, lateCount: 1 }],
  scheduleSummaries: [{ employee: 'Сотрудник', scheduleDays: 5 }],
});

test('attendance snapshot is accepted only for its exact payroll period', () => {
  assert.deepEqual(readPayrollAttendanceSnapshotPayload(payload, '2026-09'), payload);
  assert.equal(readPayrollAttendanceSnapshotPayload(payload, '2026-08'), null);
});

test('attendance snapshot rejects malformed payroll values', () => {
  assert.equal(readPayrollAttendanceSnapshotPayload({
    ...payload,
    formSummaries: [{ ...payload.formSummaries[0], lateCount: -1 }],
  }, '2026-09'), null);
});

test('response metadata explains whether data is stored and why refresh failed', () => {
  const response = attachPayrollAttendanceSnapshotMeta(payload, {
    servedFrom: 'stored',
    sourceCheckedAt: '2026-09-09T08:00:00.000Z',
    savedAt: '2026-09-09T08:00:01.000Z',
    refreshError: 'Google Sheets unavailable',
  });

  assert.equal(response.snapshot.servedFrom, 'stored');
  assert.equal(response.snapshot.refreshError, 'Google Sheets unavailable');
  assert.equal('version' in response, false);
});

test('last-good snapshot is not replaced by disconnected or unexpectedly empty sources', () => {
  assert.equal(getPayrollAttendanceSnapshotReplacementError(payload, null), null);
  assert.match(getPayrollAttendanceSnapshotReplacementError({ ...payload, scheduleMode: 'not-configured' }, payload) ?? '', /не подключён/);
  assert.match(getPayrollAttendanceSnapshotReplacementError({ ...payload, formSummaries: [] }, payload) ?? '', /пустую посещаемость/);
  assert.match(getPayrollAttendanceSnapshotReplacementError({ ...payload, scheduleSummaries: [] }, payload) ?? '', /пустой график/);
});

test('mixed attendance snapshot keeps source dates and supports legacy snapshots', () => {
  const mixed = createPayrollAttendanceSnapshotPayload({
    ...payload,
    period: { monthIndex: 9, year: 2026, periodKey: '2026-10' },
    attendanceMode: 'google-sheets+pwa',
    attendanceSources: [{ employee: 'Хурзокова Лиана', userId: 8, fromDate: '2026-10-18', appDates: ['2026-10-18'], googleFallbackDates: ['2026-10-19'], overlapDates: ['2026-10-18'] }],
  });
  assert.deepEqual(readPayrollAttendanceSnapshotPayload(mixed, '2026-10'), mixed);
  assert.equal(getPayrollAttendanceSnapshotReplacementError(mixed, payload), null);
  assert.equal(readPayrollAttendanceSnapshotPayload({ ...mixed, attendanceSources: undefined }, '2026-10'), null);
  assert.equal(readPayrollAttendanceSnapshotPayload({ ...mixed, attendanceSources: [{ ...mixed.attendanceSources![0], googleFallbackDates: ['2026-10-18'] }] }, '2026-10'), null);
  assert.equal(readPayrollAttendanceSnapshotPayload({ ...mixed, attendanceSources: [{ ...mixed.attendanceSources![0], appDates: ['2026-11-01'] }] }, '2026-10'), null);
});

test('Google disappearance protection distinguishes actual Google evidence from PWA and owner-only dates',()=>{
 const p={...payload,attendanceMode:'google-sheets+pwa' as const,formSummaries:[{employee:'Сотрудник',formRows:2,uniqueFormDates:2,workedDays:2,lateCount:0}],attendanceSources:[{employee:'Сотрудник',userId:8,fromDate:'2026-09-01',appDates:['2026-09-02'],ownerConfirmedDates:['2026-09-01'],googleFallbackDates:[],overlapDates:[]}]};
 assert.equal(hasGooglePayrollAttendance(p),false);assert.equal(hasGooglePayrollAttendance(null),false);assert.equal(hasGooglePayrollAttendance(payload),true);
 for(const patch of [{googleFallbackDates:['2026-09-03']},{overlapDates:['2026-09-02']}])assert.equal(hasGooglePayrollAttendance({...p,attendanceSources:[{...p.attendanceSources[0],...patch}]}),true);
 for(const patch of [{uniqueFormDates:3},{formRows:3},{lateCount:1}])assert.equal(hasGooglePayrollAttendance({...p,formSummaries:[{...p.formSummaries[0],...patch}]}),true);
 assert.equal(hasGooglePayrollAttendance({...p,attendanceSources:[]}),true,'legacy Google sources remain protected');
});
