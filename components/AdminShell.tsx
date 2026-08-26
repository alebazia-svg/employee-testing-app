'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Banknote, BriefcaseBusiness, CalendarDays, ChevronDown, CreditCard, FileClock, History, Home, Menu, PanelLeftClose, PanelLeftOpen, ReceiptText, Users, Wrench, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { BrandBlock } from '@/components/BrandBlock';
import { AdminInboxBell } from '@/components/AdminInboxBell';
import { LogoutButton } from '@/components/LogoutButton';
import { cn } from '@/lib/utils';

type NavigationItem = { href: string; label: string; icon: LucideIcon };

const dailyNavigation: NavigationItem[] = [
  { href: '/admin', label: 'Главная', icon: Home },
  { href: '/admin/workday', label: 'Контроль дня', icon: BriefcaseBusiness },
  { href: '/admin/expense-requests', label: 'Заявки', icon: FileClock },
  { href: '/admin/attendance', label: 'График', icon: CalendarDays },
  { href: '/admin/employees', label: 'Сотрудники', icon: Users },
];

const periodicNavigation: NavigationItem[] = [
  { href: '/admin/payroll', label: 'Зарплата', icon: Banknote },
];

const serviceNavigation: NavigationItem[] = [
  { href: '/admin/ofd', label: 'Чеки: 1С и OFD', icon: ReceiptText },
  { href: '/admin/workday/tbank', label: 'Эквайринг T-Банк', icon: CreditCard },
  { href: '/admin/inbox', label: 'История уведомлений', icon: History },
];

function isActive(pathname: string, href: string) {
  if (href === '/admin') return pathname === '/admin';
  if (href === '/admin/attestations' && pathname.startsWith('/admin/results')) return true;
  if (href === '/admin/workday' && pathname.startsWith('/admin/workday/tbank')) return false;
  return pathname.startsWith(href);
}

