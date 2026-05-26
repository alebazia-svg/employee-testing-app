import { cn } from '@/lib/utils';

export const Card = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'rounded-lg border border-slate-200/80 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.05)] backdrop-blur',
      className,
    )}
    {...props}
  />
);
