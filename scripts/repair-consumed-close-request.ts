import { prisma } from '@/lib/prisma';
import { resolveCloseExceptionNotifications } from '@/lib/workday-notifications';

const requestId = 'cmt33oske0003uduzqjkpf2yn';

async function main() {
  const apply = process.argv.includes('--confirm-portal-write');
  const before = await prisma.workdayCloseExceptionRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      status: true,
      consumedAt: true,
      workDayEntryId: true,
      workDayEntry: { select: { date: true, status: true, endedAt: true } },
    },
  });
  if (!before) throw new Error('Close request not found');
  if (before.status !== 'approved' || before.consumedAt || before.workDayEntry.status !== 'completed' || !before.workDayEntry.endedAt) {
    throw new Error('Close request is no longer an approved unconsumed request for a completed workday');
  }
  if (apply) {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.workdayCloseExceptionRequest.updateMany({
        where: { id: requestId, status: 'approved', consumedAt: null },
        data: { consumedAt: before.workDayEntry.endedAt },
      });
      if (updated.count !== 1) throw new Error('Concurrent change detected; repair aborted');
      await resolveCloseExceptionNotifications(tx, {
        workDayEntryId: before.workDayEntryId,
        now: before.workDayEntry.endedAt as Date,
        scope: 'all',
      });
    });
  }
  const after = await prisma.workdayCloseExceptionRequest.findUnique({
    where: { id: requestId },
    select: { id: true, status: true, consumedAt: true, workDayEntry: { select: { status: true, endedAt: true } } },
  });
  const verified = !apply || Boolean(after?.consumedAt && after.status === 'approved' && after.workDayEntry.status === 'completed');
  process.stdout.write(`${JSON.stringify({ ok: verified, applied: apply, before: { status: before.status, consumed: Boolean(before.consumedAt), workdayStatus: before.workDayEntry.status }, after: { status: after?.status, consumed: Boolean(after?.consumedAt), workdayStatus: after?.workDayEntry.status } })}\n`);
  if (!verified) process.exitCode = 1;
}

main().finally(() => prisma.$disconnect());
