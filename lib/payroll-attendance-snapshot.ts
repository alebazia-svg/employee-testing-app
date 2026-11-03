import { validDaySources, type PayrollDaySource } from './payroll-day-review';
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
  /** Explicit owner-confirmed exception, distinct from a QR start. */
  ownerConfirmedDates?: string[];
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
  dayReviewSources?: PayrollDaySource[];
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
  if (row.ownerConfirmedDates !== undefined && (!Array.isArray(row.ownerConfirmedDates)
    || new Set(row.ownerConfirmedDates).size !== row.ownerConfirmedDates.length
    || !row.ownerConfirmedDates.every(date => validDate(date) && date.startsWith(periodKey + '-') && date >= row.fromDate!))) return false;
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
    || (payload.dayReviewSources !== undefined && !validDaySources(payload.dayReviewSources, expectedPeriodKey))
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

/** App/owner-only days do not prove that Google previously had this month.
 * Keep disappearance protection for actual Google evidence, including dates
 * before cutover, overlapping dates, duplicate form rows and lateness. */
export function hasGooglePayrollAttendance(payload: PayrollAttendanceSnapshotPayload | null) {
  return payload?.formSummaries.some(row => {
    const source = payload.attendanceSources?.find(source => source.employee === row.employee);
    if (!source) return row.formRows > 0 || row.uniqueFormDates > 0 || row.workedDays > 0 || row.lateCount > 0;
    const ownDates = new Set([...source.appDates, ...(source.ownerConfirmedDates ?? [])]).size;
    return source.googleFallbackDates.length > 0 || source.overlapDates.length > 0 || row.lateCount > 0
      || row.uniqueFormDates > ownDates || row.formRows > ownDates;
  }) ?? false;
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
