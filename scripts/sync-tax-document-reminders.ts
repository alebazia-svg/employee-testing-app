import { prisma } from '../lib/prisma';
import { syncTaxControlReminders } from '../lib/tax-document-reminders';

syncTaxControlReminders(prisma)
  .then((result) => console.log(JSON.stringify(result)))
  .finally(() => prisma.$disconnect());
