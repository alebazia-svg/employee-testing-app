import Link from 'next/link';
import { EmployeeMobileStylePreload } from '@/components/EmployeeMobileStylePreload';
import { Suspense } from 'react';
import { ProcurementWorkdayContent } from '@/components/ProcurementWorkdayContent';
import { notFound } from 'next/navigation';
import { getCurrentAdmin } from '@/lib/auth';
import { readEmployeePreview } from '@/lib/employee-preview';
import { loadEmployeeHome } from '@/lib/employee-home';
import { EmployeeInterfaceStyle } from '@/components/EmployeeInterfaceStyle';
import { EmployeePreviewProvider } from '@/components/EmployeePreviewProvider';
import { EmployeeTodayClient } from '@/app/(dashboard)/employee/EmployeeTodayClient';
import { CashIssueProvider } from '@/app/(dashboard)/employee/CashIssueClient';
import { ProcurementHome } from '@/app/(dashboard)/procurement/ProcurementHome';
import { ProcurementShell } from '@/components/ProcurementShell';
import { payrollFeatureState } from '@/lib/payroll-features';
import { employeeNavigation } from '@/lib/employee-navigation';
import { EmployeeActionReminderProvider } from '@/components/workday/EmployeeActionReminder';
import { EmployeePayrollSnapshots } from '@/components/EmployeePayrollSnapshots';
import { EmployeePreviewViewport } from '@/components/EmployeePreviewViewport';
export const dynamic = 'force-dynamic';
export default async function EmployeePreviewPage({ params, searchParams }: { params: Promise<{ visitId: string }>; searchParams: Promise<{ tab?: string; frame?: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin) notFound();
  const preview = await readEmployeePreview(admin.id, (await params).visitId);
  if (!preview) return <main className="mx-auto max-w-lg p-8"><h1 className="text-xl font-bold">Просмотр завершён</h1><p className="my-4">Откройте сотрудника заново из списка.</p><Link className="underline" href="/admin/employees">К сотрудникам</Link></main>;
  const query = await searchParams;
  const procurement = preview.employee.portalArea === 'PROCUREMENT';
  const frame: 'phone' | 'desktop' | undefined = procurement && (query.frame === 'phone' || query.frame === 'desktop') ? query.frame : undefined;
  const providerProps = { visitId: preview.visit.id, employeeName: preview.employee.name, expiresAt: preview.visit.expiresAt.toISOString(), procurement, frame };
  if (procurement && !frame) return <EmployeePreviewProvider {...providerProps}><EmployeePreviewViewport visitId={preview.visit.id} employeeName={preview.employee.name}/></EmployeePreviewProvider>;
  const tab = query.tab ?? (procurement ? 'procurement' : 'day');
  if (preview.employee.portalArea === 'WORKDAY' && !employeeNavigation(payrollFeatureState().employeeEnabled).some(section => section.id === tab)) notFound();
  if (procurement && (!['day', 'schedule', 'procurement'].includes(tab) || (tab !== 'procurement' && preview.employee.department !== 'procurement'))) notFound();
  if (procurement && frame === 'phone' && preview.employee.department === 'procurement') return <><EmployeeMobileStylePreload/><EmployeePreviewProvider key={preview.visit.id} {...providerProps}>
    <ProcurementShell userName={preview.employee.name} workdayEnabled workdayContent={<Suspense fallback={<p className='px-4 py-6 text-sm text-slate-500'>Загружаем рабочий день…</p>}><ProcurementWorkdayContent user={preview.employee}/></Suspense>}>
      <ProcurementHome user={preview.employee} readOnly />
    </ProcurementShell>
  </EmployeePreviewProvider></>;
  const calendar = procurement && tab === 'procurement';
  return <>{!calendar && <EmployeeInterfaceStyle copper />}<EmployeePreviewProvider key={preview.visit.id} {...providerProps}>{calendar ? <ProcurementShell userName={preview.employee.name}><ProcurementHome user={preview.employee} readOnly /></ProcurementShell> : <CashIssueProvider><EmployeePayrollSnapshots><EmployeeActionReminderProvider><EmployeeTodayClient {...await loadEmployeeHome(preview.employee)} /></EmployeeActionReminderProvider></EmployeePayrollSnapshots></CashIssueProvider>}</EmployeePreviewProvider></>;
}
