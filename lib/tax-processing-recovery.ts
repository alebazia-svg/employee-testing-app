import { prisma } from './prisma';
import { createTaxProcessingJobs, type TaxJobLock } from './tax-processing-jobs';

const lock: TaxJobLock = (id, task) => prisma.$transaction(async tx => {
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(20261108, hashtext(${id}))`;
  return task({ setStatus: async status => {
    await tx.taxControlDocument.updateMany({ where: { id, status: { not: status } }, data: { status } });
  } });
}, { maxWait: 5_000, timeout: 10_000 });

export const taxProcessingJobs = () => createTaxProcessingJobs(process.env.AUSN_PORTAL_INTAKE_DIR || '/app/runtime/ausn-intake', lock);

export async function reconcileTaxDocumentStatuses<T extends { id: string; status: string; documentType: string }>(documents: T[]): Promise<T[]> {
  const jobs = taxProcessingJobs();
  const output = [...documents];
  // Bound DB connections and file reads even when the archive is large.
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(4, documents.length) }, async () => {
    while (next < documents.length) {
      const index = next++;
      const document = documents[index];
      if (!['UPLOADED', 'PROCESSING_FAILED'].includes(document.status) || !['AUSN_INCOME', 'ENS_OPERATIONS', 'AUSN_CALCULATION'].includes(document.documentType)) continue;
      const job = await jobs.reconcile(document.id).catch(() => null);
      if (job) output[index] = { ...document, status: job.state === 'done' ? 'PROCESSED' : job.state === 'failed' ? 'PROCESSING_FAILED' : 'UPLOADED' };
    }
  }));
  return output;
}
