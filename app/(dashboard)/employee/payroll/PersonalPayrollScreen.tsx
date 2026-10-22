import { EmployeePortalHeader, employeeHeaderDateLabel } from '../EmployeePortalHeader';
import { PersonalPayrollClient } from './PersonalPayrollClient';
import './payroll.css';

export function PersonalPayrollScreen({ user }: { user: { name: string; department: string } }) {
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Moscow' }).format(new Date());
  return <main className='portal-neutral-design employee-material-ui portal-palette-mobo portal-typography-refined payroll-phone min-h-[100dvh]'>
    <div className='employee-material-shell mx-auto min-h-[100dvh] w-full max-w-[520px]'>
      <EmployeePortalHeader name={user.name} meta={`${user.department === 'wholesale' ? 'Опт' : 'Розница'} · ${employeeHeaderDateLabel(today)}`} />
      <PersonalPayrollClient currentMonth={today.slice(0, 7)} />
    </div>
  </main>;
}
