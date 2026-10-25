import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '@/lib/prisma';
import { requireAdminApi } from '@/lib/admin-api-auth';
import { persistTaxDocument, taxDocumentRequestTooLarge, validateTaxDocumentInput } from '@/lib/tax-document-upload';

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
    const record = await prisma.taxControlDocument.create({
      data: { ...input, coverageFrom: input.periodKey, coverageTo: input.periodKey, ...stored, uploadedById: access.user.id },
      select: { id: true, documentType: true, periodKey: true, originalName: true, status: true, createdAt: true },
    });
    return Response.json({ document: record }, { status: 201 });
  } catch (error) {
    if (stored) await unlink(path.join(process.cwd(), 'uploads', stored.storageKey)).catch(() => {});
    const duplicate = typeof error === 'object' && error && 'code' in error && error.code === 'P2002';
    return Response.json({ error: duplicate ? 'Этот файл уже загружен для выбранного периода.' : error instanceof Error ? error.message : 'Не удалось сохранить документ.' }, { status: 400 });
  }
}
