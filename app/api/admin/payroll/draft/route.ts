import { prisma } from '@/lib/prisma';
import { requireAdminApi } from '@/lib/admin-api-auth';
import { validateFinboxPeriod } from '@/lib/payroll-finbox-input';
import { validatePayrollDraft, validatePayrollDraftWrite } from '@/lib/payroll-draft';
import { PayrollDraftConflict, savePayrollDraft } from '@/lib/payroll-draft-store';
import { payrollFeatureState } from '@/lib/payroll-features';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' };
function enabled() { return payrollFeatureState().draftsEnabled; }

export async function GET(req: Request) {
  const access = await requireAdminApi(); if (!access.ok) return access.response;
  if (!enabled()) return Response.json({ error: 'Раздел недоступен.' }, { status: 404, headers });
  let periodKey: string;
  try { periodKey = validateFinboxPeriod(new URL(req.url).searchParams.get('period')); }
  catch { return Response.json({ error: 'Выберите месяц зарплаты.' }, { status: 400, headers }); }
  try {
    if (new URL(req.url).searchParams.get('history') === '1') {
      const records = await prisma.payrollDraftRevision.findMany({ where: { periodKey }, orderBy: { revision: 'desc' }, take: 20 });
      const authors = await prisma.user.findMany({ where: { id: { in: [...new Set(records.map(row => row.createdByUserId))] } }, select: { id: true, name: true } });
      const names = new Map(authors.map(row => [row.id, row.name]));
      return Response.json({ periodKey, records: records.map(row => ({ revision: row.revision, savedAt: row.createdAt.toISOString(), author: names.get(row.createdByUserId) ?? 'Администратор', payload: validatePayrollDraft(row.payload) })) }, { headers });
    }
    const [saved, period] = await prisma.$transaction([
      prisma.payrollDraftRevision.findFirst({ where: { periodKey }, orderBy: { revision: 'desc' } }),
      prisma.payrollPeriod.findUnique({ where: { periodKey }, select: { status: true, runs: { where: { status: 'FINAL' }, select: { id: true } } } }),
    ], { isolationLevel: 'RepeatableRead' });
    return Response.json({ periodKey, revision: saved?.revision ?? 0, savedAt: saved?.createdAt.toISOString() ?? null,
      payload: saved ? validatePayrollDraft(saved.payload) : null, locked: period?.status === 'CLOSED' || Boolean(period?.runs.length) }, { headers });
  } catch { return Response.json({ error: 'Не удалось загрузить сохранённые правки. Повторите попытку.' }, { status: 503, headers }); }
}
export async function PUT(req: Request) {
  const access = await requireAdminApi(); if (!access.ok) return access.response;
  if (!enabled()) return Response.json({ error: 'Раздел недоступен.' }, { status: 404, headers });
  const raw = await req.text();
  if (raw.length > 256_000) return Response.json({ error: 'Слишком большой объём правок.' }, { status: 413, headers });
  let input: ReturnType<typeof validatePayrollDraftWrite>;
  try { input = validatePayrollDraftWrite(JSON.parse(raw)); }
  catch { return Response.json({ error: 'Проверьте введённые дни, суммы и комментарии.' }, { status: 400, headers }); }
  try { return Response.json(await savePayrollDraft(prisma, input, access.user.id), { headers }); }
  catch (error) {
    if (error instanceof PayrollDraftConflict) return Response.json({ error: error.message === 'PERIOD_LOCKED'
      ? 'Месяц закрыт или уже утверждён. Финальный расчёт не изменён.'
      : 'Правки изменились в другом окне. Загрузите сохранённые данные и сравните их перед повтором.' }, { status: 409, headers });
    return Response.json({ error: 'Сохранение не подтверждено. Ваш ввод оставлен на экране; повторите сохранение.' }, { status: 503, headers });
  }
}
