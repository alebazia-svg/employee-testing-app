import { createHash } from 'node:crypto';
import { queueAdminInboxTelegramDelivery } from '@/lib/admin-inbox';
import { prisma } from '@/lib/prisma';
import { probeTBankCabinetSnapshot, TBANK_CABINET_WATCHDOG_SOURCE_ID, tbankCabinetWatchdogCopy } from '@/lib/tbank-cabinet-watchdog';

async function publish(input: { type: string; title: string; body: string; occurredAt: Date }) {
  const suffix = createHash('sha256').update(input.occurredAt.toISOString()).digest('hex').slice(0, 16);
  const event = await prisma.adminInboxEvent.create({ data: {
    eventKey: `dependency:${TBANK_CABINET_WATCHDOG_SOURCE_ID}:${input.type}:${suffix}`,
    type: input.type, title: input.title, body: input.body, href: '/admin/inbox',
    sourceType: 'dependency', sourceId: TBANK_CABINET_WATCHDOG_SOURCE_ID, occurredAt: input.occurredAt,
  } });
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } });
  await prisma.adminInboxReceipt.createMany({ data: admins.map(({ id }) => ({ eventId: event.id, userId: id })), skipDuplicates: true });
  await queueAdminInboxTelegramDelivery({ db: prisma, eventId: event.id });
  return { eventId: event.id, recipients: admins.length };
}

async function main() {
  const path = process.env.TBANK_CABINET_SNAPSHOT_PATH?.trim();
  if (process.env.TBANK_CABINET_SNAPSHOT_ENABLED !== 'true' || !path) {
    console.log(JSON.stringify({ ok: true, skipped: true, reason: 'TBANK_CABINET_SNAPSHOT_DISABLED' }));
    return;
  }
  const probe = await probeTBankCabinetSnapshot({ path });
  const latest = await prisma.adminInboxEvent.findFirst({ where: {
    sourceType: 'dependency', sourceId: TBANK_CABINET_WATCHDOG_SOURCE_ID,
    type: { in: ['dependency.down', 'dependency.recovered'] },
  }, orderBy: { occurredAt: 'desc' } });
  let event = null;
  if (!probe.ok && latest?.type !== 'dependency.down') {
    event = await publish({ ...tbankCabinetWatchdogCopy(probe), occurredAt: probe.checkedAt });
  } else if (probe.ok && latest?.type === 'dependency.down') {
    event = await publish({ ...tbankCabinetWatchdogCopy(probe), occurredAt: probe.checkedAt });
  }
  console.log(JSON.stringify({ ok: probe.ok, errorCode: probe.errorCode ?? null, event }));
}

main().catch((error) => {
  console.error(error instanceof Error && /^[A-Z0-9_]{1,100}$/.test(error.message) ? error.message : 'TBANK_CABINET_WATCHDOG_FAILED');
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
