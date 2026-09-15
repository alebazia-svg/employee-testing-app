import { ChevronRight } from 'lucide-react';
import { DangerTriangleIcon } from '@solar-icons/react/bold-duotone';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function EmployeeAttentionSummaryCard({
  title,
  subtitle,
  count,
  actionLabel,
  onAction,
  tone = 'neutral',
}: {
  title: string;
  subtitle: string;
  count: number;
  actionLabel: string;
  onAction: () => void;
  tone?: 'neutral' | 'blocked' | 'attention';
}) {
  const blocked = tone === 'blocked';
  const attention = tone === 'attention';
  return <Card className={cn(
    'rounded-[24px] px-4 py-3.5 shadow-[0_10px_26px_rgba(31,47,66,0.06)]',
    blocked || attention ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white',
  )}>
    <div className='flex min-h-[52px] items-center justify-between gap-3'>
      {attention && <DangerTriangleIcon aria-hidden='true' color='#a85a08' secondaryColor='#f6d58b' secondaryOpacity={0.9} className='employee-material-alert-symbol h-6 w-6 shrink-0' />}
      <div className='min-w-0 flex-1'>
        <h2 className={cn('text-base font-black leading-tight', blocked ? 'text-amber-950' : 'text-slate-950')}>{title}</h2>
        {subtitle && <p className={cn('mt-1 text-xs font-semibold leading-snug', blocked ? 'text-amber-800' : 'text-slate-500')}>{subtitle}</p>}
      </div>
      <button type='button' onClick={onAction} className={cn('flex min-h-10 shrink-0 items-center gap-1 rounded-full px-3 text-xs font-black', blocked ? 'bg-amber-100 text-amber-950 ring-1 ring-amber-200' : 'bg-[#e8eef5] text-[#31577e]')}>
        {actionLabel}<ChevronRight className='h-4 w-4' />
      </button>
    </div>
    <span className='sr-only'>Всего задач: {count}</span>
  </Card>;
}
