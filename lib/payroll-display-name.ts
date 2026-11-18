import { FILM_TRAINEE_NAME, FILM_PERSONAL_NAME, FILM_PERSONAL_FROM } from './payroll-trainee';
/** Correct presentation without rewriting saved payroll identities or source links. */
export function payrollDisplayName(value: string, periodKey?: string) {
  const filmName = periodKey && /^\d{4}-(0[1-9]|1[0-2])$/.test(periodKey) && periodKey >= FILM_PERSONAL_FROM
    ? FILM_PERSONAL_NAME : 'Тимур · поклейка';
  return value.replaceAll(FILM_TRAINEE_NAME, filmName).replaceAll('Кумыков Мухаммед', 'Кумыков Мухамед');
}
