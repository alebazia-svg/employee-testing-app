'use client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, useTransition, type MouseEvent } from 'react';
import { CalendarDays, Clock3, CreditCard, ShoppingBag } from 'lucide-react';
import { PremiumCalendarIcon, PremiumCardIcon, PremiumClockIcon } from './PwaPreviewIcons';
import { useEmployeePreview } from './EmployeePreviewProvider';
import { employeeNavigation, type EmployeeSection } from '@/lib/employee-navigation';
import { useProcurementMobileNavigation } from './ProcurementMobileNavigation';
import { cn } from '@/lib/utils';

const icons = { day: PremiumClockIcon, schedule: PremiumCalendarIcon, payroll: PremiumCardIcon };
export function EmployeeNavigation({ active, payrollEnabled, procurementEnabled = false, onSelect }: {
  active: EmployeeSection | 'procurement'; payrollEnabled: boolean; procurementEnabled?: boolean; onSelect?: (section: EmployeeSection) => boolean;
}) {
  const router = useRouter();
  const mobileNavigation = useProcurementMobileNavigation();
  const preview = useEmployeePreview();
  const [pendingSection, setPendingSection] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const sections = [...employeeNavigation(procurementEnabled ? false : payrollEnabled), ...(procurementEnabled ? [{ id: 'procurement' as const, label: 'Закупки', href: '/procurement' }] : [])];
  return <nav aria-label='Основная навигация сотрудника' className='employee-material-nav fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[520px] px-3 pb-[calc(0.65rem+env(safe-area-inset-bottom))] pt-2'>
    <div className='grid gap-1' style={{ gridTemplateColumns: `repeat(${sections.length}, minmax(0, 1fr))` }}>
      {sections.map(section => {
        const Icon = section.id === 'procurement' ? null : icons[section.id], selected = active === section.id;
        const href = preview ? preview.href(section.href) : section.href;
        const crossRoute = !mobileNavigation && procurementEnabled && !selected && (active === 'procurement' || section.id === 'procurement');
        const attributes = {
          'aria-current': selected ? 'page' as const : undefined,
          'aria-busy': isPending && pendingSection === section.id || undefined,
          onClick: (event: MouseEvent<HTMLElement>) => {
            event.preventDefault();
            if (selected) return;
            if (mobileNavigation && section.id !== 'payroll') { mobileNavigation.select(section.id); return; }
            if (section.id !== 'procurement' && onSelect?.(section.id)) return;
            setPendingSection(section.id);
            startTransition(() => router.push(href));
          },
          className: cn('employee-material-tab flex min-h-[52px] flex-col items-center justify-center gap-0 px-2 text-xs font-extrabold transition', selected ? 'is-active' : 'text-slate-500'),
        };
        const content = <>
          <span className={cn('relative flex h-6 w-6 items-center justify-center', `employee-material-nav-icon-${section.id}`)} aria-hidden='true'>
            {section.id === 'day' ? <Clock3 className='pwa-composition-only pwa-composition-nav-icon' style={{ display: 'none' }} size={23} strokeWidth={1.7} /> : section.id === 'schedule' ? <CalendarDays className='pwa-composition-only pwa-composition-nav-icon' style={{ display: 'none' }} size={23} strokeWidth={1.7} /> : section.id === 'procurement' ? <ShoppingBag className='pwa-composition-only pwa-composition-nav-icon' style={{ display: 'none' }} size={23} strokeWidth={1.7} /> : <CreditCard className='pwa-composition-only pwa-composition-nav-icon' style={{ display: 'none' }} size={23} strokeWidth={1.7} />}
            {Icon ? <Icon className='h-6 w-6' color={selected ? 'var(--portal-brand-strong)' : '#687078'} secondaryColor={selected ? 'var(--portal-brand-colleague-blue)' : '#b6babd'} secondaryOpacity={selected ? 1 : 0.82} /> : <ShoppingBag className='h-6 w-6' strokeWidth={1.7} />}
          </span><span className='employee-material-tab-label'>{isPending && pendingSection === section.id ? 'Открываем…' : section.label}</span>
        </>;
        return crossRoute ? <Link key={section.id} href={href} prefetch role='button' {...attributes}>{content}</Link>
          : <button key={section.id} type='button' {...attributes}>{content}</button>;
      })}
    </div>
  </nav>;
}
