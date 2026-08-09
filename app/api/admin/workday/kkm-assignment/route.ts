import { redirect } from 'next/navigation';
import { Prisma } from '@prisma/client';
import { getCurrentUser } from '@/lib/auth';
import { getKkmEquipmentDiagnostics } from '@/lib/one-c';
import { prisma } from '@/lib/prisma';
import { getMoscowDateKey } from '@/lib/workday';

function isDateKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function startOfMoscowDate(date: string) {
  return new Date(`${date}T00:00:00+03:00`);
}

function assignmentRedirect(date: string, status: 'saved' | 'removed' | 'error', message = '') {
  const query = new URLSearchParams({ date, kkmAssignment: status });
  if (message) query.set('kkmAssignmentError', message);
  return `/admin/workday?${query.toString()}#kkm-assignments`;
}

export async function POST(req: Request) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== 'ADMIN') redirect('/login');

  const formData = await req.formData();
  const dateValue = String(formData.get('date') ?? '');
  const date = isDateKey(dateValue) ? dateValue : getMoscowDateKey();
  const userId = Number(formData.get('userId'));
  const cashRegisterRef = String(formData.get('oneCCashRegisterRef') ?? '').trim();
  const plannedShiftCode = String(formData.get('plannedShiftCode') ?? '').trim() || null;
  const note = String(formData.get('note') ?? '').trim();
  const changeReason = String(formData.get('changeReason') ?? '').trim();
  if (!Number.isInteger(userId) || userId <= 0) redirect(assignmentRedirect(date, 'error', 'Некорректный сотрудник.'));

  const [employee, workDay, current] = await Promise.all([
    prisma.user.findFirst({ where: { id: userId, role: 'EMPLOYEE', isActive: true } }),
    prisma.workDayEntry.findUnique({ where: { userId_date: { userId, date } } }),
    prisma.workdayKkmAssignment.findFirst({ where: { userId, date, effectiveTo: null }, orderBy: { effectiveFrom: 'desc' } }),
  ]);
  if (!employee) redirect(assignmentRedirect(date, 'error', 'Сотрудник не найден.'));

  const changeAt = workDay && !workDay.endedAt ? new Date() : startOfMoscowDate(date);
  const requiresReason = Boolean(current || (workDay && !workDay.endedAt));
  if (requiresReason && !changeReason) {
    redirect(assignmentRedirect(date, 'error', 'Для изменения назначения укажите причину.'));
  }

  if (!cashRegisterRef) {
    if (current) await prisma.workdayKkmAssignment.update({ where: { id: current.id }, data: { effectiveTo: new Date(), changeReason } });
    redirect(assignmentRedirect(date, 'removed'));
  }

  const diagnostics = await getKkmEquipmentDiagnostics({ dateFrom: date, dateTo: date, limit: 300 });
  if (!diagnostics.ok) redirect(assignmentRedirect(date, 'error', diagnostics.error || 'Справочник ККМ 1С недоступен.'));
  const registers = new Map(
    [...diagnostics.catalogCashRegisters, ...diagnostics.cashRegisterUsage.map((row) => row.cashRegister)]
      .filter((item) => item.ref)
      .map((item) => [item.ref, item]),
  );
  const cashRegister = registers.get(cashRegisterRef);
  if (!cashRegister) redirect(assignmentRedirect(date, 'error', 'Выбранная ККМ не найдена в 1С.'));

  if (current?.oneCCashRegisterRef === cashRegisterRef) {
    await prisma.workdayKkmAssignment.update({ where: { id: current.id }, data: { plannedShiftCode, note, changeReason, assignedById: admin.id } });
    redirect(assignmentRedirect(date, 'saved'));
  }

  try {
    await prisma.$transaction(async (tx) => {
      const occupied = await tx.workdayKkmAssignment.findFirst({
        where: { date, oneCCashRegisterRef: cashRegisterRef, effectiveTo: null, userId: { not: userId } },
        include: { user: { select: { name: true } } },
      });
      if (occupied) throw new Error(`KKM_OCCUPIED:${occupied.user.name}`);
      const freshCurrent = await tx.workdayKkmAssignment.findFirst({ where: { userId, date, effectiveTo: null }, orderBy: { effectiveFrom: 'desc' } });
      if (freshCurrent) await tx.workdayKkmAssignment.update({ where: { id: freshCurrent.id }, data: { effectiveTo: changeAt, changeReason } });
      await tx.workdayKkmAssignment.create({
        data: {
          userId,
          date,
          plannedShiftCode,
          oneCCashRegisterRef: cashRegister.ref,
          oneCCashRegisterName: cashRegister.name,
          kkmMode: 'personal',
          source: workDay && !workDay.endedAt ? 'emergency_switch' : 'manual',
          note,
          changeReason,
          effectiveFrom: changeAt,
          assignedById: admin.id,
          workDayEntryId: workDay?.id ?? null,
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.startsWith('KKM_OCCUPIED:')) redirect(assignmentRedirect(date, 'error', `ККМ сейчас назначена сотруднику ${message.slice('KKM_OCCUPIED:'.length)}.`));
    redirect(assignmentRedirect(date, 'error', 'Назначение изменилось одновременно в другом окне. Повторите действие.'));
  }

  redirect(assignmentRedirect(date, 'saved'));
}
