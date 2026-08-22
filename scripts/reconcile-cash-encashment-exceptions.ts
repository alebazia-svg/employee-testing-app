import { prisma } from '@/lib/prisma';
import { resolveCarriedCashEncashmentExceptions } from '@/lib/workday-cash-encashment-resolution';

async function main() {
  const apply = process.argv.includes('--confirm-portal-write');
  const operations = await prisma.cashOperation.findMany({
    where: { status: 'posted_1c_pair' },
    select: { id: true, userId: true, date: true, amount: true, createdAt: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  const results = [];
  const matchedIds = new Set<string>();
  for (const operation of operations) {
    const result = await resolveCarriedCashEncashmentExceptions(prisma, {
      employeeId: operation.userId,
      operationId: operation.id,
      operationDate: operation.date,
      operationAmount: operation.amount,
      operationCreatedAt: operation.createdAt,
      apply,
    });
    const resolvedIds = result.resolvedIds.filter((id) => !matchedIds.has(id));
    resolvedIds.forEach((id) => matchedIds.add(id));
    if (resolvedIds.length) results.push({ operationId: operation.id, employeeId: operation.userId, ...result, resolvedIds });
  }
  process.stdout.write(`${JSON.stringify({ ok: true, applied: apply, matchedOperations: results.length, results })}\n`);
}

main().finally(async () => prisma.$disconnect());
