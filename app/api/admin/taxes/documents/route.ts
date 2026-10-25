import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '@/lib/prisma';
import { requireAdminApi } from '@/lib/admin-api-auth';
import { detectTaxDocumentCoverage, persistTaxDocument, taxDocumentRequestTooLarge, validateTaxDocumentInput } from '@/lib/tax-document-upload';
import { processAusnDocument } from '@/lib/ausn-processing';

export const dynamic = 'force-dynamic';

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
    const { bytes: _bytes, extension: _extension, ...storedData } = stored;
    const existing = await prisma.taxControlDocument.findFirst({ where: { documentType: input.documentType, sha256: stored.sha256 }, select: { id: true, coverageFrom: true, coverageTo: true } });
    if (existing) {
      const processing = await processAusnDocument({ ...input, periodKey: coverage.coverageTo, extension: stored.extension, bytes: stored.bytes, sha256: stored.sha256 }).catch((error) => ({ status: 'failed' as const, message: error instanceof Error ? error.message : 'Не удалось запустить обработку АУСН.' }));
      await unlink(path.join(process.cwd(), 'uploads', stored.storageKey)).catch(() => {});
      stored = null;
      const coverageFrom = [existing.coverageFrom, coverage.coverageFrom].filter((value): value is string => Boolean(value)).sort()[0];
      const coverageTo = [existing.coverageTo, coverage.coverageTo].filter((value): value is string => Boolean(value)).sort().at(-1)!;
      const record = await prisma.taxControlDocument.update({ where: { id: existing.id }, data: { periodKey: coverageTo, coverageFrom, coverageTo, status: processing.status === 'completed' ? 'PROCESSED' : processing.status === 'failed' ? 'PROCESSING_FAILED' : 'UPLOADED' }, select: { id: true, documentType: true, periodKey: true, originalName: true, status: true, createdAt: true } });
      return Response.json({ document: record, processing, coverage: { ...coverage, coverageFrom, coverageTo, note: `${coverage.note} Диапазон существующего файла обновлён без дублирования.` } });
    }
    const record = await prisma.taxControlDocument.create({
      data: { ...input, periodKey: coverage.coverageTo, coverageFrom: coverage.coverageFrom, coverageTo: coverage.coverageTo, ...storedData, uploadedById: access.user.id },
      select: { id: true, documentType: true, periodKey: true, originalName: true, status: true, createdAt: true },
    });
    const processing = await processAusnDocument({ ...input, periodKey: coverage.coverageTo, extension: stored.extension, bytes: stored.bytes, sha256: stored.sha256 }).catch((error) => ({ status: 'failed' as const, message: error instanceof Error ? error.message : 'Не удалось запустить обработку АУСН.' }));
    const updated = processing.status === 'not_required' ? record : await prisma.taxControlDocument.update({ where: { id: record.id }, data: { status: processing.status === 'completed' ? 'PROCESSED' : 'PROCESSING_FAILED' }, select: { id: true, documentType: true, periodKey: true, originalName: true, status: true, createdAt: true } });
    return Response.json({ document: updated, processing, coverage }, { status: 201 });
  } catch (error) {
    if (stored) await unlink(path.join(process.cwd(), 'uploads', stored.storageKey)).catch(() => {});
    const duplicate = typeof error === 'object' && error && 'code' in error && error.code === 'P2002';
    return Response.json({ error: duplicate ? 'Этот файл уже загружен для выбранного периода.' : error instanceof Error ? error.message : 'Не удалось сохранить документ.' }, { status: 400 });
  }
}
