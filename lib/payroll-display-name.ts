/** Correct presentation without rewriting saved payroll identities or source links. */
export function payrollDisplayName(value: string) {
  return value.replaceAll('Кумыков Мухаммед', 'Кумыков Мухамед');
}
