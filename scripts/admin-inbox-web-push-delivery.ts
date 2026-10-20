import { dispatchAdminInboxWebPush } from '../lib/admin-inbox-web-push';
import { refreshPendingExpenseStatuses } from '../lib/expense-request-status-refresh';
import { prisma } from '../lib/prisma';

refreshPendingExpenseStatuses().catch(() => null)
  .then(() => dispatchAdminInboxWebPush())
  .then((result) => process.stdout.write(`${JSON.stringify({ ok: true, ...result })}\n`))
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : 'ADMIN_WEB_PUSH_FAILED'}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
