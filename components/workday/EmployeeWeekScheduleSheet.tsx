'use client';

import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { weekSheetCanSave, weekSheetChanges, type WeekSheetDay, type WeekSheetStatus } from '@/lib/schedule-week-sheet';

/**
 * Approved 2026-11-08: one simple question «Ваши дни на неделю». Built from the
 * same material sheet, choice buttons and actions as «Изменить мой день».
 */
export function EmployeeWeekScheduleSheet({ days, through, lastWeek, saving, error, coverageWarning, onSave, onClose, onOpenMonth }: {
  days: WeekSheetDay[];
  through: string;
  lastWeek: Record<string, WeekSheetStatus | undefined>;
  saving: boolean;
  error: string;
  coverageWarning: (draft: Record<string, WeekSheetStatus | null>) => string;
  onSave: (draft: Record<string, WeekSheetStatus | null>, confirmedCoverage: boolean) => void;
  onClose: () => void;
  onOpenMonth: () => void;
}) {
  const [draft, setDraft] = useState<Record<string, WeekSheetStatus | null>>(() => Object.fromEntries(days.map((day) => [day.date, day.status])));
  const [confirming, setConfirming] = useState(false);
  useEffect(() => { setConfirming(false); }, [draft]);
  const canSave = weekSheetCanSave(days, draft);
  const changed = weekSheetChanges(days, draft).length > 0;
  const warning = useMemo(() => coverageWarning(draft), [coverageWarning, draft]);
  const hasLastWeek = days.some((day) => !day.vacation && lastWeek[day.date]);
  const toggle = (date: string, status: WeekSheetStatus) => setDraft((current) => ({ ...current, [date]: current[date] === status ? null : status }));
  const copyLastWeek = () => setDraft((current) => {
    const next = { ...current };
    for (const day of days) if (!day.vacation && lastWeek[day.date]) next[day.date] = lastWeek[day.date]!;
    return next;
  });
  const save = () => {
    if (!canSave || saving) return;
    if (!changed) { onClose(); return; }
    if (warning && !confirming) { setConfirming(true); return; }
    onSave(draft, Boolean(warning));
  };

  return (
    <div className='employee-workday-sheet-overlay fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/45 backdrop-blur-[2px]' role='dialog' aria-modal='true' aria-label='Ваши дни на неделю'
      onKeyDown={(event) => { if (event.key === 'Escape' && !saving) { event.preventDefault(); onClose(); } }}
      onClick={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <div className='employee-material-sheet max-h-[92dvh] w-full max-w-[520px] overflow-y-auto rounded-t-[28px] px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-5'>
        <div className='mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-300' aria-hidden='true' />
        <div className='flex items-center justify-between gap-3'>
          <p className='text-xs font-black uppercase tracking-[0.14em] text-slate-600'>График</p>
          <button type='button' className='flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100' aria-label='Закрыть' disabled={saving} onClick={onClose}>
            <X className='h-5 w-5' />
          </button>
        </div>
        <h2 className='mt-2 text-2xl font-black leading-tight text-slate-950'>Ваши дни на неделю</h2>
        <p className='mt-2 text-sm font-semibold text-slate-600'>Заполните сегодня и завтра. Остальные дни можно отметить заранее.</p>
        <div className='mt-4 overflow-hidden rounded-2xl border border-slate-200'>
          {days.map((day, index) => {
            const value = draft[day.date];
            return (
              <div key={day.date} className={cn('flex items-center justify-between gap-2 py-1 pl-3 pr-1.5', index > 0 && 'border-t border-slate-100', day.highlight && 'bg-[#fbf6f0]')}>
                <span className={cn('min-w-0 text-sm leading-tight', day.highlight ? 'font-black text-slate-950' : 'font-semibold text-slate-700')}>{day.label}</span>
                {day.vacation ? (
                  <span className='px-3 py-2.5 text-sm font-bold text-slate-500'>Отпуск</span>
                ) : (
                  <div className='flex shrink-0 gap-1'>
                    {(['working', 'off'] as const).map((status) => (
                      <button key={status} type='button' disabled={saving} aria-pressed={value === status}
                        className={cn('employee-material-schedule-choice inline-flex h-10 items-center gap-1 rounded-xl px-2.5 text-[13px] font-black', value === status ? (status === 'working' ? 'is-working' : 'is-off') : 'employee-material-secondary-action text-slate-800')}
                        onClick={() => toggle(day.date, status)}>
                        {status === 'working' ? 'Работаю' : 'Выходной'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {confirming && warning && (
          <div className='employee-material-alert-card mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3'>
            <p className='text-sm font-extrabold text-amber-950'>Проверьте состав отдела</p>
            <p className='mt-1 text-sm font-semibold leading-relaxed text-amber-900'>{warning}</p>
          </div>
        )}
        {error && <p role='alert' className='mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-700'>{error}</p>}
        {hasLastWeek && (
          <button type='button' className='employee-material-secondary-action mt-3 h-12 w-full rounded-xl text-sm font-extrabold' disabled={saving} onClick={copyLastWeek}>Как на прошлой неделе</button>
        )}
        <button type='button' className='employee-material-primary-action mt-2 h-12 w-full rounded-xl text-base font-black disabled:opacity-60' disabled={!canSave || saving} onClick={save}>
          {saving ? 'Сохраняем…' : !canSave ? 'Отметьте завтра' : confirming ? 'Сохранить всё равно' : 'Сохранить'}
        </button>
        <button type='button' className='mt-1 w-full py-2.5 text-sm font-extrabold text-[#996135]' disabled={saving} onClick={onOpenMonth}>Открыть весь месяц</button>
      </div>
    </div>
  );
}
