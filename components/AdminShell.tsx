'use client';

import Link from './AdminSectionLink';
import { useAdminIdentity } from './AdminIdentityProvider';
import { portalPersonInitials } from '@/lib/portal-person';
import { usePathname } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { AdminPageVisitTracker } from './AdminPageVisitTracker';
import { Banknote, BriefcaseBusiness, Building2, CalendarDays, ChevronDown, CreditCard, FileClock, History, Home, Landmark, Menu, PanelLeftClose, PanelLeftOpen, ReceiptText, Truck, Users, Wrench, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AdminInboxBell } from '@/components/AdminInboxBell';
import { LogoutButton } from '@/components/LogoutButton';
import { PortalIdentityBlock } from '@/components/PortalIdentityBlock';
import { cn } from '@/lib/utils';
import { ReleaseLabel } from '@/components/ReleaseLabel';
import { useAdminNavigationAttention } from './AdminNavigationAttention';
import { useMobileNavigationViewport } from './useMobileNavigationViewport';

type NavigationItem = { href: string; label: string; icon: LucideIcon; attention?: 'expenses' | 'suppliers' | 'workday' };

const homeNavigation: NavigationItem = { href: '/admin', label: 'Главная', icon: Home };
const teamNavigation: NavigationItem[] = [
  { href: '/admin/workday', label: 'Контроль дня', icon: BriefcaseBusiness, attention: 'workday' },
  { href: '/admin/attendance', label: 'График смен', icon: CalendarDays },
  { href: '/admin/employees', label: 'Сотрудники', icon: Users },
];
const financeNavigation: NavigationItem[] = [
  { href: '/admin/expense-requests', label: 'Заявки на расходы', icon: FileClock, attention: 'expenses' },
  { href: '/admin/procurement', label: 'Оплаты поставщикам', icon: Truck, attention: 'suppliers' },
  { href: '/admin/payroll', label: 'Зарплата', icon: Banknote },
  { href: '/admin/taxes', label: 'Налоги', icon: Landmark },
];
const [dayControl, schedule, employees] = teamNavigation;
const [expenses, suppliers, payroll, taxes] = financeNavigation;
const desktopGroups = [
  { label: 'Команда', items: teamNavigation },
  { label: 'Финансы', items: financeNavigation },
];
const mobileNavigation = [homeNavigation, { ...dayControl, label: 'Контроль' }, { ...expenses, label: 'Расходы' }];
const mobileMoreNavigation = [suppliers, schedule, employees, payroll, taxes];

