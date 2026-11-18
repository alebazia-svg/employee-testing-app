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

// Owner-approved identity cutover: both sellers in November; personal seller
// only from December. Keep the payroll key stable for saved history and inputs.
export const FILM_PERSONAL_NAME = 'Назранов Тимур';
// Confirmed from complete production salary cash/balance readers, 2026-11-18.
const FILM_LEGACY_RECIPIENT_REF = 'f393105e-c21e-11f0-a343-002590803daf';
export const FILM_PERSONAL_FROM = '2026-11';
export const FILM_LEGACY_SALES_THROUGH = '2026-11';
const normalizeFilmName = (value: string) => value.trim().toLowerCase().replaceAll('ё', 'е').replace(/\s+/g, ' ');
export function isFilmPersonalName(value: string) {
  return normalizeFilmName(value) === normalizeFilmName(FILM_PERSONAL_NAME);
}

// Payments are not sales: old-recipient debt and later payments must remain
// visible after the sales cutoff. Only the two approved exact labels may merge;
// duplicate refs for either label remain ambiguous, as do any other recipients.
export function isApprovedFilmRecipientPair(rows: { employeeName: string; employeeRef: string }[], period: string) {
  if (period < FILM_PERSONAL_FROM || !rows.length) return false;
  const labels = new Map<string, Set<string>>();
  for (const row of rows) {
    const label = normalizeFilmName(row.employeeName);
    if (!['стажеррозница', normalizeFilmName(FILM_PERSONAL_NAME)].includes(label)) return false;
    const ref = row.employeeRef.toLowerCase();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(ref)
        || ref === '00000000-0000-0000-0000-000000000000') return false;
    if (label === 'стажеррозница' && ref !== FILM_LEGACY_RECIPIENT_REF) return false;
    const refs = labels.get(label) ?? new Set<string>();
    refs.add(ref); labels.set(label, refs);
  }
  return labels.size === 2 && [...labels.values()].every(refs => refs.size === 1);
}
