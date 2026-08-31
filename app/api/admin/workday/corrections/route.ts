import { getCurrentUser } from '@/lib/auth';
import { activeVacationOverlapWhere } from '@/lib/employee-vacation';
import { prisma } from '@/lib/prisma';
import { getMoscowDateKey, scheduleStatuses, usesWorkdayShiftControl } from '@/lib/workday';
import { isValidScheduleDateKey } from '@/lib/workday-schedule';
import { changeWorkdayShift, WorkdayShiftChangeError } from '@/lib/workday-shift-change';
import { persistEmployeeScheduleChange } from '@/lib/work-schedule-persistence';

const noStoreHeaders = { 'Cache-Control': 'private, no-store, max-age=0' };

export async function POST(req: Request) {
  const admin = await getCurrentUser();
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: noStoreHeaders });
  if (admin.role !== 'ADMIN') return Response.json({ error: 'Forbidden' }, { status: 403, headers: noStoreHeaders });
  const payload = await req.json().catch(() => null);
  const userId = Number(payload?.userId);
  const employee = Number.isInteger(userId) ? await prisma.user.findFirst({ where: { id: userId, role: 'EMPLOYEE', isActive: true } }) : null;
  if (!employee) return Response.json({ error: 'Сотрудник не найден.' }, { status: 404, headers: noStoreHeaders });

  if (payload?.action === 'change_shift') {
    if (typeof payload.date !== 'string' || !isValidScheduleDateKey(payload.date) || typeof payload.toShiftCode !== 'string') {
      return Response.json({ error: 'Проверьте смену и дату.' }, { status: 400, headers: noStoreHeaders });
    }
    try {
      const workDay = await changeWorkdayShift({
        userId: employee.id,
        department: employee.department,
        date: payload.date,
        toShiftCode: payload.toShiftCode,
        source: 'admin_repair',
        shiftControlEnabled: usesWorkdayShiftControl(employee),
        enforceEmployeeWindow: false,
      });
      return Response.json({ ok: true, workDay }, { headers: noStoreHeaders });
    } catch (error) {
      if (error instanceof WorkdayShiftChangeError) {
        const message = error.code === 'SHIFT_ALREADY_IN_PROGRESS'
          ? 'По смене уже есть действия. Автоматически менять её небезопасно.'
          : error.message;
        return Response.json({ error: message, code: error.code }, { status: 409, headers: noStoreHeaders });
      }
      throw error;
    }
  }

  if (payload?.action === 'set_schedule') {
    const date = payload.date;
    const status = payload.status;
    if (typeof date !== 'string' || !isValidScheduleDateKey(date) || !scheduleStatuses.includes(status)) {
      return Response.json({ error: 'Проверьте дату и статус графика.' }, { status: 400, headers: noStoreHeaders });
    }
    const [currentEntry, departmentEntries, vacations] = await Promise.all([
      prisma.workScheduleEntry.findUnique({ where: { userId_date: { userId: employee.id, date } } }),
      prisma.workScheduleEntry.findMany({ where: { department: employee.department, date } }),
      prisma.employeeVacation.findMany({ where: { department: employee.department, status: 'active', dateFrom: { lte: date }, dateTo: { gte: date } }, select: { userId: true } }),
    ]);
    if (currentEntry?.status === status) return Response.json({ ok: true }, { headers: noStoreHeaders });
    const vacationUserIds = new Set(vacations.map((vacation) => vacation.userId));
    await prisma.$transaction((tx) => persistEmployeeScheduleChange(tx, {
      user: employee,
      date,
      status,
      previousStatus: currentEntry?.status,
      departmentEntries: departmentEntries.filter((entry) => !vacationUserIds.has(entry.userId)),
      source: 'admin',
      notifyCoverage: false,
    }));
    return Response.json({ ok: true }, { headers: noStoreHeaders });
  }

  if (payload?.action === 'save_vacation') {
    const dateFrom = payload.dateFrom;
    const dateTo = payload.dateTo;
    if (typeof dateFrom !== 'string' || typeof dateTo !== 'string' || !isValidScheduleDateKey(dateFrom) || !isValidScheduleDateKey(dateTo) || dateTo < dateFrom) {
      return Response.json({ error: 'Проверьте период отпуска.' }, { status: 400, headers: noStoreHeaders });
    }
    const vacationId = typeof payload.vacationId === 'string' ? payload.vacationId : null;
    const current = vacationId ? await prisma.employeeVacation.findFirst({ where: { id: vacationId, userId: employee.id, status: 'active' } }) : null;
    if (vacationId && !current) return Response.json({ error: 'Отпуск уже изменён. Обновите страницу.' }, { status: 409, headers: noStoreHeaders });
    const overlap = await prisma.employeeVacation.findFirst({ where: activeVacationOverlapWhere(employee.id, dateFrom, dateTo, current?.id) });
    if (overlap) return Response.json({ error: 'Период пересекается с другим отпуском сотрудника.' }, { status: 409, headers: noStoreHeaders });
    const vacation = await prisma.$transaction(async (tx) => {
      if (current) {
        const updated = await tx.employeeVacation.update({ where: { id: current.id }, data: { dateFrom, dateTo, updatedById: admin.id } });
        await tx.employeeVacationChange.create({ data: { vacationId: current.id, userId: employee.id, actorId: admin.id, department: employee.department, action: 'updated', previousDateFrom: current.dateFrom, previousDateTo: current.dateTo, nextDateFrom: dateFrom, nextDateTo: dateTo, source: 'admin' } });
        return updated;
      }
      const created = await tx.employeeVacation.create({ data: { userId: employee.id, department: employee.department, dateFrom, dateTo, createdById: admin.id, updatedById: admin.id } });
      await tx.employeeVacationChange.create({ data: { vacationId: created.id, userId: employee.id, actorId: admin.id, department: employee.department, action: 'created', nextDateFrom: dateFrom, nextDateTo: dateTo, source: 'admin' } });
      return created;
    });
    return Response.json({ ok: true, vacation }, { headers: noStoreHeaders });
  }

  if (payload?.action === 'cancel_vacation') {
    const vacationId = typeof payload.vacationId === 'string' ? payload.vacationId : '';
    const current = await prisma.employeeVacation.findFirst({ where: { id: vacationId, userId: employee.id, status: 'active' } });
    if (!current) return Response.json({ error: 'Отпуск уже изменён. Обновите страницу.' }, { status: 409, headers: noStoreHeaders });
    await prisma.$transaction(async (tx) => {
      await tx.employeeVacation.update({ where: { id: current.id }, data: { status: 'cancelled', cancelledAt: new Date(), updatedById: admin.id } });
      await tx.employeeVacationChange.create({ data: { vacationId: current.id, userId: employee.id, actorId: admin.id, department: employee.department, action: 'cancelled', previousDateFrom: current.dateFrom, previousDateTo: current.dateTo, source: 'admin' } });
    });
    return Response.json({ ok: true }, { headers: noStoreHeaders });
  }

  return Response.json({ error: 'Неизвестное действие.' }, { status: 400, headers: noStoreHeaders });
}
