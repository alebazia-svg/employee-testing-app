import { cn } from '@/lib/utils';

export const Card = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('rounded-2xl border border-border/80 bg-card p-5 shadow-sm shadow-slate-200/70 backdrop-blur', className)} {...props} />
);
