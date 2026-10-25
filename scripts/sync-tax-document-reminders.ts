import { prisma } from '../lib/prisma';
import { syncTaxDocumentReminder } from '../lib/tax-document-reminders';

syncTaxDocumentReminder(prisma)
  .then((result) => console.log(JSON.stringify(result)))
  .finally(() => prisma.$disconnect());
