// Owner decision 2026-10-16: this assignment starts in September and continues
// until explicitly changed. Preserve the historical payroll identity for saved
// runs and advances; June's assignment to Magomed remains separate.
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
