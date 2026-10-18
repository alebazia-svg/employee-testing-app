import { requireAdminApi } from '@/lib/admin-api-auth';
import { payrollSettlementWindow } from '@/lib/payroll-settlement-window';
import { getPayrollOneCBalances, getPayrollOneCCashPayments, getPayrollOneCLedger } from '@/lib/payroll-one-c-control-source';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
type Result = { balance: Awaited<ReturnType<typeof getPayrollOneCBalances>>; cash: Awaited<ReturnType<typeof getPayrollOneCCashPayments>>; ledger: Awaited<ReturnType<typeof getPayrollOneCLedger>>; periodKey: string };
const cache = new Map<string, { at: number; value: Result }>();
const pending = new Map<string, Promise<Result>>();
export async function GET(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const periodKey = new URL(request.url).searchParams.get('period') ?? '';
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Moscow' }).format(new Date());
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(periodKey) || periodKey > today.slice(0, 7)) return Response.json({ error: 'Выберите прошедший или текущий месяц.' }, { status: 400 });
  const window = payrollSettlementWindow(periodKey, today);
  if (!window) return Response.json({ error: 'Некорректный период проверки.' }, { status: 400 });
  const { dateFrom, dateTo } = window;
  const key = `${periodKey}:${today}`;
  const headers = { 'Cache-Control': 'no-store' };
  try {
    const saved = cache.get(key);
    if (saved && Date.now() - saved.at < 300000 && new URL(request.url).searchParams.get('refresh') !== '1') return Response.json(saved.value, { headers });
    let task = pending.get(key);
    if (!task) {
      task = (async () => {
        const balance = await getPayrollOneCBalances(today);
        const cash = await getPayrollOneCCashPayments(dateFrom, dateTo);
        const ledger = await getPayrollOneCLedger(dateFrom, dateTo);
        const value = { balance, cash, ledger, periodKey };
        if (cache.size >= 24) cache.delete(cache.keys().next().value!);
        cache.set(key, { at: Date.now(), value });
        return value;
      })().finally(() => pending.delete(key));
      pending.set(key, task);
    }
    return Response.json(await task, { headers });
  } catch {
    return Response.json({ error: 'Не удалось проверить выплаты в 1С. Суммы не заменены нулями. Попробуйте ещё раз.' }, { status: 503, headers });
  }
}
