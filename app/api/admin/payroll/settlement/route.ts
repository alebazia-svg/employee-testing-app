import { requireAdminApi } from '@/lib/admin-api-auth';
import { payrollSettlementWindow } from '@/lib/payroll-settlement-window';
import { readPayrollSettlementSource } from '@/lib/payroll-settlement-source';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const periodKey = new URL(request.url).searchParams.get('period') ?? '';
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Moscow' }).format(new Date());
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(periodKey) || periodKey > today.slice(0, 7)) return Response.json({ error: 'Выберите прошедший или текущий месяц.' }, { status: 400 });
  const window = payrollSettlementWindow(periodKey, today);
  if (!window) return Response.json({ error: 'Некорректный период проверки.' }, { status: 400 });
  const headers = { 'Cache-Control': 'no-store' };
  try {
    return Response.json(await readPayrollSettlementSource(periodKey, today, new URL(request.url).searchParams.get('refresh') === '1'), { headers });
  } catch {
    return Response.json({ error: 'Не удалось проверить выплаты в 1С. Суммы не заменены нулями. Попробуйте ещё раз.' }, { status: 503, headers });
  }
}
