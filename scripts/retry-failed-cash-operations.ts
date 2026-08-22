import { prisma } from '@/lib/prisma';
import { retryCashOperationInOneC } from '@/lib/cash-operation-one-c-retry';

async function main() {
  const cutoff = new Date(Date.now() - 5 * 60 * 1000);
  const operations = await prisma.cashOperation.findMany({
    where: {
      OR: [
        { status: 'one_c_error', updatedAt: { lte: cutoff } },
        { status: 'retrying_1c', updatedAt: { lte: new Date(Date.now() - 10 * 60 * 1000) } },
      ],
    },
    select: { id: true },
    orderBy: { updatedAt: 'asc' },
    take: 20,
  });
  const results = [];
  for (const operation of operations) {
    const result = await retryCashOperationInOneC(prisma, operation.id);
    results.push({ operationId: operation.id, ok: result.ok, reason: result.reason });
  }
  process.stdout.write(`${JSON.stringify({ ok: true, attempted: results.length, results })}\n`);
}

main().finally(() => prisma.$disconnect());
