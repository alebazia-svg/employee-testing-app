'use client';

import { BrandBlock } from '@/components/BrandBlock';
import { LogoutButton } from '@/components/LogoutButton';
import { ProcurementNotificationsButton } from '@/components/ProcurementNotificationsButton';

export function ProcurementShell({ userName, children }: { userName: string; children: React.ReactNode }) {
  const initials = userName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  return <main className='admin-workspace min-h-[100dvh] overflow-x-clip text-slate-950'>
    <section className='min-w-0 px-3 pb-10 pt-4 sm:px-6 lg:px-8 lg:py-6'>
      <div className='mx-auto w-full max-w-[1320px]'>
        <header className='mb-4 flex items-center justify-between gap-3 lg:rounded-2xl lg:border lg:border-slate-200/80 lg:bg-white/75 lg:px-5 lg:py-3 lg:shadow-[0_12px_32px_rgba(15,23,42,0.05)]'>
          <div className='flex items-center gap-4'>
            <div className='w-[150px] text-center sm:w-[190px]'>
              <BrandBlock size='employee' />
              <p className='mt-1 whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500 sm:text-[11px] lg:hidden'>Портал сотрудников</p>
            </div>
            <span className='hidden h-8 w-px bg-slate-200 lg:block' aria-hidden='true' />
            <div className='hidden lg:block'>
              <p className='text-xs font-bold uppercase tracking-[0.08em] text-slate-400'>Портал</p>
              <p className='mt-0.5 text-sm font-extrabold text-slate-700'>для сотрудников</p>
            </div>
          </div>
          <div className='flex items-center gap-2.5'>
            <div><ProcurementNotificationsButton /></div>
            <div className='admin-account-chip flex items-center gap-2.5 rounded-2xl px-3 py-2.5 sm:gap-3 sm:px-4'>
              <div className='hidden h-10 w-10 items-center justify-center rounded-full bg-green-100 text-sm font-extrabold text-primary sm:flex'>{initials}</div>
              <div className='min-w-0'>
                <p className='truncate text-sm font-bold text-slate-950'>{userName}</p>
                <p className='text-xs font-medium text-slate-500'>Закупки</p>
                <LogoutButton className='procurement-account-logout mt-1 text-xs font-bold lg:hidden' />
              </div>
            </div>
            <LogoutButton
              iconOnly
              title='Выйти'
              className='procurement-header-logout hidden h-11 w-11 items-center justify-center rounded-full p-0 transition lg:inline-flex'
            />
          </div>
        </header>
        {children}
      </div>
    </section>
  </main>;
}
