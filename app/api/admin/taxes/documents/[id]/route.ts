import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '@/lib/prisma';
import { requireAdminApi } from '@/lib/admin-api-auth';

export const dynamic = 'force-dynamic';

function safeDownloadName(value: string) {
  return value.replace(/[\r\n"\\]/g, '_').slice(0, 180) || 'document';
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await requireAdminApi();
  if (!access.ok) return access.response;
  const { id } = await context.params;
  const document = await prisma.taxControlDocument.findUnique({ where: { id }, select: { storageKey: true, originalName: true, mimeType: true } });
  if (!document) return Response.json({ error: 'Документ не найден.' }, { status: 404 });
  try {
    const bytes = await readFile(path.join(process.cwd(), 'uploads', document.storageKey));
    const disposition = new URL(request.url).searchParams.get('download') === '1' ? 'attachment' : 'inline';
    return new Response(bytes, { headers: { 'Content-Type': document.mimeType, 'Content-Disposition': `${disposition}; filename="${safeDownloadName(document.originalName)}"`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch { return Response.json({ error: 'Файл документа недоступен в хранилище.' }, { status: 404 }); }
}
