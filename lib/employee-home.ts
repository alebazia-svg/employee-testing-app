import { payrollFeatureState } from './payroll-features';
import 'server-only';
import { getEmployeeWorkdaySnapshot } from '@/lib/employee-workday-snapshot';
import { prisma } from '@/lib/prisma';
import { getMoscowDateKey } from '@/lib/workday';
import { buildInitialScheduleRange } from '@/lib/workday-schedule';
import { serializeEmployeeVacation } from '@/lib/employee-vacation';

function serializeScheduleEntry(entry: {
  id: number;
  userId: number;
  date: string;
  department: string;
  status: string;
  user?: { id: number; name: string; department: string };
}) {
  return {
    id: entry.id,
    userId: entry.userId,
    date: entry.date,
    department: entry.department,
    status: entry.status,
    user: entry.user,
  };
}

export async function loadEmployeeHome(user: { id: number; name: string; department: string; qrScanMode?: string; portalArea?: string }) {

  const today = getMoscowDateKey();
  const { dates, monthKey: initialScheduleMonth } = buildInitialScheduleRange(today);

  const [ownSchedule, departmentSchedule, departmentUsers, workdaySnapshot, ownVacations, departmentVacations] = await Promise.all([
    prisma.workScheduleEntry.findMany({
      where: { userId: user.id, date: { in: dates } },
      orderBy: { date: 'asc' },
    }),
    prisma.workScheduleEntry.findMany({
      where: { department: user.department, date: { in: dates } },
      include: { user: { select: { id: true, name: true, department: true } } },
      orderBy: [{ date: 'asc' }, { user: { name: 'asc' } }],
    }),
    prisma.user.findMany({
      where: { role: 'EMPLOYEE', isActive: true, department: user.department },
      select: { id: true, name: true, department: true },
      orderBy: { name: 'asc' },
    }),
    getEmployeeWorkdaySnapshot(user),
    prisma.employeeVacation.findMany({
      where: { userId: user.id, status: 'active', dateFrom: { lte: dates[dates.length - 1] }, dateTo: { gte: dates[0] } },
      orderBy: [{ dateFrom: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.employeeVacation.findMany({
      where: {
        department: user.department,
        status: 'active',
        dateFrom: { lte: dates[dates.length - 1] },
        dateTo: { gte: dates[0] },
        user: { role: 'EMPLOYEE', isActive: true, department: user.department },
      },
      include: { user: { select: { id: true, name: true, department: true } } },
      orderBy: [{ dateFrom: 'asc' }, { user: { name: 'asc' } }],
    }),
  ]);

  return {
    payrollEnabled: user.department !== 'procurement' && payrollFeatureState().employeeEnabled,
    user: { id: user.id, name: user.name, department: user.department, qrScanMode: user.qrScanMode, portalArea: user.portalArea },
    today: today,
    initialScheduleMonth,
    ownSchedule: ownSchedule.map(serializeScheduleEntry),
    departmentSchedule: departmentSchedule.map(serializeScheduleEntry),
    departmentUsers: departmentUsers,
    departmentWorkdays: workdaySnapshot.departmentWorkdays,
    todayWorkDay: workdaySnapshot.workDay,
    unfinishedWorkDay: workdaySnapshot.unfinishedWorkDay,
    shiftControl: workdaySnapshot.shiftControl,
    cashOperations: workdaySnapshot.cashOperations,
    requiredIssues: workdaySnapshot.requiredIssues,
    paymentChecks: workdaySnapshot.paymentChecks,
    closeExceptionRequest: workdaySnapshot.closeExceptionRequest,
    cashEncashmentExceptionRequest: workdaySnapshot.cashEncashmentExceptionRequest,
    shiftCorrection: workdaySnapshot.shiftCorrection,
    ownVacations: ownVacations.map(serializeEmployeeVacation),
    departmentVacations: departmentVacations.map(serializeEmployeeVacation),
  };
}
