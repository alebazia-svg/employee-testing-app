import { prisma } from '../lib/prisma';
import { reconcileTaxDocumentStatuses } from '../lib/tax-processing-recovery';
import { syncTaxControlReminders } from '../lib/tax-document-reminders';

prisma.taxControlDocument.findMany({ where: { status: { in: ['UPLOADED', 'PROCESSING_FAILED'] }, documentType: { in: ['AUSN_INCOME', 'ENS_OPERATIONS', 'AUSN_CALCULATION'] } }, select: { id: true, status: true, documentType: true } })
  .then(reconcileTaxDocumentStatuses)
  .then(() => syncTaxControlReminders(prisma))
  .then((result) => console.log(JSON.stringify(result)))
  .finally(() => prisma.$disconnect());
