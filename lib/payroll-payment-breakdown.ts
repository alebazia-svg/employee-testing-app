export const PROCUREMENT_TRAINEE_REF = '70dbcdd8-ce99-11f0-a343-002590803daf';

/** Owner-confirmed October advance; changed source facts are not inferred. */
export function confirmedProcurementAdvance(document: {
  employeeRef: string; amount: number; comment: string; documentDate: string; documentNumber: string;
}) {
  return document.employeeRef.toLowerCase() === PROCUREMENT_TRAINEE_REF
    && document.documentNumber === '00OF-001901' && document.documentDate === '2026-10-16'
    && document.amount === 7500 && !document.comment.trim()
    ? { period: '2026-10', advance: 7500, days: 0 } : null;
}

/** A cash document is counted once. Parts explain its amount, never add a deduction. */
export function confirmedPayrollPaymentBreakdown(employee: string, document: {
  amount: number; comment: string; documentDate: string; documentNumber: string; advancePeriod: string | null;
}) {
  // Owner confirmed the entire issuance for September, not an October advance.
  // Require the unchanged source facts: a later edit must be reviewed again.
  const confirmed = employee === 'Ахобекова Залина'
    && document.documentNumber === '00OF-001802'
    && document.documentDate === '2026-10-01' && document.amount === 23000;
  return payrollPaymentBreakdown(document, confirmed);
}

export function payrollPaymentBreakdown(document: { amount: number; comment: string; documentDate: string; advancePeriod: string | null }, daysPaidOnFirst = false) {
  if (document.advancePeriod) return { period: document.advancePeriod, advance: document.amount, days: 0 };
  // Owner-confirmed convention: days paid on the first are for the previous month.
  // Accept a mixed advance only when its explicit month is that same month.
  // Other combinations remain unassigned rather than guessed.
  const text = document.comment.trim();
  const match = /^(\d+(?:[.,]\d{1,2})?)\s+аванс\s+(?:за\s+)?(?:(20\d{2})\.(0?[1-9]|1[0-2])|(0?[1-9]|1[0-2])\.(20\d{2}))\s*[.;]?$/iu.exec(text);
  if (!daysPaidOnFirst || !match || !/^20\d{2}-(0[1-9]|1[0-2])-01$/.test(document.documentDate)) return null;
  const period = `${match[2] ?? match[5]}-${(match[3] ?? match[4]).padStart(2, '0')}`;
  const [year, month] = document.documentDate.split('-').map(Number);
  const previous = new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 7);
  const advanceMinor = Math.round(Number(match[1].replace(',', '.')) * 100);
  const totalMinor = Math.round(document.amount * 100);
  if (period !== previous || !Number.isSafeInteger(totalMinor) || advanceMinor <= 0 || advanceMinor >= totalMinor) return null;
  return { period, advance: advanceMinor / 100, days: (totalMinor - advanceMinor) / 100 };
}