function NavigationLink({ item, pathname, sidebarCollapsed }: { item: NavigationItem; pathname: string; sidebarCollapsed: boolean }) {
  const Icon = item.icon;
  const active = isActive(pathname, item.href);

  return (
    <Link
      href={item.href}
      title={sidebarCollapsed ? item.label : undefined}
      className={cn(
        'admin-nav-item relative flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-center text-sm font-semibold text-slate-200 transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-green-400/20 md:justify-start md:gap-2.5 md:px-3',
        sidebarCollapsed && 'md:px-0 md:justify-center',
        active
          ? 'admin-nav-item-active text-slate-900 before:absolute before:left-0 before:top-2 before:h-7 before:w-1 before:rounded-r-full before:bg-primary'
          : 'hover:bg-white/[0.07] hover:text-white',
      )}
    >
      <Icon className={cn('h-5 w-5 shrink-0 md:h-[21px] md:w-[21px]', active ? 'text-primary' : 'text-slate-300')} />
      <span className={cn('leading-tight md:whitespace-nowrap', sidebarCollapsed && 'md:hidden')}>{item.label}</span>
    </Link>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMoreActive = [...dailyNavigation.slice(3), ...periodicNavigation, ...serviceNavigation].some((item) => isActive(pathname, item.href));

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
    <main className='admin-shell min-h-[100dvh] overflow-x-clip text-slate-950'>
      <header className='admin-mobile-header sticky top-0 z-40 flex items-center justify-between gap-3 px-4 py-3 md:hidden'>
        <div className='w-[150px]'><BrandBlock size='employee' /></div>
        <div className='flex items-center gap-2'>
          <AdminInboxBell />
          <button type='button' onClick={() => setMobileMenuOpen(true)} className='admin-material-control flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-700' aria-label='Открыть разделы админки'>
            <Menu className='h-5 w-5' />
          </button>
        </div>
      </header>

      <aside
        className={cn(
          'admin-sidebar hidden border-b border-white/10 p-4 text-white transition-[width] duration-200 md:fixed md:inset-y-0 md:left-0 md:z-30 md:flex md:h-screen md:flex-col md:border-b-0',
          sidebarCollapsed ? 'md:w-[76px] md:p-4' : 'md:w-[228px] md:p-4',
        )}
      >
        <div className={cn('flex items-center justify-between gap-3', sidebarCollapsed ? 'md:flex-col md:gap-3' : 'md:flex-row')}>
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

        <nav className={cn('mt-5 min-h-0 overflow-y-auto md:flex-1 md:pr-1', sidebarCollapsed ? 'md:mt-7' : 'md:mt-6')}>
          <div className='grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-1'>
            {dailyNavigation.map((item) => <NavigationLink key={item.href} item={item} pathname={pathname} sidebarCollapsed={sidebarCollapsed} />)}
          </div>

          <details className='group mt-4 border-t border-white/10 pt-3 md:mt-5' open={periodicNavigation.some((item) => isActive(pathname, item.href)) || undefined}>
            <summary className={cn(
              'flex min-h-11 cursor-pointer list-none items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-400 transition hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-green-400/20 marker:content-none md:justify-start md:gap-3 md:px-4',
              sidebarCollapsed && 'md:px-0 md:justify-center',
            )}>
              <Banknote className='h-5 w-5 shrink-0' />
              <span className={cn('flex-1 text-left', sidebarCollapsed && 'md:hidden')}>Периодически</span>
              <ChevronDown className={cn('h-4 w-4 transition group-open:rotate-180', sidebarCollapsed && 'md:hidden')} />
            </summary>
            <div className='mt-1 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-1'>
              {periodicNavigation.map((item) => <NavigationLink key={item.href} item={item} pathname={pathname} sidebarCollapsed={sidebarCollapsed} />)}
            </div>
          </details>

          <details className='group mt-4 border-t border-white/10 pt-3 md:mt-5' open={serviceNavigation.some((item) => isActive(pathname, item.href)) || undefined}>
            <summary className={cn(
              'flex min-h-11 cursor-pointer list-none items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-400 transition hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-green-400/20 marker:content-none md:justify-start md:gap-3 md:px-4',
              sidebarCollapsed && 'md:px-0 md:justify-center',
            )}>
              <Wrench className='h-5 w-5 shrink-0' />
              <span className={cn('flex-1 text-left', sidebarCollapsed && 'md:hidden')}>Служебное</span>
              <ChevronDown className={cn('h-4 w-4 transition group-open:rotate-180', sidebarCollapsed && 'md:hidden')} />
            </summary>
            <div className='mt-1 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-1'>
              {serviceNavigation.map((item) => <NavigationLink key={item.href} item={item} pathname={pathname} sidebarCollapsed={sidebarCollapsed} />)}
            </div>
          </details>
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

      <section className={cn('admin-workspace min-w-0 px-3 pb-28 pt-4 transition-[margin] duration-200 sm:px-4 md:min-h-screen md:rounded-l-[24px] md:px-6 md:py-5 lg:px-8 lg:py-6', sidebarCollapsed ? 'md:ml-[76px]' : 'md:ml-[228px]')}>
        <div className='flex min-h-[calc(100vh-4rem)] w-full max-w-none flex-col'>
          <div className='mb-3 hidden items-center justify-end gap-3 md:flex'>
            <AdminInboxBell />
            <div className='admin-account-chip hidden items-center gap-3 rounded-full px-4 py-2 sm:flex'>
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

      <nav className='admin-mobile-nav fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 gap-1 px-2 pb-[max(0.65rem,env(safe-area-inset-bottom))] pt-2 md:hidden' aria-label='Основная навигация админки'>
        {dailyNavigation.slice(0, 3).map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          return <Link key={item.href} href={item.href} className={cn('admin-mobile-nav-item flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-extrabold', active && 'is-active')}><Icon className='h-5 w-5' /><span>{item.label === 'Контроль дня' ? 'Контроль' : item.label}</span></Link>;
        })}
        <button type='button' onClick={() => setMobileMenuOpen(true)} className={cn('admin-mobile-nav-item flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-extrabold', (mobileMenuOpen || mobileMoreActive) && 'is-active')}><Menu className='h-5 w-5' /><span>Ещё</span></button>
      </nav>

      {mobileMenuOpen ? (
        <div className='fixed inset-0 z-50 flex items-end bg-slate-950/45 p-3 backdrop-blur-sm md:hidden' onClick={() => setMobileMenuOpen(false)}>
          <section className='admin-dialog-panel max-h-[86dvh] w-full overflow-y-auto rounded-3xl p-4' onClick={(event) => event.stopPropagation()} aria-label='Все разделы админки'>
            <div className='mb-4 flex items-center justify-between gap-3'>
              <div><p className='text-xs font-extrabold uppercase tracking-wide text-[#5eb70b]'>OFFONIKA</p><h2 className='text-xl font-extrabold text-slate-950'>Все разделы</h2></div>
              <button type='button' onClick={() => setMobileMenuOpen(false)} className='admin-material-control flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-700' aria-label='Закрыть меню'><X className='h-5 w-5' /></button>
            </div>
            <div className='grid grid-cols-2 gap-2'>
              {[...dailyNavigation.slice(3), ...periodicNavigation, ...serviceNavigation].map((item) => {
                const Icon = item.icon;
                const active = isActive(pathname, item.href);
                return <Link key={item.href} href={item.href} onClick={() => setMobileMenuOpen(false)} className={cn('admin-mobile-more-item admin-material-control flex min-h-24 flex-col justify-between rounded-2xl bg-white p-3 text-sm font-extrabold text-slate-800', active && 'is-active')}><Icon className='h-5 w-5 text-[#5eb70b]' /><span>{item.label}</span></Link>;
              })}
            </div>
            <LogoutButton className='admin-material-filter-active mt-3 w-full gap-2 bg-slate-950 text-white hover:bg-slate-900' />
          </section>
        </div>
      ) : null}
    </main>
  );
}
