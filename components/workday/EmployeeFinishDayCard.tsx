import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmployeeFinishDayIcon } from './EmployeeAppSetupProposal';

export function EmployeeFinishDayCard({ id, animate, label, description, disabled, onClick, children }: {
  id: string;
  animate: boolean;
  label: string;
  description?: string;
  disabled: boolean;
  onClick: () => void;
  children?: ReactNode;
}) {
  return <Card id={id} tabIndex={-1} className='space-y-3 border-green-100 bg-white p-4'>
    <div className='flex items-center gap-3'>
      <EmployeeFinishDayIcon animate={animate} />
      <h2 className='min-w-0 text-lg font-black leading-tight text-slate-950'>Завершение дня</h2>
    </div>
    {description && <p className="pb-2 text-sm font-semibold text-slate-500">{description}</p>}
    <Button type='button' className='h-12 w-full rounded-xl text-sm font-black employee-material-primary-action' disabled={disabled} onClick={onClick}>{label}</Button>
    {children}
  </Card>;
}
