// The shared 1C login is reusable. This assignment is intentionally bounded to
// the owner's approved September trial, not a permanent employee-name alias.
export const FILM_TRAINEE_PERIOD = '2026-09';
export const FILM_TRAINEE_NAME = 'СтажерРозница · поклейка (09.2026)';
export function isFilmTrainee(manager: string) {
  return manager === FILM_TRAINEE_NAME;
}
export function getPayrollServicePercent(manager: string) {
  return isFilmTrainee(manager) ? 70 : 50;
}
export function isFilmTraineeService(category: string) {
  const normalize = (value: string) => value.toLowerCase().replaceAll('ё', 'е').trim();
  return normalize(category).includes('услуги оказываемые');
}
