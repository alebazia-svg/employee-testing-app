import { getAttendanceRows, getScheduleRows } from '@/lib/google-sheets';
import { prisma } from '@/lib/prisma';
import {
  PAYROLL_ATTENDANCE_SNAPSHOT_VERSION,
  attachPayrollAttendanceSnapshotMeta,
  createPayrollAttendanceSnapshotPayload,
  getPayrollAttendanceSnapshotReplacementError,
  readPayrollAttendanceSnapshotPayload,
} from '@/lib/payroll-attendance-snapshot';

import { buildFormSummaries, buildScheduleSummaries } from '@/lib/payroll-attendance-summary';
import { mergePayrollAttendanceSources, PAYROLL_APP_ATTENDANCE_CUTOVERS } from '@/lib/payroll-attendance-source';
import { getMoscowDateKey } from '@/lib/workday';


function pad(value: number) {
  return String(value).padStart(2, '0');
}

function getPeriod(searchParams: URLSearchParams) {
  const monthRaw = searchParams.get('month');
  const yearRaw = searchParams.get('year');
  const monthIndex = monthRaw === null ? NaN : Number(monthRaw);
  const year = yearRaw === null ? NaN : Number(yearRaw);

  if (!Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11 || !Number.isInteger(year)) {
    return null;
  }

  return {
    monthIndex,
    year,
    periodKey: `${year}-${pad(monthIndex + 1)}`,
  };
}

export async function readPayrollAttendance(request: Request) {
  const period = getPeriod(new URL(request.url).searchParams);

  if (!period) {
    return Response.json(
      {
        error: 'Не выбран период для предпросмотра посещаемости.',
      },
      { status: 400 },
    );
  }

  try {
    const saved = await prisma.payrollAttendanceSnapshot.findUnique({ where: { periodKey: period.periodKey } });
    const payload = saved ? readPayrollAttendanceSnapshotPayload(saved.payload, period.periodKey) : null;
    if (!saved || !payload) {
      return Response.json({ error: 'Сохранённых данных о рабочих днях за этот месяц пока нет.' }, { status: 404 });
    }

    return Response.json(attachPayrollAttendanceSnapshotMeta(payload, {
      servedFrom: 'stored',
      sourceCheckedAt: saved.sourceCheckedAt.toISOString(),
      savedAt: saved.updatedAt.toISOString(),
    }));
  } catch (caught) {
    console.error('PAYROLL_ATTENDANCE_READ_FAILED');
    return Response.json({ error: 'Не удалось открыть сохранённые данные о рабочих днях.' }, { status: 500 });
  }
}

export async function refreshPayrollAttendance(request: Request) {
  const period = getPeriod(new URL(request.url).searchParams);

  if (!period) {
    return Response.json({ error: 'Не выбран период для обновления посещаемости.' }, { status: 400 });
  }

  const saved = await prisma.payrollAttendanceSnapshot.findUnique({ where: { periodKey: period.periodKey } });
  const savedPayload = saved ? readPayrollAttendanceSnapshotPayload(saved.payload, period.periodKey) : null;

  try {
    const [attendanceData, scheduleData] = await Promise.all([getAttendanceRows(), getScheduleRows()]);
    if (savedPayload?.formSummaries.length && !buildFormSummaries(attendanceData.rows, period.periodKey).length) {
      throw new Error('Google Sheets неожиданно вернул пустую посещаемость.');
    }
    const sourceCheckedAt = new Date();
    const throughDate = [
      `${period.periodKey}-${new Date(Date.UTC(period.year, period.monthIndex + 1, 0)).getUTCDate()}`,
      getMoscowDateKey(sourceCheckedAt),
    ].sort()[0];
    const cutovers = PAYROLL_APP_ATTENDANCE_CUTOVERS.filter((rule) => rule.fromDate <= throughDate);
    if (cutovers.length && attendanceData.mode !== 'google-sheets') {
      throw new Error('Резервный источник посещаемости Google Sheets недоступен.');
    }
    const appUsers = cutovers.length ? await prisma.user.findMany({
      where: { id: { in: cutovers.map((rule) => rule.userId) } },
      select: {
        id: true,
        name: true,
        payrollName: true,
        workDays: {
          where: { date: { gte: `${period.periodKey}-01`, lte: throughDate } },
          select: { userId: true, date: true, startedAt: true, status: true },
        },
      },
    }) : [];
    const attendance = mergePayrollAttendanceSources({
      googleRows: attendanceData.rows, appUsers, periodKey: period.periodKey, throughDate, cutovers,
    });
    const payload = createPayrollAttendanceSnapshotPayload({
      period,
      attendanceMode: attendance.sources.length ? 'google-sheets+pwa' : attendanceData.mode,
      attendanceMessage: attendanceData.message,
      scheduleMode: scheduleData.mode,
      scheduleMessage: scheduleData.message,
      formSummaries: attendance.formSummaries,
      attendanceSources: attendance.sources,
      scheduleSummaries: buildScheduleSummaries(scheduleData.rows, period.periodKey),
    });
    const replacementError = getPayrollAttendanceSnapshotReplacementError(payload, savedPayload);
    if (replacementError) throw new Error(replacementError);
    const stored = await prisma.payrollAttendanceSnapshot.upsert({
      where: { periodKey: period.periodKey },
      create: {
        periodKey: period.periodKey,
        payloadVersion: PAYROLL_ATTENDANCE_SNAPSHOT_VERSION,
        payload,
        sourceCheckedAt,
      },
      update: {
        payloadVersion: PAYROLL_ATTENDANCE_SNAPSHOT_VERSION,
        payload,
        sourceCheckedAt,
      },
    });

    return Response.json(attachPayrollAttendanceSnapshotMeta(payload, {
      servedFrom: 'refreshed',
      sourceCheckedAt: sourceCheckedAt.toISOString(),
      savedAt: stored.updatedAt.toISOString(),
    }));
  } catch (caught) {
    console.error('PAYROLL_ATTENDANCE_REFRESH_FAILED');
    const refreshError = 'Не удалось обновить источник рабочих дней. Сохранённые дни и опоздания оставлены без изменений.';
    if (saved && savedPayload) {
      return Response.json(attachPayrollAttendanceSnapshotMeta(savedPayload, {
        servedFrom: 'stored',
        sourceCheckedAt: saved.sourceCheckedAt.toISOString(),
        savedAt: saved.updatedAt.toISOString(),
        refreshError,
      }));
    }
    return Response.json({ error: refreshError }, { status: 502 });
  }
}
