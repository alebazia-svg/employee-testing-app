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

export type PayrollAttendanceSourceSummary = {
  employee: string;
  userId: number;
  fromDate: string;
  appDates: string[];
  googleFallbackDates: string[];
  overlapDates: string[];
};

export type PayrollAttendanceSnapshotPayload = {
  version: typeof PAYROLL_ATTENDANCE_SNAPSHOT_VERSION;
  period: {
    monthIndex: number;
    year: number;
    periodKey: string;
  };
  attendanceMode: 'demo' | 'google-sheets' | 'google-sheets+pwa';
  attendanceMessage: string;
  scheduleMode: 'not-configured' | 'google-sheets';
  scheduleMessage: string;
  formSummaries: PayrollAttendanceFormSummary[];
  scheduleSummaries: PayrollAttendanceScheduleSummary[];
  attendanceSources?: PayrollAttendanceSourceSummary[];
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

function isSourceSummary(value: unknown, periodKey: string): value is PayrollAttendanceSourceSummary {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Partial<PayrollAttendanceSourceSummary>;
  const validDate = (date: unknown): date is string => typeof date === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(date)
    && Number.isFinite(Date.parse(`${date}T00:00:00Z`))
    && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
  if (typeof row.employee !== 'string' || !Number.isInteger(row.userId) || Number(row.userId) <= 0
    || !validDate(row.fromDate)) return false;
  for (const dates of [row.appDates, row.googleFallbackDates, row.overlapDates]) {
    if (!Array.isArray(dates) || new Set(dates).size !== dates.length
      || !dates.every((date) => validDate(date) && date.startsWith(`${periodKey}-`) && date >= row.fromDate!)) return false;
  }
  return row.googleFallbackDates!.every((date) => !row.appDates!.includes(date))
    && row.overlapDates!.every((date) => row.appDates!.includes(date));
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
    || !['demo', 'google-sheets', 'google-sheets+pwa'].includes(payload.attendanceMode ?? '')
    || typeof payload.attendanceMessage !== 'string'
    || (payload.scheduleMode !== 'not-configured' && payload.scheduleMode !== 'google-sheets')
    || typeof payload.scheduleMessage !== 'string'
    || !Array.isArray(payload.formSummaries)
    || !payload.formSummaries.every(isFormSummary)
    || !Array.isArray(payload.scheduleSummaries)
    || !payload.scheduleSummaries.every(isScheduleSummary)
    || (payload.attendanceSources !== undefined && (!Array.isArray(payload.attendanceSources)
      || !payload.attendanceSources.every((row) => isSourceSummary(row, expectedPeriodKey))))
    || (payload.attendanceMode === 'google-sheets+pwa' && !payload.attendanceSources?.length)) return null;
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
  if (!['google-sheets', 'google-sheets+pwa'].includes(next.attendanceMode) || next.scheduleMode !== 'google-sheets') {
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
