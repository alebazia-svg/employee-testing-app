import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { requireAdminApi } from '@/lib/admin-api-auth';
import { prisma } from '@/lib/prisma';
import { getPayrollOneCAdvances } from '@/lib/payroll-one-c-control-source';
import type { PayrollAdvanceRead } from '@/lib/payroll-one-c-advances';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const pending = new Map<string, Promise<PayrollAdvanceRead>>();
const TTL = 5 * 60 * 1000;

export async function GET(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const periodKey = new URL(request.url).searchParams.get('period') ?? '';
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Moscow' }).format(new Date());
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(periodKey) || periodKey > today.slice(0, 7)) {
    return Response.json({ error: 'Некорректный месяц авансов.' }, { status: 400 });
  }
  const [year, month] = periodKey.split('-').map(Number);
  const dateFrom = `${periodKey}-01`;
  // The regular settlement window includes the following month. Final payroll
  // snapshots are never changed by this independent read-only 1C source.
  const end = new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10);
  const dateTo = end < today ? end : today;
  const where = { periodKey_kind_dateFrom_dateTo: { periodKey, kind: 'ADVANCES_V1', dateFrom, dateTo: end } };
  try {
    const saved = await prisma.payrollOneCControlSnapshot.findUnique({ where });
    const cached = saved?.payload as PayrollAdvanceRead | undefined;
    if (cached?.version === 1 && cached.periodKey === periodKey && cached.dateTo === dateTo
      && Date.now() - new Date(cached.checkedAt).getTime() < TTL) {
      return Response.json(cached, { headers: { 'Cache-Control': 'no-store' } });
    }
    let task = pending.get(periodKey);
    if (!task) {
      task = (async () => {
        const data = await getPayrollOneCAdvances(periodKey, dateFrom, dateTo);
        const contentHash = createHash('sha256').update(JSON.stringify({ documents: data.documents, issues: data.issues })).digest('hex');
        const values = { payload: data as unknown as Prisma.InputJsonValue, payloadVersion: 1, contentHash, sourceCheckedAt: new Date(data.checkedAt) };
        await prisma.payrollOneCControlSnapshot.upsert({ where,
          create: { ...where.periodKey_kind_dateFrom_dateTo, ...values },
          update: { ...values, revision: { increment: 1 } },
        });
        return data;
      })().finally(() => pending.delete(periodKey));
      pending.set(periodKey, task);
    }
    return Response.json(await task, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    // Never replace a failed read with zero advances or overwrite last-good data.
    return Response.json({ error: 'Авансы из 1С не проверены. Остаток к выплате пока не подтверждён.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
