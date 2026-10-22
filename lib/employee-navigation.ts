/** One navigation contract for the employee app and administrator inspection. */
export const employeeSections = [
  { id: 'day', label: 'Рабочий день', href: '/employee' },
  { id: 'schedule', label: 'График', href: '/employee?tab=schedule' },
  { id: 'payroll', label: 'Моя зарплата', href: '/employee/payroll' },
] as const;
export type EmployeeSection = typeof employeeSections[number]['id'];
// Adding a section requires choosing its real renderer in inspection too.
export const employeeSectionViews = { day: 'home', schedule: 'home', payroll: 'home' } as const satisfies Record<EmployeeSection, 'home'>;
export function initialEmployeeSection(tab: string | null, payrollEnabled: boolean): EmployeeSection {
  return tab === 'payroll' && payrollEnabled ? 'payroll' : tab === 'schedule' ? 'schedule' : 'day';
}
export function employeeNavigation(payrollEnabled: boolean) {
  return employeeSections.filter(section => section.id !== 'payroll' || payrollEnabled);
}
export function employeePreviewHref(visitId: string, href: string) {
  const section = employeeSections.find(section => section.href === href);
  if (!section) throw new Error('Раздел недоступен в режиме проверки.');
  const base = `/admin/employees/preview/${encodeURIComponent(visitId)}`;
  return section.id === 'day' ? base : `${base}?tab=${section.id}`;
}
