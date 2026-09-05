import { prisma } from '@/lib/prisma';

async function main() {
  const cutoff = new Date(Date.now() - 5 * 60 * 1000);
  const operations = await prisma.cashOperation.findMany({
    where: {
      OR: [
        { status: 'one_c_error', updatedAt: { lte: cutoff } },
        { status: 'retrying_1c', updatedAt: { lte: new Date(Date.now() - 10 * 60 * 1000) } },
      ],
    },
    select: { id: true, userId: true, date: true, amount: true, direction: true, status: true, updatedAt: true },
    orderBy: { updatedAt: 'asc' },
    take: 20,
  });
  // Financial writes require an explicit administrator decision in the portal.
  // The legacy timer may still invoke this script on an older VPS installation,
  // so the command intentionally remains read-only even when old flags are
  // present. The admin API owns every requested retry.
  process.stdout.write(`${JSON.stringify({
    ok: true,
    applied: false,
    automaticRetryDisabled: true,
    candidates: operations,
  })}\n`);
}

main().finally(() => prisma.$disconnect());
