import { EmployeePortalHeader, employeeHeaderDateLabel } from '../EmployeePortalHeader';
import { PersonalPayrollClient } from './PersonalPayrollClient';
import './payroll.css';
import { employeePayrollResponse } from '@/lib/employee-payroll-response';
import { validEmployeePayrollView } from '@/lib/employee-payroll-view';
import type { PayrollViewer } from '@/lib/employee-payroll-read';
import { Suspense } from 'react';

async function SavedPayroll({ user, month }: { user: PayrollViewer; month: string }) {
  // A failed saved read must not strand the route in its fallback. The native
  // private client can retry and retain its last account-scoped snapshot.
  let initial: unknown = null;
  try { initial = await (await employeePayrollResponse(user, new URLSearchParams(), true)).json(); } catch { /* client reports read failures */ }
  return <PersonalPayrollClient currentMonth={month} initialSalary={validEmployeePayrollView(initial, month) && initial.state !== 'unavailable' ? initial : null} />;
}

export function PersonalPayrollScreen({ user }: { user: PayrollViewer & { name: string; department: string } }) {
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Moscow' }).format(new Date());
  return <main className='portal-neutral-design employee-material-ui portal-palette-mobo portal-typography-refined payroll-phone min-h-[100dvh]'>
    <div className='employee-material-shell mx-auto min-h-[100dvh] w-full max-w-[520px]'>
      <EmployeePortalHeader name={user.name} meta={`${user.department === 'wholesale' ? 'Опт' : 'Розница'} · ${employeeHeaderDateLabel(today)}`} />
      <Suspense key={`${user.id}:${today.slice(0, 7)}`} fallback={<PersonalPayrollClient currentMonth={today.slice(0, 7)} refreshEnabled={false} />}>
        <SavedPayroll user={user} month={today.slice(0, 7)} />
      </Suspense>
    </div>
  </main>;
}
