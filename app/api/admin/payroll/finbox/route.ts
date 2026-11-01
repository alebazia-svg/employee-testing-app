import { prisma } from '@/lib/prisma';
import { requireAdminApi } from '@/lib/admin-api-auth';
import { validateFinboxPeriod, validateFinboxWrite } from '@/lib/payroll-finbox-input';
import { payrollCorrectionMatches } from '@/lib/payroll-correction';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const access = await requireAdminApi();
  if (!access.ok) return access.response;
  let periodKey: string;
  try { periodKey = validateFinboxPeriod(new URL(req.url).searchParams.get('period')); }
  catch (error) { return Response.json({ error: (error as Error).message }, { status: 400 }); }
  const [record, period] = await Promise.all([
    prisma.payrollFinboxRevision.findFirst({ where: { periodKey }, orderBy: { revision: 'desc' } }),
    prisma.payrollPeriod.findUnique({ where: { periodKey }, include: { runs: { where: { status: 'FINAL' }, select: { id: true, createdAt: true, manualInputs: { where: { inputType: 'sales', employeeName: 'Кумахова Диана' }, select: { agentCreditCommission: true } } } } } }),
  ]);
  const correctionId = Number(new URL(req.url).searchParams.get('correctionRunId')) || undefined;
  const correcting = payrollCorrectionMatches(period?.runs[0]?.id, correctionId);
  if (correctionId && !correcting) return Response.json({ error: 'Финальная ведомость изменилась. Откройте её заново.' }, { status: 409 });
  const lockReason = period?.status === 'CLOSED' ? 'Месяц закрыт. Сначала откройте период.' : period?.runs.length && !correcting ? 'Есть финальная ведомость. Изменение её агентских выполняется через пересчёт и замену финального расчёта.' : '';
  const final = period?.runs[0];
  const amount = final && !correcting ? final.manualInputs[0]?.agentCreditCommission || null : record ? (record.amountCents / 100).toFixed(2) : final?.manualInputs[0]?.agentCreditCommission || null;
  return Response.json({ periodKey, amount, revision: record?.revision ?? 0, savedAt: (correcting ? record?.createdAt : final?.createdAt ?? record?.createdAt)?.toISOString() ?? null, locked: Boolean(lockReason), lockReason });
}

export async function PUT(req: Request) {
  const access = await requireAdminApi();
  if (!access.ok) return access.response;
  let input: ReturnType<typeof validateFinboxWrite>;
  try { input = validateFinboxWrite(await req.json()); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Некорректные данные.' }, { status: 400 }); }
  try {
    const correctionId = Number(req.headers.get('X-Payroll-Correction-Run')) || undefined;
    const saved = await prisma.$transaction(async tx => {
      // Serialize Finbox revisions on the existing period; never update saved runs.
      const period = await tx.payrollPeriod.upsert({ where: { periodKey: input.period }, update: {}, create: { periodKey: input.period, year: Number(input.period.slice(0, 4)), month: Number(input.period.slice(5)) - 1 } });
      const locked = await tx.$queryRaw<Array<{status: string}>>`SELECT "status" FROM "PayrollPeriod" WHERE "id" = ${period.id} FOR UPDATE`;
      const final = await tx.payrollRun.findFirst({ where: { periodId: period.id, status: 'FINAL' }, select: { id: true } });
      if (locked[0]?.status === 'CLOSED' || final && !payrollCorrectionMatches(final.id, correctionId)
        || correctionId && !payrollCorrectionMatches(final?.id, correctionId)) throw new Error('PERIOD_LOCKED');
      const current = await tx.payrollFinboxRevision.findFirst({ where: { periodKey: input.period }, orderBy: { revision: 'desc' } });
      if ((current?.revision ?? 0) !== input.revision) throw new Error('REVISION_CONFLICT');
      return tx.payrollFinboxRevision.create({ data: { periodKey: input.period, revision: input.revision + 1, amountCents: input.amountCents, createdByUserId: access.user.id } });
    }, { isolationLevel: 'Serializable' });
    return Response.json({ periodKey: saved.periodKey, amount: (saved.amountCents / 100).toFixed(2), revision: saved.revision, savedAt: saved.createdAt.toISOString(), locked: false, lockReason: '' });
  } catch (error) {
    if (error instanceof Error && error.message === 'PERIOD_LOCKED') return Response.json({ error: 'Месяц закрыт или уже имеет финальную ведомость. Данные не изменены.' }, { status: 409 });
    if (error instanceof Error && error.message === 'REVISION_CONFLICT') return Response.json({ error: 'Сумму уже изменили в другом окне. Обновите данные и проверьте её перед повторным сохранением.' }, { status: 409 });
    return Response.json({ error: 'Не удалось подтвердить сохранение. Обновите данные перед повтором.' }, { status: 500 });
  }
}
