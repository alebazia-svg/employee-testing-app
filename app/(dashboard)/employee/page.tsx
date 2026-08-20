import { redirect } from 'next/navigation';
import { EmployeeTodayClient } from './EmployeeTodayClient';
import { getCurrentUser } from '@/lib/auth';
import { getEmployeeWorkdaySnapshot } from '@/lib/employee-workday-snapshot';
import { prisma } from '@/lib/prisma';
import { buildDateRange, getMoscowDateKey } from '@/lib/workday';

export const dynamic = 'force-dynamic';

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

export default async function Employee() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const today = getMoscowDateKey();
  const dates = buildDateRange(today, 31);

  const [ownSchedule, departmentSchedule, departmentUsers, workdaySnapshot] = await Promise.all([
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
  ]);

  return (
    <EmployeeTodayClient
      user={{ id: user.id, name: user.name, department: user.department }}
      today={today}
      ownSchedule={ownSchedule.map(serializeScheduleEntry)}
      departmentSchedule={departmentSchedule.map(serializeScheduleEntry)}
      departmentUsers={departmentUsers}
      todayWorkDay={workdaySnapshot.workDay}
      unfinishedWorkDay={workdaySnapshot.unfinishedWorkDay}
      shiftControl={workdaySnapshot.shiftControl}
      cashOperations={workdaySnapshot.cashOperations}
      requiredIssues={workdaySnapshot.requiredIssues}
      paymentChecks={workdaySnapshot.paymentChecks}
      closeExceptionRequest={workdaySnapshot.closeExceptionRequest}
    />
  );
}
