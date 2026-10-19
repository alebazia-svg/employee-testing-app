import type { PayrollAttendanceSourceSummary } from '@/lib/payroll-attendance-snapshot';

const shortDate = (date: string) => date.slice(8) + '.' + date.slice(5, 7);

export default function PayrollAttendanceSourceNote({ source }: { source: PayrollAttendanceSourceSummary }) {
  return (
    <div className='mb-3 rounded-lg border border-border bg-slate-50 px-3 py-2 text-sm text-slate-700'>
      <p className='font-semibold text-slate-900'>Дни из приложения с {source.fromDate.split('-').reverse().join('.')}</p>
      <p>Из приложения: {source.appDates.length} дн. Google Sheets — резерв, если нет отметки приложения.</p>
      {source.googleFallbackDates.length > 0 && <p>Из резерва: {source.googleFallbackDates.length} дн. — {source.googleFallbackDates.map(shortDate).join(', ')}.</p>}
      {source.overlapDates.length > 0 && <p>Совпадения за {source.overlapDates.map(shortDate).join(', ')} учтены один раз.</p>}
      <p className='mt-1 text-xs text-slate-500'>Дни до перехода и опоздания — по прежним правилам Google Sheets. Открытая смена учитывается по факту начала дня.</p>
    </div>
  );
}
