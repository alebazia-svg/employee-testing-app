import { Prisma, type PrismaClient } from '@prisma/client';
import { buildLatenessShadowSnapshot } from './attendance-shadow';
import { getMoscowMinutes, getShiftOption, getShiftOptionsForDepartment, isShiftSupportedForDepartment, supportedShiftCodesByDepartment } from './workday';
import { WorkdayShiftChangeError } from './workday-shift-change';

export type RepairTask = { id: number; title: string; category: string; plannedTimeMinutes: number | null };

/** Bind checks by purpose, never by sort order (the middle retail check changes
 * from order 50 to 40). No completed check, cash fact or task identity is rebuilt. */
export function adminShiftRepairPlan(current: RepairTask[], target: Omit<RepairTask, 'id'>[]) {
  const identity = (task: Omit<RepairTask, 'id'>) => `${task.category}:${task.title.trim()}`;
  const unique = (tasks: Omit<RepairTask, 'id'>[]) => new Set(tasks.map(identity)).size === tasks.length;
  if (!unique(current) || !unique(target) || target.some(task => !current.some(row => identity(row) === identity(task)))) {
    throw new WorkdayShiftChangeError('SHIFT_CHECKS_DIFFER', 'В этой смене другой набор проверок. Требуется отдельная проверка администратора.');
  }
  return target.flatMap(task => {
    const row = current.find(row => identity(row) === identity(task))!;
    if (row.plannedTimeMinutes === task.plannedTimeMinutes) return [];
    if (row.plannedTimeMinutes === null || task.plannedTimeMinutes === null) {
      throw new WorkdayShiftChangeError('SHIFT_CHECKS_DIFFER', 'Не удалось сопоставить сроки проверок. Изменения не сохранены.');
    }
    return [{ id: row.id, from: row.plannedTimeMinutes, to: task.plannedTimeMinutes }];
  });
}

/** ADMIN factual correction uses existing records, unlike the employee's guarded
 * empty-run rebuild. All updates and history commit atomically. */
