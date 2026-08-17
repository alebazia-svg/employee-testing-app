'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Banknote, BarChart3, BriefcaseBusiness, CalendarCheck, FileClock, GraduationCap, Home, LineChart, PanelLeftClose, PanelLeftOpen, Users } from 'lucide-react';
import { BrandBlock } from '@/components/BrandBlock';
import { AdminInboxBell } from '@/components/AdminInboxBell';
import { LogoutButton } from '@/components/LogoutButton';
import { cn } from '@/lib/utils';

const navigation = [
  { href: '/admin', label: 'Главная', icon: Home },
  { href: '/admin/employees', label: 'Сотрудники', icon: Users },
  { href: '/admin/attestations', label: 'Аттестации', icon: GraduationCap },
  { href: '/admin/results', label: 'Результаты', icon: BarChart3 },
  { href: '/admin/attendance', label: 'Посещаемость', icon: CalendarCheck },
  { href: '/admin/workday', label: 'Контроль дня', icon: BriefcaseBusiness },
  { href: '/admin/expense-requests', label: 'Заявки', icon: FileClock },
  { href: '/admin/payroll', label: 'Зарплата', icon: Banknote },
  { href: '/admin/analytics', label: 'Аналитика', icon: LineChart },
];

function isActive(pathname: string, href: string) {
  if (href === '/admin') return pathname === '/admin';
  return pathname.startsWith(href);
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    setSidebarCollapsed(window.localStorage.getItem('admin-sidebar-collapsed') === 'true');
  }, []);

  function toggleSidebar() {
    setSidebarCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem('admin-sidebar-collapsed', String(next));
      return next;
    });
  }

  return (
    <main className='min-h-screen overflow-x-hidden bg-[#111821] text-slate-950'>
      <aside
        className={cn(
          'border-b border-white/10 bg-[#111821] p-4 text-white shadow-[inset_-1px_0_0_rgba(255,255,255,0.06)] transition-[width] duration-200 md:fixed md:inset-y-0 md:left-0 md:z-30 md:flex md:h-screen md:flex-col md:border-b-0',
          sidebarCollapsed ? 'md:w-[76px] md:p-4' : 'md:w-[236px] md:p-5',
        )}
      >
        <div className={cn('flex items-center justify-between gap-4', sidebarCollapsed ? 'md:flex-col md:gap-3' : 'md:block')}>
          <div className={cn(sidebarCollapsed ? 'md:flex md:justify-center' : '')}>
            {sidebarCollapsed && <Image src='/logo-offonika-icon.png' alt='OFFONIKA' width={32} height={32} className='hidden h-8 w-8 bg-transparent object-contain md:block' />}
            <div className={sidebarCollapsed ? 'md:hidden' : ''}>
              <BrandBlock size='sidebar' />
            </div>
          </div>
          <button
            type='button'
            onClick={toggleSidebar}
            className='hidden h-9 w-9 items-center justify-center rounded-lg bg-white/[0.08] text-slate-200 ring-1 ring-white/10 transition hover:bg-white/[0.12] hover:text-white md:inline-flex'
            title={sidebarCollapsed ? 'Развернуть меню' : 'Свернуть меню'}
          >
            {sidebarCollapsed ? <PanelLeftOpen className='h-5 w-5' /> : <PanelLeftClose className='h-5 w-5' />}
          </button>
          <LogoutButton className='shrink-0 gap-2 bg-white/8 text-white ring-1 ring-white/10 hover:bg-white/12 md:hidden' />
        </div>

        <nav className={cn('mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-1', sidebarCollapsed ? 'md:mt-7 md:gap-2' : 'md:mt-10 md:gap-3')}>
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={sidebarCollapsed ? item.label : undefined}
                className={cn(
                  'relative flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-center text-sm font-semibold text-slate-300 transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-green-400/20 md:justify-start md:gap-3 md:px-4',
                  sidebarCollapsed && 'md:px-0 md:justify-center',
                  active
                    ? 'bg-white/[0.08] text-white shadow-[0_12px_28px_rgba(0,0,0,0.18)] before:absolute before:left-0 before:top-2 before:h-7 before:w-1 before:rounded-r-full before:bg-primary'
                    : 'hover:bg-white/[0.06] hover:text-white',
                )}
              >
                <Icon className={cn('h-5 w-5 shrink-0 md:h-[21px] md:w-[21px]', active ? 'text-primary' : 'text-slate-300')} />
                <span className={cn('leading-tight', sidebarCollapsed && 'md:hidden')}>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className='mt-auto hidden pt-6 md:block'>
          <LogoutButton
            iconOnly={sidebarCollapsed}
            title='Выйти'
            className={cn(
              'bg-white/[0.08] text-white ring-1 ring-white/10 hover:bg-white/[0.12]',
              sidebarCollapsed ? 'h-11 w-11 px-0' : 'w-full gap-3',
            )}
          />
        </div>
      </aside>

      <section className={cn('min-w-0 bg-[#f7faf8] p-4 transition-[margin] duration-200 md:min-h-screen md:rounded-l-[20px] md:px-6 md:py-5 lg:px-8 lg:py-6', sidebarCollapsed ? 'md:ml-[76px]' : 'md:ml-[236px]')}>
        <div className='flex min-h-[calc(100vh-4rem)] w-full max-w-none flex-col'>
          <div className='mb-3 flex items-center justify-end gap-3'>
            <AdminInboxBell />
            <div className='flex items-center gap-3 rounded-full bg-white px-4 py-2 shadow-sm ring-1 ring-slate-200/80'>
              <div className='flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-sm font-extrabold text-primary'>АД</div>
              <div>
                <p className='text-sm font-bold text-slate-950'>Администратор</p>
                <p className='text-xs font-medium text-slate-500'>admin</p>
              </div>
            </div>
          </div>
          <div className='flex-1'>{children}</div>
          <footer className='mt-8 flex flex-col gap-2 border-t border-slate-200/80 pt-5 text-xs font-medium text-slate-500 sm:flex-row sm:items-center sm:justify-between'>
            <span>© 2026 <span className='font-extrabold text-primary'>OFFONIKA</span>. Все права защищены.</span>
            <span>Версия 1.0.0</span>
          </footer>
        </div>
      </section>
    </main>
  );
}
