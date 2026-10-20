import { getCurrentUser } from '@/lib/auth';
import { loadDailyFiscalReport } from '@/lib/terminal-fiscal-daily-report-loader';
import { validFiscalDay, writeFiscalReport, type SavedFiscalReport } from '@/lib/terminal-fiscal-report-cache';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const pending = new Map<string, Promise<{report:SavedFiscalReport;saved:boolean}>>();
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({error:'Требуется вход'}, {status:401});
  if (user.role !== 'ADMIN') return Response.json({error:'Нет доступа'}, {status:403});
  const day = new URL(request.url).searchParams.get('date') || '';
  if (!validFiscalDay(day)) return Response.json({error:'Некорректная дата'}, {status:400});
  let work = pending.get(day);
  if (!work) {
    work = (async()=>{
      const report = await loadDailyFiscalReport(day);
      const saved = await writeFiscalReport(day, report).catch(()=>false);
      return {report,saved};
    })();
    pending.set(day,work);
    void work.finally(()=>pending.delete(day)).catch(()=>{});
  }
  try { return Response.json(await work, {headers:{'Cache-Control':'private, no-store'}}); }
  catch { return Response.json({error:'Не удалось обновить сверку'}, {status:503,headers:{'Cache-Control':'private, no-store'}}); }
}
