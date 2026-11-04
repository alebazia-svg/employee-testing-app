// A dated, document-backed supplementary review. It never changes runner totals.
export type TaxManagementReview = {
  schema: 1;
  cutoff: string;
  reviewedAt: string;
  q1UsnCents: number;
  q1PsnCents: number;
  months: { periodKey: string; fnsCents: number; paymentsCents: number }[];
  fnsCrossing: string;
  paymentsCrossing: string;
  bridge: { title: string; cents: number; note: string }[];
  findings: { title: string; status: 'verified' | 'open' | 'owner_reported'; detail: string; action: string; sourceName: string }[];
  sources: { title: string; originalName: string; purpose: string; documentId?: string }[];
  documentId?: string;
};
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const money = (v: unknown): v is number => Number.isSafeInteger(v) && Math.abs(Number(v)) < 1e13;
const date = (v: unknown): v is string => typeof v === 'string' && /^20\d{2}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;

export function managementTotals(review: TaxManagementReview) {
  const baseline = review.q1UsnCents + review.q1PsnCents;
  let fns = baseline, payments = baseline;
  const months = review.months.map(row => ({ ...row, fnsYearCents: fns += row.fnsCents, paymentsYearCents: payments += row.paymentsCents }));
  return { baseline, fns, payments, difference: payments - fns, months, limitCents: 6_000_000_000 };
}

export function parseTaxManagementReview(raw: string): TaxManagementReview | undefined {
  try {
    const value: unknown = JSON.parse(raw);
    if (!object(value) || value.schema !== 1 || !date(value.cutoff) || !date(value.reviewedAt) || value.reviewedAt < value.cutoff || !money(value.q1UsnCents) || value.q1UsnCents < 0 || !money(value.q1PsnCents) || value.q1PsnCents < 0) return;
    // This evidence contract covers the owner's Jan–Mar / Apr onward transition.
    if (!Array.isArray(value.months) || !value.months.length || value.months.length > 9) return;
    const year = value.cutoff.slice(0, 4);
    for (const [index, row] of value.months.entries()) {
      if (!object(row) || row.periodKey !== `${year}-${String(index + 4).padStart(2, '0')}` || row.periodKey > value.cutoff.slice(0, 7) || !money(row.fnsCents) || !money(row.paymentsCents)) return;
    }
    if (value.months.at(-1)?.periodKey !== value.cutoff.slice(0, 7) || !date(value.fnsCrossing) || !date(value.paymentsCrossing) || value.fnsCrossing > value.cutoff || value.paymentsCrossing > value.cutoff) return;
    if (!Array.isArray(value.bridge) || !value.bridge.length || value.bridge.length > 20 || value.bridge.some(r => !object(r) || !text(r.title, 160) || !money(r.cents) || !text(r.note, 700))) return;
    if (!Array.isArray(value.sources) || !value.sources.length || value.sources.length > 20 || value.sources.some(s => !object(s) || !text(s.title, 160) || !text(s.originalName, 180) || !text(s.purpose, 700))) return;
    const sourceNames = value.sources.map(s => s.originalName);
    if (new Set(sourceNames).size !== sourceNames.length) return;
    if (!Array.isArray(value.findings) || !value.findings.length || value.findings.length > 20 || value.findings.some(f => !object(f) || !text(f.title, 160) || !['verified', 'open', 'owner_reported'].includes(String(f.status)) || !text(f.detail, 1400) || !text(f.action, 700) || !sourceNames.includes(f.sourceName))) return;
    const review = value as TaxManagementReview;
    const totals = managementTotals(review);
    if (!money(totals.fns) || !money(totals.payments) || review.bridge.reduce((sum, row) => sum + row.cents, 0) !== totals.difference) return;
    // A claimed crossing must agree with the cumulative monthly series.
    if (totals.baseline > totals.limitCents || totals.months.find(r => r.fnsYearCents > totals.limitCents)?.periodKey !== review.fnsCrossing.slice(0, 7) || totals.months.find(r => r.paymentsYearCents > totals.limitCents)?.periodKey !== review.paymentsCrossing.slice(0, 7)) return;
    // Never accept supplied document IDs/URLs. The authorized archive resolves them.
    return { ...review, documentId: undefined, sources: review.sources.map(({ title, originalName, purpose }) => ({ title, originalName, purpose })) };
  } catch { return; }
}
