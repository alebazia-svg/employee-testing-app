import 'server-only';

import type { Prisma } from '@prisma/client';
import { formatDateLabel } from '@/lib/workday';
import { scheduleCoverage, scheduleCoverageCopy, schedulePersonName, scheduleWorkingCountAfterChange } from '@/lib/work-schedule-coverage';

type ScheduleEmployee = { id: number; name: string; department: string };
type ScheduleEntryState = { userId: number; status: string };

export async function persistEmployeeScheduleChange(tx: Prisma.TransactionClient, input: {
  user: ScheduleEmployee;
  date: string;
  status: 'working' | 'off';
  previousStatus: string | null | undefined;
  departmentEntries: ScheduleEntryState[];
  source: 'employee' | 'employee_bulk' | 'employee_bulk_edit';
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

  const fingerprintPrefix = `schedule-coverage:${input.user.department}:${input.date}:`;
  await tx.workdayNotification.updateMany({
    where: { fingerprint: `${fingerprintPrefix}${input.user.id}`, status: { in: ['pending', 'sent'] } },
    data: { status: 'cancelled', pushStatus: 'cancelled', readAt: now, nextPushAttemptAt: null },
  });
  if (!coverage.needsReplacement) {
    await tx.workdayNotification.updateMany({
      where: { fingerprint: { startsWith: fingerprintPrefix }, status: { in: ['pending', 'sent'] } },
      data: { status: 'cancelled', pushStatus: 'cancelled', nextPushAttemptAt: null },
    });
    const event = await tx.adminInboxEvent.findUnique({
      where: { eventKey: `schedule-coverage:${input.user.department}:${input.date}` },
      select: { id: true },
    });
    if (event) await tx.adminInboxReceipt.updateMany({ where: { eventId: event.id, readAt: null }, data: { readAt: now } });
    return coverage;
  }

  const workingUserIds = new Set(
    input.departmentEntries
      .filter((entry) => entry.status === 'working' && entry.userId !== input.user.id)
      .map((entry) => entry.userId),
  );
  if (input.status === 'working') workingUserIds.add(input.user.id);
  const candidates = await tx.user.findMany({
    where: {
      role: 'EMPLOYEE',
      isActive: true,
      department: input.user.department,
      id: { notIn: [...workingUserIds, input.user.id] },
    },
    select: { id: true },
  });
  const copy = scheduleCoverageCopy(coverage);
  for (const candidate of candidates) {
    await tx.workdayNotification.upsert({
      where: { fingerprint: `${fingerprintPrefix}${candidate.id}` },
      create: {
        userId: candidate.id,
        fingerprint: `${fingerprintPrefix}${candidate.id}`,
        kind: 'schedule_replacement_request',
        title: coverage.state === 'empty' ? 'На этот день пока никто не выходит' : 'На этот день нужна замена',
        body: `${formatDateLabel(input.date)} · ${copy.body}`,
        scheduledAt: now,
      },
      update: {
        title: coverage.state === 'empty' ? 'На этот день пока никто не выходит' : 'На этот день нужна замена',
        body: `${formatDateLabel(input.date)} · ${copy.body}`,
        status: 'pending',
        scheduledAt: now,
        sentAt: null,
        readAt: null,
        pushStatus: 'pending',
        pushDeliveredAt: null,
        nextPushAttemptAt: null,
        lastError: '',
        attemptCount: 0,
      },
    });
  }

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
