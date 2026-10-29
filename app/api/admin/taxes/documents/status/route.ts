import { prisma } from '@/lib/prisma';
import { requireAdminApi } from '@/lib/admin-api-auth';
import { loadPortalReports } from '@/lib/ausn-portal-view';
import { reportChanges } from '@/lib/ausn-month-review';
import { taxProcessingNote } from '@/lib/tax-processing-status';

export const dynamic = 'force-dynamic';

const stamp = (file: string) => {
  const match = file.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})\.md$/);
  return match ? Date.UTC(+match[1], +match[2] - 1, +match[3], +match[4], +match[5], +match[6]) : 0;
};

// Status of one uploaded file while the server recalculates, and what changed.
export async function GET(request: Request) {
  const access = await requireAdminApi();
  if (!access.ok) return access.response;
  const url = new URL(request.url);
  const id = url.searchParams.get('id') || '';
  const since = Date.parse(url.searchParams.get('since') || '');
  const document = await prisma.taxControlDocument.findUnique({ where: { id }, select: { status: true } });
  if (!document) return Response.json({ error: 'Документ не найден.' }, { status: 404 });
  const note = taxProcessingNote(id);
  const state = document.status === 'PROCESSED' ? 'done' : document.status === 'PROCESSING_FAILED' ? 'failed' : 'processing';
  let changes: string[] = [];
  if (state === 'done' && Number.isFinite(since)) {
    const fulls = (await loadPortalReports().catch(() => [])).filter((report) => report.kind === 'full');
    const before = fulls.find((report) => stamp(report.sourceFile) < since);
    changes = reportChanges(before, fulls[0]);
  }
  const reason = note?.message && /[а-яё]/i.test(note.message) ? note.message : note?.message && /does not match|columns|must contain/i.test(note.message) ? 'Файл не похож на выбранный вид выгрузки. Проверьте, что загружаете нужный документ.' : undefined;
  return Response.json({ state, message: state === 'failed' ? reason || 'Сервер не смог обработать файл. Загрузите его ещё раз; если повторится — напишите разработчику.' : undefined, changes });
}
