import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '@/lib/prisma';
import { requireAdminApi } from '@/lib/admin-api-auth';
import { detectTaxDocumentCoverage, persistTaxDocument, taxDocumentRequestTooLarge, validateTaxDocumentInput } from '@/lib/tax-document-upload';
import { processAusnDocument, processableTypes } from '@/lib/ausn-processing';
import { taxProcessingJobs } from '@/lib/tax-processing-recovery';

export const dynamic = 'force-dynamic';

type ProcessingArgs = Parameters<typeof processAusnDocument>[0];

// The server recalculates the whole year after each file (3–5 minutes). The
// upload answers at once and the recalculation finishes in the background; the
// page follows it through /api/admin/taxes/documents/status.
async function processInBackground(id: string, input: ProcessingArgs) {
  const jobs = taxProcessingJobs();
  const job = await jobs.begin(id);
  let queued!: () => void;
  const durable = new Promise<void>(resolve => { queued = resolve; });
  let isQueued = false;
  const processing = processAusnDocument({ ...input, requestId: job.attempt, onQueued: () => { isQueued = true; queued(); } })
    .catch(async () => {
      if (!isQueued) {
        await jobs.finish(id, job.attempt, { state: 'failed', message: 'Не удалось передать файл в серверную обработку.' });
        throw new Error('Файл сохранён, но не удалось передать его в обработку. Повторите загрузку.');
      }
      return { status: 'pending' as const, message: 'Результат обработки пока не подтверждён.' };
    });
  // Acknowledge only after the request is persisted (or validation completed).
  await Promise.race([durable, processing.then(() => {})]);
  void processing.then(processing => jobs.finish(id, job.attempt, {
      state: processing.status === 'completed' ? 'done' : processing.status === 'pending' ? 'processing' : 'failed',
      message: processing.message,
    }))
    .catch(error => console.error('TAX_PROCESSING_STATUS_NOT_SAVED', id, error instanceof Error ? error.name : 'Error'));
}

export async function POST(request: Request) {
  const access = await requireAdminApi();
  if (!access.ok) return access.response;
  if (taxDocumentRequestTooLarge(request)) return Response.json({ error: 'Файл слишком большой. Максимальный размер — 12 МБ.' }, { status: 413 });
  let stored: Awaited<ReturnType<typeof persistTaxDocument>> | null = null;
  try {
    const form = await request.formData();
    const input = validateTaxDocumentInput({ documentType: form.get('documentType'), periodKey: form.get('periodKey') });
    const file = form.get('file');
    if (!(file instanceof File)) throw new Error('Выберите файл.');
    stored = await persistTaxDocument(file);
    const coverage = await detectTaxDocumentCoverage({ ...input, originalName: stored.originalName, bytes: stored.bytes, extension: stored.extension });
    const { bytes, extension, ...storedData } = stored;
    const processable = processableTypes.has(input.documentType);
    const acceptedAt = new Date().toISOString();
    const processingInput: ProcessingArgs = { ...input, periodKey: coverage.coverageTo, extension, bytes, sha256: stored.sha256 };
    const existing = await prisma.taxControlDocument.findFirst({ where: { documentType: input.documentType, sha256: stored.sha256 }, select: { id: true, coverageFrom: true, coverageTo: true } });
    if (existing) {
      await unlink(path.join(process.cwd(), 'uploads', stored.storageKey)).catch(() => {});
      stored = null;
      const coverageFrom = [existing.coverageFrom, coverage.coverageFrom].filter((value): value is string => Boolean(value)).sort()[0];
      const coverageTo = [existing.coverageTo, coverage.coverageTo].filter((value): value is string => Boolean(value)).sort().at(-1)!;
      const record = await prisma.taxControlDocument.update({ where: { id: existing.id }, data: { periodKey: coverageTo, coverageFrom, coverageTo }, select: { id: true, documentType: true, periodKey: true, originalName: true, status: true, createdAt: true } });
      if (processable) await processInBackground(record.id, processingInput);
      return Response.json({ document: processable ? { ...record, status: 'UPLOADED' } : record, accepted: processable, acceptedAt, repeated: true, coverage: { ...coverage, coverageFrom, coverageTo } }, { status: processable ? 202 : 200 });
    }
    const record = await prisma.taxControlDocument.create({
      data: { ...input, periodKey: coverage.coverageTo, coverageFrom: coverage.coverageFrom, coverageTo: coverage.coverageTo, ...storedData, uploadedById: access.user.id },
      select: { id: true, documentType: true, periodKey: true, originalName: true, status: true, createdAt: true },
    });
    stored = null; // The database now owns the persisted upload, even if scheduling fails.
    if (processable) await processInBackground(record.id, processingInput);
    return Response.json({ document: processable ? { ...record, status: 'UPLOADED' } : record, accepted: processable, acceptedAt, coverage }, { status: processable ? 202 : 201 });
  } catch (error) {
    if (stored) await unlink(path.join(process.cwd(), 'uploads', stored.storageKey)).catch(() => {});
    const duplicate = typeof error === 'object' && error && 'code' in error && error.code === 'P2002';
    return Response.json({ error: duplicate ? 'Этот файл уже загружен для выбранного периода.' : error instanceof Error ? error.message : 'Не удалось загрузить документ.' }, { status: 400 });
  }
}
