import 'server-only';

import type { Prisma } from '@prisma/client';
import { reconcileScheduleQuestions } from './work-schedule-notifications';
import { formatDateLabel } from '@/lib/workday';
import { scheduleCoverage, schedulePersonName, scheduleWorkingCountAfterChange, shouldRequestScheduleReplacement } from '@/lib/work-schedule-coverage';

type ScheduleEmployee = { id: number; name: string; department: string };
type ScheduleEntryState = { userId: number; status: string };

export async function persistEmployeeScheduleChange(tx: Prisma.TransactionClient, input: {
  user: ScheduleEmployee;
  date: string;
  status: 'working' | 'off';
  previousStatus: string | null | undefined;
  departmentEntries: ScheduleEntryState[];
  source: 'employee' | 'employee_bulk' | 'employee_bulk_edit' | 'admin';
  notifyCoverage?: boolean;
}) {
  const workingBefore = input.departmentEntries.filter((entry) => entry.status === 'working').length;
  const workingAfter = scheduleWorkingCountAfterChange({
    workingBefore,
    previousStatus: input.previousStatus,
    nextStatus: input.status,
  });
  const coverage = scheduleCoverage(input.user.department, workingAfter);
  const now = new Date();

  await tx.workScheduleEntry.upsert({
    where: { userId_date: { userId: input.user.id, date: input.date } },
    create: { userId: input.user.id, date: input.date, status: input.status, department: input.user.department },
    update: { status: input.status, department: input.user.department },
  });
  await tx.workScheduleChange.create({
    data: {
      userId: input.user.id,
      date: input.date,
      department: input.user.department,
      previousStatus: input.previousStatus ?? null,
      nextStatus: input.status,
      source: input.source,
      workingBefore,
      workingAfter,
      coverageState: coverage.state,
    },
  });

  if (input.notifyCoverage === false) return coverage;

  await reconcileScheduleQuestions(tx, {
    actorId: input.user.id, department: input.user.department, date: input.date,
    requestKnownOff: shouldRequestScheduleReplacement({ previousStatus: input.previousStatus, nextStatus: input.status, coverage }),
  });
  const existingEvent = await tx.adminInboxEvent.findUnique({
    where: { eventKey: `schedule-coverage:${input.user.department}:${input.date}` }, select: { id: true },
  });
  if (!coverage.needsReplacement) {
    if (existingEvent) await tx.adminInboxReceipt.updateMany({ where: { eventId: existingEvent.id, readAt: null }, data: { readAt: now } });
    return coverage;
  }
  // Preserve the existing administrator warning for a reduced working plan;
  // initial schedule filling does not create a new administrative alarm.
  if (!existingEvent && !shouldRequestScheduleReplacement({ previousStatus: input.previousStatus, nextStatus: input.status, coverage })) return coverage;

  const event = await tx.adminInboxEvent.upsert({
    where: { eventKey: `schedule-coverage:${input.user.department}:${input.date}` },
    create: {
      eventKey: `schedule-coverage:${input.user.department}:${input.date}`,
      type: 'work_schedule.coverage_gap',
      title: coverage.state === 'empty' ? 'На рабочий день никто не назначен' : 'Сокращённый состав отдела',
      body: `${formatDateLabel(input.date)} · ${schedulePersonName(input.user.name)}: график изменён. ${coverage.workingCount} из ${coverage.targetCount} сотрудников.`,
      href: `/admin/workday?date=${input.date}`,
      sourceType: 'work_schedule_coverage',
      sourceId: `${input.user.department}:${input.date}`,
      occurredAt: now,
    },
    update: {
      title: coverage.state === 'empty' ? 'На рабочий день никто не назначен' : 'Сокращённый состав отдела',
      body: `${formatDateLabel(input.date)} · ${schedulePersonName(input.user.name)}: график изменён. ${coverage.workingCount} из ${coverage.targetCount} сотрудников.`,
      occurredAt: now,
    },
  });
  const admins = await tx.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } });
  if (admins.length) {
    await tx.adminInboxReceipt.createMany({ data: admins.map((admin) => ({ eventId: event.id, userId: admin.id })), skipDuplicates: true });
    await tx.adminInboxReceipt.updateMany({ where: { eventId: event.id }, data: { readAt: null } });
  }
  return coverage;
}
