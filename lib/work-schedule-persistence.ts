import { reconcileScheduleCoverageQuestion } from './schedule-coverage-reconciliation';
import 'server-only';

import type { Prisma } from '@prisma/client';
import { reconcileScheduleQuestions } from './work-schedule-notifications';
import { scheduleCoverage, scheduleWorkingCountAfterChange, shouldRequestScheduleReplacement } from '@/lib/work-schedule-coverage';

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
  const reduced = shouldRequestScheduleReplacement({ previousStatus: input.previousStatus, nextStatus: input.status, coverage });
  await reconcileScheduleCoverageQuestion(tx, input.user.department, input.date, now, reduced);
  return coverage;
}
