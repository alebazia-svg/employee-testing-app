import Link from 'next/link';
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
import { PersonalPayrollScreen } from '@/app/(dashboard)/employee/payroll/PersonalPayrollScreen';
import { payrollFeatureState } from '@/lib/payroll-features';
import { employeeNavigation, employeeSectionViews, type EmployeeSection } from '@/lib/employee-navigation';
export const dynamic = 'force-dynamic';
export default async function EmployeePreviewPage({ params, searchParams }: { params: Promise<{ visitId: string }>; searchParams: Promise<{ tab?: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin) notFound();
  const preview = await readEmployeePreview(admin.id, (await params).visitId);
  if (!preview) return <main className="mx-auto max-w-lg p-8"><h1 className="text-xl font-bold">Просмотр завершён</h1><p className="my-4">Откройте сотрудника заново из списка.</p><Link className="underline" href="/admin/employees">К сотрудникам</Link></main>;
  const tab = (await searchParams).tab ?? 'day';
  if (preview.employee.portalArea === 'WORKDAY' && !employeeNavigation(payrollFeatureState().employeeEnabled).some(section => section.id === tab)) notFound();
  return <>{preview.employee.portalArea === 'WORKDAY' && <EmployeeInterfaceStyle copper />}<EmployeePreviewProvider key={preview.visit.id} visitId={preview.visit.id} employeeName={preview.employee.name} expiresAt={preview.visit.expiresAt.toISOString()}>{preview.employee.portalArea === 'PROCUREMENT' ? <ProcurementShell userName={preview.employee.name}><ProcurementHome user={preview.employee} readOnly /></ProcurementShell> : <CashIssueProvider>{employeeSectionViews[tab as EmployeeSection] === 'payroll' ? <PersonalPayrollScreen user={preview.employee} /> : <EmployeeTodayClient key={tab} {...await loadEmployeeHome(preview.employee)} />}</CashIssueProvider>}</EmployeePreviewProvider></>;
}