export async function repairAdminWorkdayShift(db: PrismaClient, input: {
  /** Omitted = the employee changes their own live shift (extra guards, own inbox wording). */
  adminId?: number; userId: number; department: string; date: string; toShiftCode: string; now?: Date;
}) {
  const now = input.now ?? new Date();
  const shift = getShiftOption(input.toShiftCode);
  if (shift.code !== input.toShiftCode || !isShiftSupportedForDepartment(input.department, shift.code)) {
    throw new WorkdayShiftChangeError('SHIFT_UNSUPPORTED', 'Эта смена недоступна для отдела.');
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.$transaction(async tx => {
        const own = input.adminId === undefined;
        if (own && !supportedShiftCodesByDepartment[input.department]) throw new WorkdayShiftChangeError('SHIFT_UNSUPPORTED', 'Для этого отдела смену изменить нельзя.');
        const admin = own ? { id: 0, name: '' } : await tx.user.findFirst({ where: { id: input.adminId, role: 'ADMIN', isActive: true }, select: { id: true, name: true } });
        if (!admin) throw new WorkdayShiftChangeError('ADMIN_REQUIRED', 'Нет доступа.');
        // Same row lock as completion/extension; concurrent task updates also
        // participate in the serializable transaction.
        await tx.$queryRaw`SELECT "id" FROM "WorkDayEntry" WHERE "userId" = ${input.userId} AND "date" = ${input.date} FOR UPDATE`;
        const day = await tx.workDayEntry.findUnique({ where: { userId_date: { userId: input.userId, date: input.date } }, include: { shiftControlRun: { include: { tasks: true } }, user: { select: { name: true } } } });
        if (!day || day.department !== input.department || day.endedAt || day.status !== 'active' || (day.shiftControlRun && day.shiftControlRun.status !== 'active')) {
          throw new WorkdayShiftChangeError('WORKDAY_NOT_ACTIVE', 'Активный рабочий день не найден.');
        }
        if (day.shiftCode === shift.code) return day;
        if (own && shift.startMinutes !== day.shiftStartMinutes) throw new WorkdayShiftChangeError('SHIFT_NOT_AVAILABLE', 'Можно изменить только время окончания смены.');
        const run = day.shiftControlRun;
        if (own && run?.tasks.some(t => ['closing', 'handover'].includes(t.category) && (t.status !== 'pending' || t.completedAt))) {
          throw new WorkdayShiftChangeError('SHIFT_ALREADY_IN_PROGRESS', 'Сдача смены уже началась: изменить смену может администратор.');
        }
        if (run) {
          const template = await tx.shiftControlTemplate.findFirst({ where: { department: input.department, shiftCode: shift.code, isActive: true }, include: { tasks: true }, orderBy: { version: 'desc' } });
          if (!template?.tasks.length) throw new WorkdayShiftChangeError('SHIFT_TEMPLATE_MISSING', 'Для этой смены нет чек-листа. Изменения не сохранены.');
          for (const change of adminShiftRepairPlan(run.tasks, template.tasks)) {
            await tx.shiftControlTask.update({ where: { id: change.id }, data: { plannedTimeMinutes: change.to } });
            const task = run.tasks.find(task => task.id === change.id)!;
            if (task.status !== 'pending' || task.completedAt) continue;
            const reminders = await tx.workdayNotification.findMany({ where: { taskId: task.id, status: 'pending', kind: { in: ['planned', 'overdue', 'overdue_repeat', 'early_finish_reminder'] } } });
            for (const reminder of reminders) await tx.workdayNotification.update({ where: { id: reminder.id }, data: { scheduledAt: new Date(+reminder.scheduledAt + (change.to - change.from) * 60_000), nextPushAttemptAt: null } });
          }
        }
        const shadow = buildLatenessShadowSnapshot(shift.startMinutes, getMoscowMinutes(day.qrAcceptedAt ?? day.startedAt));
        const updated = await tx.workDayEntry.update({ where: { id: day.id }, data: {
          shiftCode: shift.code, shiftLabel: shift.label, shiftStartMinutes: shift.startMinutes, shiftEndMinutes: shift.endMinutes,
          lateMinutes: shadow.lateMinutes, latenessPolicyVersion: shadow.policyVersion, latenessShadowPointsX2: shadow.pointsX2,
        } });
        const change = await tx.workdayShiftChange.create({ data: {
          workDayEntryId: day.id, userId: day.userId, source: own ? 'employee_change' : 'admin_repair', fromShiftCode: day.shiftCode, fromShiftLabel: day.shiftLabel,
          toShiftCode: shift.code, toShiftLabel: shift.label, fromLateMinutes: day.lateMinutes, toLateMinutes: shadow.lateMinutes,
          fromShadowPointsX2: day.latenessShadowPointsX2, toShadowPointsX2: shadow.pointsX2, latenessPolicyVersion: shadow.policyVersion, changedAt: now,
        } });
        const stillOpen = own ? await tx.workDayEntry.findMany({ where: { date: day.date, department: day.department, status: 'active', endedAt: null, userId: { not: day.userId } }, include: { user: { select: { name: true } } } }) : [];
        const openNote = stillOpen.length ? ` У ${stillOpen.map((d) => d.user.name).join(', ')} смена ещё открыта.` : '';
        await tx.adminInboxEvent.create({ data: {
          eventKey: `workday-shift-repair:${change.id}`, type: own ? 'workday.shift_changed_by_employee' : 'workday.shift_repaired', title: own ? `${day.user.name} изменил(а) смену` : 'Смена исправлена администратором',
          body: own ? `${day.user.name}: ${day.shiftLabel} → ${shift.label}. Проверки и денежные операции сохранены, напоминания сдвинуты.${openNote}` : `${admin.name}: ${day.user.name}, ${day.shiftLabel} → ${shift.label}. Проверки и денежные операции сохранены.`,
          href: `/admin/workday?date=${day.date}&employee=${day.userId}`, sourceType: 'workday_shift_repair', sourceId: change.id, occurredAt: now,
        } });
        return updated;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2034' || (error.code === 'P2010' && error.meta?.code === '40001')) && attempt < 2) continue;
      throw error;
    }
  }
  throw new WorkdayShiftChangeError('SHIFT_RETRY_EXHAUSTED', 'Повторите исправление.');
}

/** Which other shifts the employee may switch to right now (same rules the change itself enforces). */
export async function listOwnShiftChangeOptions(db: PrismaClient, input: { userId: number; department: string; date: string }) {
  if (!supportedShiftCodesByDepartment[input.department]) return { canChange: false, current: null as string | null, options: [] as Array<{ code: string; label: string; endMinutes: number }> };
  const day = await db.workDayEntry.findUnique({ where: { userId_date: { userId: input.userId, date: input.date } }, include: { shiftControlRun: { include: { tasks: true } } } });
  if (!day || day.endedAt || day.status !== 'active' || (day.shiftControlRun && day.shiftControlRun.status !== 'active')) return { canChange: false, current: null as string | null, options: [] as Array<{ code: string; label: string; endMinutes: number }> };
  const run = day.shiftControlRun;
  if (run?.tasks.some(t => ['closing', 'handover'].includes(t.category) && (t.status !== 'pending' || t.completedAt))) return { canChange: false, current: day.shiftCode, options: [] };
  const options: Array<{ code: string; label: string; endMinutes: number }> = [];
  for (const shift of getShiftOptionsForDepartment(input.department)) {
    if (shift.code === day.shiftCode || shift.startMinutes !== day.shiftStartMinutes) continue;
    if (run) {
      const template = await db.shiftControlTemplate.findFirst({ where: { department: input.department, shiftCode: shift.code, isActive: true }, include: { tasks: true }, orderBy: { version: 'desc' } });
      if (!template?.tasks.length) continue;
      try { adminShiftRepairPlan(run.tasks, template.tasks); } catch { continue; }
    }
    options.push({ code: shift.code, label: shift.label, endMinutes: shift.endMinutes ?? 0 });
  }
  return { canChange: options.length > 0, current: day.shiftCode, options };
}
