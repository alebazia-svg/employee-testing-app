'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Banknote, BarChart3, CalendarCheck, GraduationCap, Users } from 'lucide-react';
import { BrandBlock } from '@/components/BrandBlock';
import { LogoutButton } from '@/components/LogoutButton';
import { cn } from '@/lib/utils';

const navigation = [
  { href: '/admin/employees', label: 'Сотрудники', icon: Users },
  { href: '/admin/attestations', label: 'Аттестации', icon: GraduationCap },
  { href: '/admin/results', label: 'Результаты', icon: BarChart3 },
  { href: '/admin/attendance', label: 'Посещаемость', icon: CalendarCheck },
  { href: '/admin/payroll', label: 'Зарплата', icon: Banknote },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <main className='min-h-screen bg-transparent md:grid md:grid-cols-[232px_1fr]'>
      <aside className='border-b border-border/80 bg-white p-3 text-slate-900 shadow-sm md:min-h-screen md:border-b-0 md:border-r md:p-4'>
        <div className='flex items-start justify-between gap-3 md:block'>
          <BrandBlock size='sidebar' />
          <LogoutButton className='shrink-0 gap-2 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 md:hidden' />
        </div>

        <nav className='mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 md:mt-7 md:grid-cols-1'>
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex min-h-10 items-center justify-center gap-2 rounded-lg px-2 py-2 text-center text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-green-400/20 md:justify-start md:gap-3 md:px-3 md:text-sm',
                  active ? 'bg-primary text-white shadow-sm shadow-green-700/20' : 'text-slate-600 hover:bg-green-50 hover:text-slate-950',
                )}
              >
                <Icon className='h-4 w-4 shrink-0' />
                <span className='leading-tight'>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className='mt-8 hidden border-t border-border pt-4 md:block'>
          <LogoutButton className='w-full gap-2 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900' />
        </div>
      </aside>
      <section className='min-w-0 p-4 md:p-7 lg:p-8'>{children}</section>
    </main>
  );
}
