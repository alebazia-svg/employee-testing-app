'use client';

import { BrandBlock } from '@/components/BrandBlock';
import { LogoutButton } from '@/components/LogoutButton';
import { ProcurementNotificationsButton } from '@/components/ProcurementNotificationsButton';

export function ProcurementShell({ userName, children }: { userName: string; children: React.ReactNode }) {
  const initials = userName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  return <main className='admin-workspace min-h-[100dvh] overflow-x-clip text-slate-950'>
    <section className='min-w-0 px-3 pb-10 pt-4 sm:px-6 lg:px-8 lg:py-6'>
      <div className='mx-auto w-full max-w-[1320px]'>
        <header className='mb-4 flex items-center justify-between gap-3'>
          <div className='w-[125px] sm:w-[150px]'><BrandBlock size='employee' /></div>
          <div className='flex items-start gap-2.5'>
            <div className='pt-1.5'><ProcurementNotificationsButton /></div>
            <div className='admin-account-chip flex items-center gap-2.5 rounded-2xl px-3 py-2.5 sm:gap-3 sm:px-4'>
              <div className='hidden h-10 w-10 items-center justify-center rounded-full bg-green-100 text-sm font-extrabold text-primary sm:flex'>{initials}</div>
              <div className='min-w-0'>
                <p className='truncate text-sm font-bold text-slate-950'>{userName}</p>
                <p className='text-xs font-medium text-slate-500'>Закупки</p>
                <LogoutButton className='procurement-account-logout mt-1 text-xs font-bold' />
              </div>
            </div>
          </div>
        </header>
        {children}
      </div>
    </section>
  </main>;
}
