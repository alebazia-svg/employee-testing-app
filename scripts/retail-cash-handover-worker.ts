import { prisma } from '../lib/prisma';
import { processRetailCash } from '../lib/retail-cash-handover-server';
import { handoverEnvironment } from '../lib/retail-cash-handover-environment';
import { setTimeout as wait } from 'node:timers/promises';

async function main() {
  if (!handoverEnvironment()) throw Error('Не настроена база 1С для передачи кассы.');
  for (;;) {
    try {
      const rows = await prisma.retailCashHandover.findMany({
        where: {
          workDay: { status: 'completed' },
          handedAt: { not: null },
          OR: [
            { status: 'confirmed' },
            { status: { in: ['posting', 'error'] }, processingStartedAt: { lt: new Date(Date.now() - 120000) } },
          ],
        },
        select: { workDayEntryId: true, workDay: { select: { userId: true } } },
        orderBy: { updatedAt: 'asc' },
        take: 20,
      });
      for (const row of rows) {
        try {
          const result = await processRetailCash(prisma, row.workDay.userId, row.workDayEntryId);
          console.log('cash-handover', row.workDayEntryId, result.status);
        } catch {
          console.error('Не удалось обработать передачу', row.workDayEntryId);
        }
      }
    } catch {
      console.error('Не удалось прочитать очередь передачи касс.');
    }
    await wait(3000);
  }
}
main().finally(() => prisma.$disconnect());
