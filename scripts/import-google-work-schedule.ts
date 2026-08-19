import { getScheduleRows } from '../lib/google-sheets';
import { prisma } from '../lib/prisma';
import { buildScheduleImportEntries } from '../lib/work-schedule-import';

async function main() {
  const apply = process.argv.includes('--confirm-portal-write');
  const source = await getScheduleRows();
  if (source.mode !== 'google-sheets') throw new Error('GOOGLE_SCHEDULE_NOT_AVAILABLE');

  const users = await prisma.user.findMany({
    where: { role: 'EMPLOYEE', isActive: true },
    select: { id: true, name: true, department: true },
    orderBy: { id: 'asc' },
  });
  const plan = buildScheduleImportEntries(source.rows, users);
  const blocking = plan.unmappedNames.length + plan.ambiguousNames.length + plan.invalidDates.length + plan.conflicts.length;

  const existing = plan.entries.length
    ? await prisma.workScheduleEntry.findMany({
        where: {
          userId: { in: [...new Set(plan.entries.map((entry) => entry.userId))] },
          date: { in: [...new Set(plan.entries.map((entry) => entry.date))] },
        },
        select: { userId: true, date: true, status: true },
      })
    : [];
  const existingByKey = new Map(existing.map((entry) => [`${entry.userId}:${entry.date}`, entry.status]));
  const created = plan.entries.filter((entry) => !existingByKey.has(`${entry.userId}:${entry.date}`)).length;
  const updated = plan.entries.filter((entry) => {
    const status = existingByKey.get(`${entry.userId}:${entry.date}`);
    return status !== undefined && status !== entry.status;
  }).length;
  const unchanged = plan.entries.length - created - updated;

  const result = {
    ok: blocking === 0,
    applied: false,
    sourceRows: source.rows.length,
    importRows: plan.entries.length,
    created,
    updated,
    unchanged,
    mappings: plan.mappings,
    skippedUnknownStatus: plan.skippedUnknownStatus,
    unmappedNames: plan.unmappedNames,
    ambiguousNames: plan.ambiguousNames,
    invalidDates: plan.invalidDates,
    conflicts: plan.conflicts,
  };

  // This is a one-time baseline import. It reads Google Sheets and writes only
  // WorkScheduleEntry in the portal database; it never writes back to Sheets or 1C.

  if (!apply || blocking > 0) {
    process.stdout.write(`${JSON.stringify(result)}\n`);
    if (apply && blocking > 0) process.exitCode = 2;
    return;
  }

  await prisma.$transaction(
    plan.entries.map((entry) => prisma.workScheduleEntry.upsert({
      where: { userId_date: { userId: entry.userId, date: entry.date } },
      create: { userId: entry.userId, date: entry.date, department: entry.department, status: entry.status },
      update: { department: entry.department, status: entry.status },
    })),
  );

  process.stdout.write(`${JSON.stringify({ ...result, applied: true })}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'WORK_SCHEDULE_IMPORT_FAILED'}\n`);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
