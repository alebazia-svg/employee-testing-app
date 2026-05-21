import { cn } from '@/lib/utils';
export const Input = ({className, ...props}: React.InputHTMLAttributes<HTMLInputElement>) => <input className={cn('w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary', className)} {...props} />;
