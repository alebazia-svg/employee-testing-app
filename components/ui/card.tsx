import { cn } from '@/lib/utils';
export const Card = ({className, ...props}: React.HTMLAttributes<HTMLDivElement>) => <div className={cn('rounded-xl border bg-card p-5 shadow-sm', className)} {...props} />;
