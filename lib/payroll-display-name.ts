import { FILM_TRAINEE_NAME } from './payroll-trainee';
/** Correct presentation without rewriting saved payroll identities or source links. */
export function payrollDisplayName(value: string) {
  return value.replaceAll(FILM_TRAINEE_NAME, 'Тимур · поклейка').replaceAll('Кумыков Мухаммед', 'Кумыков Мухамед');
}
