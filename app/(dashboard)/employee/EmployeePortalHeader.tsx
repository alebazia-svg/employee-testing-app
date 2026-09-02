import { UserRoundedIcon as PremiumUserIcon } from '@solar-icons/react/bold-duotone';
import { LogoutButton } from '@/components/LogoutButton';
import { WorkdayNotificationsClient } from './WorkdayNotificationsClient';

export function employeeHeaderDateLabel(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

export function EmployeePortalHeader({
  name,
  meta,
}: {
  name: string;
  meta: string;
}) {
  const [metaLead, ...metaRest] = meta.split(' · ');
  const metaTail = metaRest.join(' · ');

  return (
    <header className='employee-material-header grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))]'>
      <div className='employee-material-header-profile grid min-w-0 grid-cols-[2.75rem_minmax(0,1fr)] items-center gap-2.5'>
        <div className='employee-material-profile-avatar flex h-11 w-11 items-center justify-center' aria-hidden='true'>
          <PremiumUserIcon color='#273238' secondaryColor='#76827e' secondaryOpacity={0.94} className='employee-material-profile-glyph' aria-hidden='true' />
        </div>
        <div className='employee-material-profile-copy min-w-0'>
          <p className='truncate text-sm font-extrabold leading-tight text-[#273137]'>{name}</p>
          <p className='employee-material-profile-meta mt-1 flex min-w-0 items-center gap-2 text-[11px] font-bold leading-[1.2] text-[#758084]'>
            <span className='shrink-0 rounded-full bg-[#e4e7e4]/90 px-1.5 py-0.5 text-[9px] font-extrabold uppercase leading-none tracking-[0.05em] text-[#59645f] ring-1 ring-white/80'>{metaLead}</span>
            {metaTail ? <span className='min-w-0 truncate'>{metaTail}</span> : null}
          </p>
        </div>
      </div>
      <div className='employee-material-header-actions flex items-center gap-2'>
        <WorkdayNotificationsClient />
        <LogoutButton
          iconOnly
          iconStyle='duotone'
          title='Выйти'
          confirmBeforeLogout
          className='employee-material-header-action h-11 w-11 px-0 text-white'
        />
      </div>
    </header>
  );
}
