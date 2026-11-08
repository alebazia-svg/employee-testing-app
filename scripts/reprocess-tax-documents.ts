import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../lib/prisma';
import { taxProcessingJobs } from '../lib/tax-processing-recovery';
import { processAusnDocument } from '../lib/ausn-processing';

const processable = new Set(['AUSN_INCOME', 'ENS_OPERATIONS', 'AUSN_CALCULATION']);

async function main() {
  const documents = await prisma.taxControlDocument.findMany({ where: { documentType: { in: [...processable] } }, orderBy: { createdAt: 'desc' } });
  const latest = documents.filter((document, index, rows) => rows.findIndex((item) => item.documentType === document.documentType) === index);
  const results = [];
  for (const document of latest) {
    const extension = document.storageKey.split('.').at(-1) || '';
    const bytes = new Uint8Array(await readFile(path.join(process.cwd(), 'uploads', document.storageKey)));
    const jobs = taxProcessingJobs();
    const job = await jobs.begin(document.id);
    const result = await processAusnDocument({ requestId: job.attempt, documentType: document.documentType, periodKey: document.coverageTo || document.periodKey, extension, bytes, sha256: document.sha256 });
    await jobs.finish(document.id, job.attempt, { state: result.status === 'completed' ? 'done' : result.status === 'pending' ? 'processing' : 'failed', message: result.message });
    results.push({ id: document.id, documentType: document.documentType, status: result.status, message: result.message });
    if (result.status !== 'completed') break;
  }
  process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
  if (results.some((item) => item.status !== 'completed')) process.exitCode = 1;
}

main().finally(() => prisma.$disconnect());
