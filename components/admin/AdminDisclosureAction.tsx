import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export function AdminDisclosureAction({
  closedLabel = 'Открыть',
  openLabel = 'Свернуть',
  className,
}: {
  closedLabel?: string;
  openLabel?: string;
  className?: string;
}) {
  return (
    <span className={cn('admin-disclosure-action', className)}>
      <span className='group-open:hidden'>{closedLabel}</span>
      <span className='hidden group-open:inline'>{openLabel}</span>
      <ChevronDown className='h-4 w-4 transition group-open:rotate-180' />
    </span>
  );
}
