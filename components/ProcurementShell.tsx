'use client';

import { PortalIdentityBlock } from '@/components/PortalIdentityBlock';
import { LogoutButton } from '@/components/LogoutButton';
import { ProcurementNotificationsButton } from '@/components/ProcurementNotificationsButton';

export function ProcurementShell({ userName, children }: { userName: string; children: React.ReactNode }) {
  const initials = userName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  return <main className='portal-neutral-design procurement-shell min-h-[100dvh] overflow-x-clip text-slate-950'>
    <section className='admin-workspace min-h-[100dvh] min-w-0 px-3 pb-10 pt-4 sm:px-6 lg:px-8 lg:py-6'>
      <div className='mx-auto w-full max-w-[1320px]'>
        <header className='procurement-shell-header mb-4 flex items-center justify-between gap-3 lg:rounded-2xl lg:border lg:border-slate-200/80 lg:bg-white/75 lg:px-5 lg:py-3 lg:shadow-[0_12px_32px_rgba(15,23,42,0.05)]'>
          <div className='flex items-center gap-4'>
            <PortalIdentityBlock className='origin-left scale-[0.86] sm:scale-100' />
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
      </div>
    </section>
  </main>;
}
