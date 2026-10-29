import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '@/lib/prisma';
import { requireAdminApi } from '@/lib/admin-api-auth';
import { detectTaxDocumentCoverage, persistTaxDocument, taxDocumentRequestTooLarge, validateTaxDocumentInput } from '@/lib/tax-document-upload';
import { processAusnDocument, processableTypes } from '@/lib/ausn-processing';
import { rememberTaxProcessing } from '@/lib/tax-processing-status';

export const dynamic = 'force-dynamic';

type ProcessingArgs = Parameters<typeof processAusnDocument>[0];

// The server recalculates the whole year after each file (3–5 minutes). The
// upload answers at once and the recalculation finishes in the background; the
// page follows it through /api/admin/taxes/documents/status.
function processInBackground(id: string, input: ProcessingArgs) {
  rememberTaxProcessing(id, { state: 'processing' });
  void processAusnDocument(input)
    .catch((error) => ({ status: 'failed' as const, message: error instanceof Error ? error.message : 'Не удалось запустить обработку АУСН.' }))
    .then(async (processing) => {
      rememberTaxProcessing(id, { state: processing.status === 'completed' ? 'done' : 'failed', message: processing.message });
      await prisma.taxControlDocument.update({ where: { id }, data: { status: processing.status === 'completed' ? 'PROCESSED' : 'PROCESSING_FAILED' } }).catch(() => {});
    });
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
      const record = await prisma.taxControlDocument.update({ where: { id: existing.id }, data: { periodKey: coverageTo, coverageFrom, coverageTo, ...(processable ? { status: 'UPLOADED' } : {}) }, select: { id: true, documentType: true, periodKey: true, originalName: true, status: true, createdAt: true } });
      if (processable) processInBackground(record.id, processingInput);
      return Response.json({ document: record, accepted: processable, acceptedAt, repeated: true, coverage: { ...coverage, coverageFrom, coverageTo } }, { status: processable ? 202 : 200 });
    }
    const record = await prisma.taxControlDocument.create({
      data: { ...input, periodKey: coverage.coverageTo, coverageFrom: coverage.coverageFrom, coverageTo: coverage.coverageTo, ...storedData, uploadedById: access.user.id },
      select: { id: true, documentType: true, periodKey: true, originalName: true, status: true, createdAt: true },
    });
    if (processable) processInBackground(record.id, processingInput);
    return Response.json({ document: record, accepted: processable, acceptedAt, coverage }, { status: processable ? 202 : 201 });
  } catch (error) {
    if (stored) await unlink(path.join(process.cwd(), 'uploads', stored.storageKey)).catch(() => {});
    const duplicate = typeof error === 'object' && error && 'code' in error && error.code === 'P2002';
    return Response.json({ error: duplicate ? 'Этот файл уже загружен для выбранного периода.' : error instanceof Error ? error.message : 'Не удалось загрузить документ.' }, { status: 400 });
  }
}
