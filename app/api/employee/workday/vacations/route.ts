import { getCurrentUser } from '@/lib/auth';
import { activeVacationOverlapWhere, employeeVacationHasStarted, serializeEmployeeVacation, validateVacationRange } from '@/lib/employee-vacation';
import { prisma } from '@/lib/prisma';
import { getMoscowDateKey } from '@/lib/workday';

const noStoreHeaders = { 'Cache-Control': 'private, no-store, max-age=0' };

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: noStoreHeaders });
  const payload = await req.json().catch(() => null);
  const action = payload?.action === 'update' || payload?.action === 'cancel' ? payload.action : 'create';
  const today = getMoscowDateKey();

  if (action === 'cancel') {
    if (typeof payload?.id !== 'string') return Response.json({ error: 'Отпуск не найден.' }, { status: 400, headers: noStoreHeaders });
    const current = await prisma.employeeVacation.findFirst({ where: { id: payload.id, userId: user.id, status: 'active' } });
    if (!current) return Response.json({ error: 'Отпуск уже изменён. Обновите график.' }, { status: 409, headers: noStoreHeaders });
    if (employeeVacationHasStarted(current.dateFrom, today)) return Response.json({ error: 'Начавшийся или прошедший отпуск может исправить только администратор.' }, { status: 409, headers: noStoreHeaders });
    const vacation = await prisma.$transaction(async (tx) => {
      const updated = await tx.employeeVacation.update({ where: { id: current.id }, data: { status: 'cancelled', cancelledAt: new Date(), updatedById: user.id } });
      await tx.employeeVacationChange.create({
        data: {
          vacationId: current.id,
          userId: user.id,
          actorId: user.id,
          department: user.department,
          action: 'cancelled',
          previousDateFrom: current.dateFrom,
          previousDateTo: current.dateTo,
          source: 'employee',
        },
      });
      return updated;
    });
    return Response.json({ ok: true, vacation: serializeEmployeeVacation(vacation) }, { headers: noStoreHeaders });
  }

  const validationError = validateVacationRange(payload?.dateFrom, payload?.dateTo, today);
  if (validationError) return Response.json({ error: validationError }, { status: 400, headers: noStoreHeaders });
  const dateFrom = payload.dateFrom as string;
  const dateTo = payload.dateTo as string;

  if (action === 'update') {
    if (typeof payload?.id !== 'string') return Response.json({ error: 'Отпуск не найден.' }, { status: 400, headers: noStoreHeaders });
    const current = await prisma.employeeVacation.findFirst({ where: { id: payload.id, userId: user.id, status: 'active' } });
    if (!current) return Response.json({ error: 'Отпуск уже изменён. Обновите график.' }, { status: 409, headers: noStoreHeaders });
    if (employeeVacationHasStarted(current.dateFrom, today)) return Response.json({ error: 'Начавшийся или прошедший отпуск может исправить только администратор.' }, { status: 409, headers: noStoreHeaders });
    const overlap = await prisma.employeeVacation.findFirst({ where: activeVacationOverlapWhere(user.id, dateFrom, dateTo, current.id) });
    if (overlap) return Response.json({ error: 'Этот период пересекается с другим отпуском.' }, { status: 409, headers: noStoreHeaders });
    const vacation = await prisma.$transaction(async (tx) => {
      const updated = await tx.employeeVacation.update({ where: { id: current.id }, data: { dateFrom, dateTo, updatedById: user.id } });
      await tx.employeeVacationChange.create({
        data: {
          vacationId: current.id,
          userId: user.id,
          actorId: user.id,
          department: user.department,
          action: 'updated',
          previousDateFrom: current.dateFrom,
          previousDateTo: current.dateTo,
          nextDateFrom: dateFrom,
          nextDateTo: dateTo,
          source: 'employee',
        },
      });
      return updated;
    });
    return Response.json({ ok: true, vacation: serializeEmployeeVacation(vacation) }, { headers: noStoreHeaders });
  }

  const overlap = await prisma.employeeVacation.findFirst({ where: activeVacationOverlapWhere(user.id, dateFrom, dateTo) });
  if (overlap) return Response.json({ error: 'Этот период пересекается с уже отмеченным отпуском.' }, { status: 409, headers: noStoreHeaders });
  const vacation = await prisma.$transaction(async (tx) => {
    const created = await tx.employeeVacation.create({
      data: { userId: user.id, department: user.department, dateFrom, dateTo, createdById: user.id, updatedById: user.id },
    });
    await tx.employeeVacationChange.create({
      data: {
        vacationId: created.id,
        userId: user.id,
        actorId: user.id,
        department: user.department,
        action: 'created',
        nextDateFrom: dateFrom,
        nextDateTo: dateTo,
        source: 'employee',
      },
    });
    return created;
  });
  return Response.json({ ok: true, vacation: serializeEmployeeVacation(vacation) }, { headers: noStoreHeaders });
}
