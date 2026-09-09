import assert from 'node:assert/strict';
import test from 'node:test';
import {
  attachPayrollAttendanceSnapshotMeta,
  createPayrollAttendanceSnapshotPayload,
  getPayrollAttendanceSnapshotReplacementError,
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
