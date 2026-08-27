import { prisma } from '@/lib/prisma';

async function main() {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [cashOperations, closeRequests] = await Promise.all([
    prisma.cashOperation.findMany({
      where: {
        status: { in: ['pending_1c', 'creating_1c', 'created_1c', 'retry_pending'] },
        createdAt: { lt: oneDayAgo },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, date: true, direction: true, status: true, createdAt: true, updatedAt: true,
        oneCDocumentRef: true, oneCDocumentNumber: true,
        oneCReceiptDocumentRef: true, oneCReceiptDocumentNumber: true,
        oneCCreatedAt: true, oneCPostedAt: true, oneCError: true,
      },
    }),
    prisma.workdayCloseExceptionRequest.findMany({
      where: { status: 'approved', consumedAt: null, workDayEntry: { endedAt: { not: null } } },
      orderBy: { requestedAt: 'asc' },
      select: {
        id: true, reasonCode: true, requestedAt: true, decidedAt: true,
        workDayEntry: { select: { date: true, status: true, endedAt: true } },
      },
    }),
  ]);

  console.log(JSON.stringify({
    mode: 'preview',
    cashOperations: cashOperations.map((row) => ({
      id: row.id, date: row.date, direction: row.direction, status: row.status,
      createdAt: row.createdAt, updatedAt: row.updatedAt,
      expenseDocument: Boolean(row.oneCDocumentRef && row.oneCDocumentNumber),
      receiptDocument: Boolean(row.oneCReceiptDocumentRef && row.oneCReceiptDocumentNumber),
      oneCCreatedAt: row.oneCCreatedAt, oneCPostedAt: row.oneCPostedAt,
      hasError: Boolean(row.oneCError.trim()),
    })),
    closeRequests: closeRequests.map((row) => ({
      id: row.id, reasonCode: row.reasonCode, requestedAt: row.requestedAt,
      decidedAt: row.decidedAt, workday: row.workDayEntry,
    })),
  }, null, 2));
}

main().finally(() => prisma.$disconnect());
