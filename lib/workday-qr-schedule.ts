import 'server-only';
import { prisma } from './prisma';
import { persistEmployeeScheduleChange } from './work-schedule-persistence';

/**
 * Approved 2026-11-08: a successful QR start is the fact of coming to work, so an
 * unmarked today becomes a working day. Never overrides a saved day or a vacation,
 * never notifies colleagues, never blocks the start itself.
 */
export async function markTodayWorkingAfterQrStart(user: { id: number; name: string; department: string }, date: string) {
  try {
    return await prisma.$transaction(async (tx) => {
      const [own, vacation] = await Promise.all([
        tx.workScheduleEntry.findUnique({ where: { userId_date: { userId: user.id, date } }, select: { status: true } }),
        tx.employeeVacation.findFirst({ where: { userId: user.id, status: 'active', dateFrom: { lte: date }, dateTo: { gte: date } }, select: { id: true } }),
      ]);
      if (own || vacation) return false;
      const departmentEntries = await tx.workScheduleEntry.findMany({
        where: { department: user.department, date, user: { role: 'EMPLOYEE', isActive: true, department: user.department } },
        select: { userId: true, status: true },
      });
      await persistEmployeeScheduleChange(tx, { user, date, status: 'working', previousStatus: null, departmentEntries, source: 'qr_start', notifyCoverage: false });
      return true;
    }, { isolationLevel: 'Serializable', timeout: 10000 });
  } catch {
    return false;
  }
}
