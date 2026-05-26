'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Banknote, BarChart3, CalendarCheck, GraduationCap, Home, Users } from 'lucide-react';
import { BrandBlock } from '@/components/BrandBlock';
import { LogoutButton } from '@/components/LogoutButton';
import { cn } from '@/lib/utils';

const navigation = [
  { href: '/admin', label: 'Главная', icon: Home },
  { href: '/admin/employees', label: 'Сотрудники', icon: Users },
  { href: '/admin/attestations', label: 'Аттестации', icon: GraduationCap },
  { href: '/admin/results', label: 'Результаты', icon: BarChart3 },
  { href: '/admin/attendance', label: 'Посещаемость', icon: CalendarCheck },
  { href: '/admin/payroll', label: 'Зарплата', icon: Banknote },
];

function isActive(pathname: string, href: string) {
  if (href === '/admin') return pathname === '/admin';
  return pathname.startsWith(href);
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <main className='min-h-screen overflow-x-hidden bg-[#111821] text-slate-950'>
      <aside className='border-b border-white/10 bg-[#111821] p-4 text-white shadow-[inset_-1px_0_0_rgba(255,255,255,0.06)] md:fixed md:inset-y-0 md:left-0 md:z-30 md:flex md:h-screen md:w-[250px] md:flex-col md:border-b-0 md:p-5'>
        <div className='flex items-center justify-between gap-4 md:block'>
          <BrandBlock size='sidebar' />
          <LogoutButton className='shrink-0 gap-2 bg-white/8 text-white ring-1 ring-white/10 hover:bg-white/12 md:hidden' />
        </div>

        <nav className='mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 md:mt-10 md:grid-cols-1 md:gap-3'>
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'relative flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-center text-xs font-semibold text-slate-300 transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-green-400/20 md:justify-start md:gap-3 md:px-4 md:text-sm',
                  active
                    ? 'bg-white/[0.08] text-white shadow-[0_12px_28px_rgba(0,0,0,0.18)] before:absolute before:left-0 before:top-2 before:h-7 before:w-1 before:rounded-r-full before:bg-primary'
                    : 'hover:bg-white/[0.06] hover:text-white',
                )}
              >
                <Icon className={cn('h-5 w-5 shrink-0', active ? 'text-primary' : 'text-slate-300')} />
                <span className='leading-tight'>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className='mt-auto hidden pt-6 md:block'>
          <LogoutButton className='w-full gap-3 bg-white/[0.08] text-white ring-1 ring-white/10 hover:bg-white/[0.12]' />
        </div>
      </aside>

      <section className='min-w-0 bg-[#f7faf8] p-4 md:ml-[250px] md:min-h-screen md:rounded-l-[28px] md:p-7 lg:p-8'>
        <div className='mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[1480px] flex-col'>
          <div className='mb-5 flex justify-end'>
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
