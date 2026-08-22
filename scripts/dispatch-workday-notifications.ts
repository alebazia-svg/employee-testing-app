import { prisma } from '@/lib/prisma';
import { dispatchDueWorkdayNotifications } from '@/lib/workday-notifications';

async function main() {
  const result = await dispatchDueWorkdayNotifications();
  process.stdout.write(`${JSON.stringify({ ok: true, ...result })}\n`);
}

main().finally(() => prisma.$disconnect());