const serviceNavigation: NavigationItem[] = [
  { href: '/admin/company-details', label: 'Реквизиты', icon: Building2 },
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

function useNavigationAttention(item: NavigationItem) {
  const { expenses, suppliers, workday } = useAdminNavigationAttention();
  if (item.attention === 'workday' && workday) {
    return { count: workday, detail: `Запросы на завершение смены: ${workday}` };
  }
  if (item.attention === 'expenses' && expenses) {
    return { count: expenses, detail: `Ждут решения: ${expenses}` };
  }
  if (item.attention === 'suppliers' && suppliers) {
    const count = suppliers.decisions + (suppliers.preparation ?? 0);
    const detail = [
      suppliers.decisions ? `На согласование: ${suppliers.decisions}` : '',
      suppliers.preparation ? `Подготовить деньги: ${suppliers.preparation}` : '',
      suppliers.preparation === null ? 'Сроки подготовки уточняются' : '',
    ].filter(Boolean).join(' · ');
    if (count) return { count, detail };
  }
  return null;
}

function AttentionBadge({ count }: { count: number }) {
  return <span className='admin-nav-attention' aria-hidden='true'>{count > 99 ? '99+' : count}</span>;
}

function MobileNavigationLink({ item, active, more = false, onClick }: {
  item: NavigationItem; active: boolean; more?: boolean; onClick?: () => void;
}) {
  const Icon = item.icon;
  const attention = useNavigationAttention(item);
  return <Link href={item.href} prefetch={item.href === '/admin/taxes' ? false : undefined} onClick={onClick}
    aria-label={attention ? `${item.label}. ${attention.detail}` : undefined}
    className={more
      ? cn('admin-mobile-more-item admin-material-control flex min-h-24 flex-col justify-between rounded-2xl bg-white p-3 text-sm font-extrabold text-slate-800', active && 'is-active')
      : cn('admin-mobile-nav-item flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-extrabold', active && 'is-active')}>
    <span className={cn('relative inline-flex', more && 'w-full items-center justify-between')}>
      <Icon className={cn('h-5 w-5', more && 'text-[#263b5c]')} />
      {attention && <span className={more ? '' : 'admin-nav-attention-mobile-dock'}><AttentionBadge count={attention.count} /></span>}
    </span>
    <span>{item.label}</span>
  </Link>;
}

function NavigationLink({ item, pathname, sidebarCollapsed }: { item: NavigationItem; pathname: string; sidebarCollapsed: boolean }) {
  const Icon = item.icon;
  const active = isActive(pathname, item.href);
  const attention = useNavigationAttention(item);
  const accessibleLabel = attention ? `${item.label}. ${attention.detail}` : item.label;

  return (
    <Link
      href={item.href}
      prefetch={item.href === '/admin/taxes' ? false : undefined}
      title={sidebarCollapsed || attention ? accessibleLabel : undefined}
      aria-label={sidebarCollapsed || attention ? accessibleLabel : undefined}
      className={cn(
        'admin-nav-item relative flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-center text-sm font-semibold text-slate-200 transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300/25 md:justify-start md:gap-2.5 md:px-3',
        item.attention && 'admin-nav-with-attention min-w-0',
        sidebarCollapsed && 'md:px-0 md:justify-center',
        active
          ? 'admin-nav-item-active text-slate-900 before:absolute before:left-0 before:top-2 before:h-7 before:w-1 before:rounded-r-full'
          : 'hover:bg-white/[0.07] hover:text-white',
      )}
    >
      <Icon className={cn('h-5 w-5 shrink-0 md:h-[21px] md:w-[21px]', active ? 'text-[#263b5c]' : 'text-slate-300')} />
      <span className={cn('min-w-0 leading-tight', item.attention ? 'admin-nav-attention-label' : 'truncate md:whitespace-nowrap', sidebarCollapsed && 'md:hidden')}>{item.label}</span>
      {attention && <span className={sidebarCollapsed ? 'admin-nav-attention-collapsed' : 'ml-auto shrink-0'}><AttentionBadge count={attention.count} /></span>}
    </Link>
  );
}

export function AdminShell({ children, pageTitle, pageDescription, headerWidthClass = 'max-w-none' }: {
  children: React.ReactNode;
  pageTitle?: string;
  pageDescription?: React.ReactNode;
  /** Match the existing page content width; do not constrain tables globally. */
  headerWidthClass?: string;
}) {
  const pathname = usePathname();
  const navRef = useMobileNavigationViewport();
  const accountName = useAdminIdentity();
  const supplierAttention = useNavigationAttention(suppliers);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMoreActive = [...mobileMoreNavigation, ...serviceNavigation].some((item) => isActive(pathname, item.href));

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
    <main className='portal-neutral-design mobo-master-admin admin-shell min-h-[100dvh] overflow-x-clip text-slate-950'>
      <Suspense fallback={null}><AdminPageVisitTracker /></Suspense>
      <header className='admin-mobile-header sticky top-0 z-40 flex items-center justify-between gap-3 px-4 py-3 md:hidden'>
        <PortalIdentityBlock variant='mobo-master' className='admin-mobile-identity w-[154px]' />
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
          sidebarCollapsed ? 'md:w-[76px] md:p-4' : 'md:w-[240px] md:p-4 xl:w-[276px]',
        )}
      >
        <div className={cn('flex items-center justify-between gap-3', sidebarCollapsed ? 'md:flex-col md:gap-3' : 'md:flex-row')}>
          <div className={cn(sidebarCollapsed ? 'md:flex md:justify-center' : '')}>
            {sidebarCollapsed ? (
              <span className='hidden h-8 w-8 items-center justify-center md:flex'>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src='/brand/mobo-master/mobo-symbol-3d-light-ui.svg' alt='' className='h-7 w-7' />
              </span>
            ) : <PortalIdentityBlock variant='mobo-master' className='admin-sidebar-identity w-[154px]' />}
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

        <nav className={cn('mt-5 min-h-0 overflow-x-hidden overflow-y-auto md:flex md:flex-1 md:flex-col md:pr-1', sidebarCollapsed ? 'md:mt-7' : 'md:mt-6')}>
          <div className='grid grid-cols-[minmax(0,1fr)] gap-3'>
            <NavigationLink item={homeNavigation} pathname={pathname} sidebarCollapsed={sidebarCollapsed} />
            {desktopGroups.map(group => (
              <div key={group.label} className='grid grid-cols-[minmax(0,1fr)] gap-1' role='group' aria-label={group.label}>
                {!sidebarCollapsed && <p className='px-3 py-1 text-xs font-semibold text-slate-400'>{group.label}</p>}
                {group.items.map(item => <NavigationLink key={item.href} item={item} pathname={pathname} sidebarCollapsed={sidebarCollapsed} />)}
              </div>
            ))}
          </div>

          <details className='group mt-4 border-t border-white/10 pt-3 md:mt-auto' open={serviceNavigation.some((item) => isActive(pathname, item.href)) || undefined}>
            <summary className={cn(
              'flex min-h-11 cursor-pointer list-none items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-400 transition hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300/25 marker:content-none md:justify-start md:gap-3 md:px-4',
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

      <section className={cn('admin-workspace min-w-0 px-3 pb-28 pt-4 transition-[margin] duration-200 sm:px-4 md:min-h-screen md:rounded-l-[24px] md:px-6 md:py-5 lg:px-8 lg:py-6', sidebarCollapsed ? 'md:ml-[76px]' : 'md:ml-[240px] xl:ml-[276px]')}>
        <div className='flex min-h-[calc(100vh-4rem)] w-full max-w-none flex-col'>
          <div className={cn('admin-page-top', pageTitle ? 'mx-auto mb-5 flex w-full items-start justify-between gap-6 border-b border-slate-200/80 pb-4' : 'mb-3 hidden items-center justify-end gap-3 md:flex', pageTitle && headerWidthClass)}>
            {pageTitle && <header className='min-w-0'><h1 className='text-2xl font-bold leading-tight tracking-tight text-slate-950 sm:text-[28px]'>{pageTitle}</h1>{pageDescription && <div className='mt-1 max-w-3xl text-sm leading-relaxed text-slate-500'>{pageDescription}</div>}</header>}
            <div className='hidden shrink-0 items-center gap-3 md:flex'><AdminInboxBell />
            <div className='admin-account-chip hidden items-center gap-3 rounded-full px-4 py-2 sm:flex'>
              <div className='admin-account-avatar flex h-10 w-10 items-center justify-center rounded-full text-sm font-extrabold'>{portalPersonInitials(accountName)}</div>
              <div>
                <p className='text-sm font-bold text-slate-950'>{accountName}</p>
                <p className='text-xs font-medium text-slate-500'>Администратор</p>
              </div>
            </div>
            </div>
          </div>
          <div className='flex-1'>{children}</div>
          <footer className='mt-8 flex flex-col gap-2 border-t border-slate-200/80 pt-5 text-xs font-medium text-slate-500 sm:flex-row sm:items-center sm:justify-between'>
            <span className='font-extrabold text-[#263b5c]'>MOBO · Портал компании</span>
            <ReleaseLabel />
          </footer>
        </div>
      </section>

      <nav ref={navRef} className='admin-mobile-nav fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 gap-1 px-2 pb-[max(0.65rem,env(safe-area-inset-bottom))] pt-2 md:hidden' aria-label='Основная навигация админки'>
        {mobileNavigation.map(item => <MobileNavigationLink key={item.href} item={item} active={isActive(pathname, item.href)} />)}
        <button type='button' onClick={() => setMobileMenuOpen(true)}
          aria-label={supplierAttention ? `Ещё. Оплаты поставщикам: ${supplierAttention.detail}` : undefined}
          className={cn('admin-mobile-nav-item flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-extrabold', (mobileMenuOpen || mobileMoreActive) && 'is-active')}>
          <span className='relative inline-flex'><Menu className='h-5 w-5' />
            {supplierAttention && <span className='admin-nav-attention-indicator' aria-hidden='true' />}
          </span>
          <span>Ещё</span>
        </button>
      </nav>

      {mobileMenuOpen ? (
        <div role='dialog' aria-modal='true' aria-label='Все разделы админки' className='fixed inset-0 z-50 flex items-end bg-slate-950/45 p-3 backdrop-blur-sm md:hidden' onClick={() => setMobileMenuOpen(false)}>
          <section className='admin-dialog-panel max-h-[86dvh] w-full overflow-y-auto rounded-3xl p-4' onClick={(event) => event.stopPropagation()} aria-label='Все разделы админки'>
            <div className='mb-4 flex items-center justify-between gap-3'>
              <div><p className='text-xs font-extrabold uppercase tracking-wide text-[#263b5c]'>MOBO</p><h2 className='text-xl font-extrabold text-slate-950'>Все разделы</h2></div>
              <button type='button' onClick={() => setMobileMenuOpen(false)} className='admin-material-control flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-700' aria-label='Закрыть меню'><X className='h-5 w-5' /></button>
            </div>
            <div className='grid grid-cols-2 gap-2'>
              {mobileMoreNavigation.map(item => <MobileNavigationLink key={item.href} item={item} more
                active={isActive(pathname, item.href)} onClick={() => setMobileMenuOpen(false)} />)}
            </div>
            <div className='mt-4 border-t border-slate-200 pt-3'>
              <p className='mb-2 text-xs font-extrabold uppercase tracking-wide text-slate-500'>Служебное</p>
              <div className='grid grid-cols-2 gap-2'>
                {serviceNavigation.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(pathname, item.href);
                  return <Link key={item.href} href={item.href} prefetch={item.href === '/admin/taxes' ? false : undefined} onClick={() => setMobileMenuOpen(false)} className={cn('admin-mobile-more-item admin-material-control flex min-h-24 flex-col justify-between rounded-2xl bg-white p-3 text-sm font-extrabold text-slate-800', active && 'is-active')}><Icon className='h-5 w-5 text-[#263b5c]' /><span>{item.label}</span></Link>;
                })}
              </div>
            </div>
            <LogoutButton className='admin-material-filter-active mt-3 w-full gap-2 bg-slate-950 text-white hover:bg-slate-900' />
          </section>
        </div>
      ) : null}
    </main>
  );
}
