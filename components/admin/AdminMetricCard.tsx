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
    <div className='admin-material-card rounded-2xl p-4'>
      <div className='flex items-start gap-3'>
        <div className={cn('admin-material-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', tones[tone])}>
          <Icon className='h-5 w-5' />
        </div>
        <div className='min-w-0'>
          <p className='text-xs font-extrabold uppercase tracking-[0.08em] text-slate-500'>{label}</p>
          <p className='mt-1 text-2xl font-extrabold text-slate-950'>{value}</p>
          {detail && <p className='mt-1 line-clamp-2 text-xs font-medium leading-relaxed text-slate-500'>{detail}</p>}
        </div>
      </div>
    </div>
  );
}
