import { AlertTriangle, CheckCircle2, Clock3, ServerOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { terminalFiscalReasonLabel, terminalFiscalReasonTimes } from '@/lib/terminal-fiscal-reason-view';
import { presentTerminalFiscalWorkdaySummary, type TerminalFiscalWorkdaySummary } from '@/lib/terminal-fiscal-summary';
import { formatTime } from '@/lib/workday';

export function TerminalFiscalAdminSummary({ summary }: { summary: TerminalFiscalWorkdaySummary | null }) {
  const presentation = presentTerminalFiscalWorkdaySummary(summary);
  if (!summary) {
    return (
      <Card className='flex items-center gap-3 px-4 py-3'>
        <Clock3 className='h-5 w-5 shrink-0 text-slate-400' aria-hidden='true' />
        <div className='min-w-0'>
          <p className='font-extrabold text-slate-900'>Сверка оплат</p>
          <p className='text-sm font-medium text-slate-500'>{presentation.detail}</p>
        </div>
        <Badge className='ml-auto shrink-0 bg-slate-100 text-slate-700'>{presentation.label}</Badge>
      </Card>
    );
  }

  const states = {
    mismatch: { className: 'bg-rose-100 text-rose-800', icon: AlertTriangle, iconClass: 'text-rose-600' },
    needs_review: { className: 'bg-amber-100 text-amber-800', icon: AlertTriangle, iconClass: 'text-amber-600' },
    unavailable: { className: 'bg-slate-100 text-slate-700', icon: ServerOff, iconClass: 'text-slate-500' },
    pending: { className: 'bg-blue-100 text-blue-800', icon: Clock3, iconClass: 'text-blue-600' },
    confirmed: { className: 'bg-green-100 text-green-800', icon: CheckCircle2, iconClass: 'text-green-600' },
  } as const;
  const state = states[presentation.status as keyof typeof states];
  const Icon = state.icon;
  const detailRecords = summary.attributionRecords?.filter((record) => (
    record.status === 'needs_review' || record.status === 'mismatch' || record.status === 'unavailable'
  )) ?? [];
  const detailReasons = [...new Set(detailRecords.map((record) => record.reasonCode))];

  if (detailReasons.length > 0) {
    return (
      <Card className='p-0'>
        <details className='group'>
          <summary className='flex cursor-pointer list-none flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center'>
            <div className='flex min-w-0 items-center gap-3'>
              <Icon className={`h-5 w-5 shrink-0 ${state.iconClass}`} aria-hidden='true' />
              <div className='min-w-0'>
                <p className='font-extrabold text-slate-900'>Сверка оплат</p>
                <p className='text-sm font-semibold text-slate-600'>{presentation.detail}</p>
                {summary.lastCompletedAt && <p className='mt-0.5 text-xs font-medium text-slate-400'>Обновлено {formatTime(summary.lastCompletedAt)}</p>}
              </div>
            </div>
            <span className={`w-fit shrink-0 rounded-full px-3 py-1 text-xs font-extrabold sm:ml-auto ${state.className} group-open:hidden`}>Открыть</span>
            <span className={`hidden w-fit shrink-0 rounded-full px-3 py-1 text-xs font-extrabold sm:ml-auto ${state.className} group-open:inline`}>Свернуть</span>
          </summary>
          <div className='grid gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3'>
            {detailReasons.map((reasonCode) => {
              const reasonRecords = detailRecords.filter((record) => record.reasonCode === reasonCode);
              const times = terminalFiscalReasonTimes(reasonRecords, reasonCode);
              return (
                <div key={reasonCode} className='rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200'>
                  <p className='text-sm font-extrabold text-slate-900'>{terminalFiscalReasonLabel(reasonCode)}</p>
                  <p className='mt-0.5 text-xs font-semibold text-slate-600'>
                    {times.length > 0 ? `${times.join(', ')} · ` : ''}{reasonRecords.length} {reasonRecords.length === 1 ? 'операция' : 'операции'}
                  </p>
                </div>
              );
            })}
            <p className='text-xs font-semibold text-slate-500'>Технически неполные источники не считаются ошибкой сотрудника. Здесь показана причина каждого неподтверждённого результата.</p>
          </div>
        </details>
      </Card>
    );
  }

  return (
    <Card className='flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center'>
      <div className='flex min-w-0 items-center gap-3'>
        <Icon className={`h-5 w-5 shrink-0 ${state.iconClass}`} aria-hidden='true' />
        <div className='min-w-0'>
          <p className='font-extrabold text-slate-900'>Сверка оплат</p>
          <p className='text-sm font-semibold text-slate-600'>{presentation.detail}</p>
          {summary.lastCompletedAt && <p className='mt-0.5 text-xs font-medium text-slate-400'>Обновлено {formatTime(summary.lastCompletedAt)}</p>}
        </div>
      </div>
      <Badge className={`w-fit shrink-0 sm:ml-auto ${state.className}`}>{presentation.label}</Badge>
    </Card>
  );
}
