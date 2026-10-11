import { requireAdminApi } from '@/lib/admin-api-auth';
import { expenseRequestMoscowCalendarDate } from '@/lib/expense-request-source';
import { loadAdminForecastSources } from '@/lib/procurement-admin-forecast-source';

export const dynamic = 'force-dynamic';
export async function GET() {
  const access = await requireAdminApi();
  if (!access.ok) return access.response;
  const headers = { 'Cache-Control': 'private, no-store' };
  try {
  const data = await loadAdminForecastSources(expenseRequestMoscowCalendarDate(new Date()));
  if (!data.owner?.money?.complete && !data.payroll?.sourceComplete &&
      data.tbank?.status !== 'verified' && !data.debts?.calculationReady) {
    return Response.json({error:'Не удалось обновить прогноз. Попробуйте ещё раз.'}, {status:503,headers});
  }
  return Response.json(data, {headers});
  } catch {
    return Response.json({error:'Не удалось обновить прогноз. Попробуйте ещё раз.'}, {status:503,headers});
  }
}
