export const PAYROLL_ATTENDANCE_SNAPSHOT_VERSION = 1;

export type PayrollAttendanceFormSummary = {
  employee: string;
  formRows: number;
  uniqueFormDates: number;
  workedDays: number;
  lateCount: number;
};

export type PayrollAttendanceScheduleSummary = {
  employee: string;
  scheduleDays: number;
};

export type PayrollAttendanceSnapshotPayload = {
  version: typeof PAYROLL_ATTENDANCE_SNAPSHOT_VERSION;
  period: {
    monthIndex: number;
    year: number;
    periodKey: string;
  };
  attendanceMode: 'demo' | 'google-sheets';
  attendanceMessage: string;
  scheduleMode: 'not-configured' | 'google-sheets';
  scheduleMessage: string;
  formSummaries: PayrollAttendanceFormSummary[];
  scheduleSummaries: PayrollAttendanceScheduleSummary[];
};

export type PayrollAttendanceSnapshotResponse = Omit<PayrollAttendanceSnapshotPayload, 'version'> & {
  snapshot: {
    servedFrom: 'stored' | 'refreshed';
    sourceCheckedAt: string;
    savedAt: string;
    refreshError?: string;
  };
};

function isFiniteNonNegativeNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isFormSummary(value: unknown): value is PayrollAttendanceFormSummary {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Partial<PayrollAttendanceFormSummary>;
  return typeof row.employee === 'string'
    && isFiniteNonNegativeNumber(row.formRows)
    && isFiniteNonNegativeNumber(row.uniqueFormDates)
    && isFiniteNonNegativeNumber(row.workedDays)
    && isFiniteNonNegativeNumber(row.lateCount);
}

function isScheduleSummary(value: unknown): value is PayrollAttendanceScheduleSummary {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Partial<PayrollAttendanceScheduleSummary>;
  return typeof row.employee === 'string' && isFiniteNonNegativeNumber(row.scheduleDays);
}

export function createPayrollAttendanceSnapshotPayload(
  input: Omit<PayrollAttendanceSnapshotPayload, 'version'>,
): PayrollAttendanceSnapshotPayload {
  return { version: PAYROLL_ATTENDANCE_SNAPSHOT_VERSION, ...input };
}

export function readPayrollAttendanceSnapshotPayload(value: unknown, expectedPeriodKey: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const payload = value as Partial<PayrollAttendanceSnapshotPayload>;
  const period = payload.period;
  if (payload.version !== PAYROLL_ATTENDANCE_SNAPSHOT_VERSION
    || !period
    || period.periodKey !== expectedPeriodKey
    || !Number.isInteger(period.monthIndex)
    || !Number.isInteger(period.year)
    || (payload.attendanceMode !== 'demo' && payload.attendanceMode !== 'google-sheets')
    || typeof payload.attendanceMessage !== 'string'
    || (payload.scheduleMode !== 'not-configured' && payload.scheduleMode !== 'google-sheets')
    || typeof payload.scheduleMessage !== 'string'
    || !Array.isArray(payload.formSummaries)
    || !payload.formSummaries.every(isFormSummary)
    || !Array.isArray(payload.scheduleSummaries)
    || !payload.scheduleSummaries.every(isScheduleSummary)) return null;
  return payload as PayrollAttendanceSnapshotPayload;
}

export function attachPayrollAttendanceSnapshotMeta(
  payload: PayrollAttendanceSnapshotPayload,
  meta: PayrollAttendanceSnapshotResponse['snapshot'],
): PayrollAttendanceSnapshotResponse {
  const { version: _version, ...response } = payload;
  return { ...response, snapshot: meta };
}

export function getPayrollAttendanceSnapshotReplacementError(
  next: PayrollAttendanceSnapshotPayload,
  previous: PayrollAttendanceSnapshotPayload | null,
) {
  if (next.attendanceMode !== 'google-sheets' || next.scheduleMode !== 'google-sheets') {
    return 'Один из источников рабочих дней не подключён.';
  }
  if (previous?.formSummaries.length && !next.formSummaries.length) {
    return 'Google Sheets неожиданно вернул пустую посещаемость.';
  }
  if (previous?.scheduleSummaries.length && !next.scheduleSummaries.length) {
    return 'Google Sheets неожиданно вернул пустой график.';
  }
  return null;
}
