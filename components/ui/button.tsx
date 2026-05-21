import * as React from 'react';
import { cn } from '@/lib/utils';

export function Button({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-green-700/20 transition-all hover:-translate-y-0.5 hover:bg-green-600 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}
