import { prisma } from '../lib/prisma';
import { fetchDeliveryCash } from '../lib/procurement-delivery-source';
import { syncDeliveryReminder } from '../lib/procurement-delivery-reminders';

async function main() {
  if (!process.argv.includes('--confirm-portal-write')) {
    await fetchDeliveryCash();
    console.log(JSON.stringify({ ok: true, sourceComplete: true, persisted: false }));
    return;
  }
  const view = await syncDeliveryReminder();
  console.log(JSON.stringify({ ok: true, sourceComplete: true, persisted: true, reminderActive: view.requested }));
}
main().catch(() => { console.error('DELIVERY_SYNC_FAILED'); process.exitCode = 1; }).finally(() => prisma.$disconnect());
