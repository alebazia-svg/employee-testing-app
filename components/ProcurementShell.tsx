'use client';

import { useEffect, useState } from 'react';
import { PortalIdentityBlock } from '@/components/PortalIdentityBlock';
import { LogoutButton } from '@/components/LogoutButton';
import { ProcurementNotificationsButton } from '@/components/ProcurementNotificationsButton';
import { EmployeePortalHeader } from '@/app/(dashboard)/employee/EmployeePortalHeader';
import { EmployeeInterfaceStyle } from './EmployeeInterfaceStyle';
import { EmployeeNavigation } from './EmployeeNavigation';
import './procurement-mobile-shell.css';
import { ReleaseLabel } from '@/components/ReleaseLabel';

export function ProcurementShell({ userName, children, workdayEnabled = false }: { userName: string; children: React.ReactNode; workdayEnabled?: boolean }) {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)');
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  const initials = userName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  if (mobile) return <main className='portal-neutral-design employee-material-ui procurement-shell procurement-responsive-shell min-h-[100dvh] overflow-x-clip text-slate-950'>
    <EmployeeInterfaceStyle copper />
    <div className='employee-material-shell relative mx-auto flex min-h-screen w-full max-w-[520px] flex-col bg-[#f7faf8]'>
      <EmployeePortalHeader name={userName} meta='Закупки' procurement />
      <div className='flex-1 procurement-mobile-content min-w-0 px-4'>{children}</div>
    </div>
    <EmployeeNavigation active='procurement' payrollEnabled={false} procurementEnabled />
  </main>;
  return <main className='portal-neutral-design procurement-shell min-h-[100dvh] overflow-x-clip text-slate-950'>
    <section className='admin-workspace min-h-[100dvh] min-w-0 px-3 pb-10 pt-4 sm:px-6 lg:px-8 lg:pb-6'>
      <div className='mx-auto w-full max-w-[1320px]'>
        <header className='procurement-shell-header mb-3 flex items-center justify-between gap-3 lg:rounded-2xl lg:border lg:border-slate-200/80 lg:bg-white/75 lg:px-5 lg:py-3 lg:shadow-[0_12px_32px_rgba(15,23,42,0.05)]'>
          <div className='flex items-center gap-4'>
            <PortalIdentityBlock variant='mobo-master' className='w-[176px] origin-left scale-[0.86] sm:scale-100' />
          </div>
          <div className='flex shrink-0 items-center gap-2 sm:gap-2.5'>
            <div><ProcurementNotificationsButton /></div>
            <div className='admin-account-chip flex items-center gap-2.5 rounded-2xl p-1.5 min-[520px]:px-3 min-[520px]:py-2.5 sm:gap-3 sm:px-4'>
              <div className='flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-sm font-extrabold text-slate-700'>{initials}</div>
              <div className='hidden min-w-0 min-[520px]:block'>
                <p className='truncate text-sm font-bold text-slate-950'>{userName}</p>
                <p className='text-xs font-medium text-slate-500'>Закупки</p>
              </div>
            </div>
            <LogoutButton
              iconOnly
              title='Выйти'
              className='procurement-header-logout inline-flex h-11 w-11 items-center justify-center rounded-full p-0 transition'
            />
          </div>
        </header>
        {children}
        <footer className='mt-8 flex flex-col gap-2 border-t border-slate-200/80 pt-5 text-xs font-medium text-slate-500 sm:flex-row sm:items-center sm:justify-between'>
          <span className='font-extrabold text-[#263b5c]'>MOBO · Портал компании</span>
          <ReleaseLabel />
        </footer>
      </div>
    </section>
  </main>;
}
