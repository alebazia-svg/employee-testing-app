import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const tones = {
  green: 'bg-green-100 text-green-700',
  amber: 'bg-amber-100 text-amber-700',
  red: 'bg-rose-100 text-rose-700',
  slate: 'bg-slate-100 text-slate-600',
};

export function AdminMetricCard({
  icon: Icon,
  label,
  value,
  detail,
  tone = 'slate',
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  detail?: string;
  tone?: keyof typeof tones;
}) {
  return (
    <div className='admin-material-card rounded-2xl p-3 sm:p-4'>
      <div className='flex items-start gap-2 sm:gap-3'>
        <div className={cn('admin-material-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:h-10 sm:w-10', tones[tone])}>
          <Icon className='h-5 w-5' />
        </div>
        <div className='min-w-0'>
          <p className='text-[10px] font-extrabold uppercase leading-[1.25] tracking-[0.04em] text-slate-500 sm:text-xs sm:tracking-[0.08em]'>{label}</p>
          <p className='mt-1 text-2xl font-extrabold text-slate-950'>{value}</p>
          {detail && <p className='mt-1 hidden line-clamp-2 text-xs font-medium leading-relaxed text-slate-500 sm:block'>{detail}</p>}
        </div>
      </div>
    </div>
  );
}
