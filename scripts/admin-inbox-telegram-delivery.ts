import { prisma } from '../lib/prisma';
import {
  claimAdminInboxTelegramDelivery,
  markAdminInboxTelegramDeliveryFailed,
  markAdminInboxTelegramDeliverySent,
} from '../lib/admin-inbox-delivery';

function option(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? String(process.argv[index + 1] ?? '') : '';
}

async function main() {
  const command = process.argv[2] ?? '';
  if (command === 'claim') {
    const delivery = await claimAdminInboxTelegramDelivery(prisma);
    process.stdout.write(`${JSON.stringify({ ok: true, delivery })}\n`);
    return;
  }
  const deliveryId = option('--delivery-id');
  const leaseToken = option('--lease-token');
  if (!deliveryId || !leaseToken) throw new Error('ADMIN_INBOX_DELIVERY_ARGUMENTS_REQUIRED');
  if (command === 'sent') {
    await markAdminInboxTelegramDeliverySent({ db: prisma, deliveryId, leaseToken, externalMessageId: option('--message-id') });
    process.stdout.write(`${JSON.stringify({ ok: true, status: 'sent' })}\n`);
    return;
  }
  if (command === 'failed') {
    const uncertain = process.argv.includes('--uncertain');
    const retryable = process.argv.includes('--retryable');
    await markAdminInboxTelegramDeliveryFailed({ db: prisma, deliveryId, leaseToken, errorCode: option('--error-code'), uncertain, retryable });
    process.stdout.write(`${JSON.stringify({ ok: true, status: uncertain ? 'uncertain' : retryable ? 'pending' : 'failed' })}\n`);
    return;
  }
  throw new Error('ADMIN_INBOX_DELIVERY_COMMAND_INVALID');
}

main().catch((error) => {
  const message = error instanceof Error && /^[A-Z0-9_]{1,100}$/.test(error.message) ? error.message : 'ADMIN_INBOX_DELIVERY_FAILED';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
