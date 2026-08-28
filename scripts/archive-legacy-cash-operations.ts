import { prisma } from '@/lib/prisma';

const targetIds = [1, 2, 3];
const expectedStatuses = ['pending_1c', 'creating_1c', 'created_1c', 'retry_pending'];

async function main() {
  const apply = process.argv.includes('--confirm-portal-write');
  const before = await prisma.cashOperation.findMany({
    where: { id: { in: targetIds } },
    select: { id: true, status: true, oneCDocumentRef: true, oneCReceiptDocumentRef: true },
    orderBy: { id: 'asc' },
  });
  if (before.length !== targetIds.length) throw new Error('Not all target operations exist');
  if (before.some((row) => !expectedStatuses.includes(row.status) || row.oneCDocumentRef || row.oneCReceiptDocumentRef)) {
    throw new Error('A target operation is no longer an unresolved legacy record');
  }
  if (apply) {
    const updated = await prisma.cashOperation.updateMany({
      where: {
        id: { in: targetIds },
        status: { in: expectedStatuses },
        oneCDocumentRef: null,
        oneCReceiptDocumentRef: null,
      },
      data: {
        status: 'resolved_manual',
        oneCError: 'Историческая операция закрыта без проведения задним числом: остатки сверены владельцем.',
      },
    });
    if (updated.count !== targetIds.length) throw new Error('Concurrent change detected; archive aborted');
  }
  const after = await prisma.cashOperation.findMany({
    where: { id: { in: targetIds } },
    select: { id: true, status: true, oneCDocumentRef: true, oneCReceiptDocumentRef: true },
    orderBy: { id: 'asc' },
  });
  const verified = !apply || after.every((row) => row.status === 'resolved_manual' && !row.oneCDocumentRef && !row.oneCReceiptDocumentRef);
  process.stdout.write(`${JSON.stringify({ ok: verified, applied: apply, before, after })}\n`);
  if (!verified) process.exitCode = 1;
}

main().finally(() => prisma.$disconnect());
