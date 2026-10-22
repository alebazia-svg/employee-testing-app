import { EmployeePortalHeader, employeeHeaderDateLabel } from '../EmployeePortalHeader';
import { PersonalPayrollClient } from './PersonalPayrollClient';
import './payroll.css';
import { employeePayrollResponse } from '@/lib/employee-payroll-response';
import { validEmployeePayrollView } from '@/lib/employee-payroll-view';
import type { PayrollViewer } from '@/lib/employee-payroll-read';

export async function PersonalPayrollScreen({ user }: { user: PayrollViewer & { name: string; department: string } }) {
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Moscow' }).format(new Date());
  const initial = await (await employeePayrollResponse(user, new URLSearchParams(), true)).json();
  return <main className='portal-neutral-design employee-material-ui portal-palette-mobo portal-typography-refined payroll-phone min-h-[100dvh]'>
    <div className='employee-material-shell mx-auto min-h-[100dvh] w-full max-w-[520px]'>
      <EmployeePortalHeader name={user.name} meta={`${user.department === 'wholesale' ? 'Опт' : 'Розница'} · ${employeeHeaderDateLabel(today)}`} />
      <PersonalPayrollClient key={user.id} currentMonth={today.slice(0, 7)} initialSalary={validEmployeePayrollView(initial, today.slice(0, 7)) && initial.state !== 'unavailable' ? initial : null} />
    </div>
  </main>;
}
