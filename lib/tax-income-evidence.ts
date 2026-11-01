// Document-backed reconciliation only. Does not calculate tax, change the
// executive runner, or use 1C bookkeeping as proof of FNS income recognition.
export type IncomeEvidence = {
  id: string; date: string; bank: string; amountCents: number;
  bankBaseCents: number | null; fiscalBaseCents: number | null;
  identityResolved: boolean; fnsSearchComplete: boolean;
  finding: string; internalNotes: string[]; sourceDocumentIds: string[];
};
export type IncomeEvidenceReview = { schema: 1; reviewedAt: string; title: string; cases: IncomeEvidence[]; documentId?: string };
export type IncomeRecognition = 'accounted' | 'omitted' | 'duplicate' | 'unconfirmed';
export function incomeRecognition(item: IncomeEvidence): IncomeRecognition {
  // A matching amount/date, a non-tax bank row, or a missing 1C check alone
  // cannot prove either inclusion or omission. Identity and FNS coverage gate it.
  if (!item.identityResolved || !item.fnsSearchComplete || item.bankBaseCents === null || item.fiscalBaseCents === null) return 'unconfirmed';
  if (item.bankBaseCents > 0 && item.fiscalBaseCents > 0) return 'duplicate';
  if (item.bankBaseCents + item.fiscalBaseCents === item.amountCents) return 'accounted';
  if (item.bankBaseCents === 0 && item.fiscalBaseCents === 0) return 'omitted';
  return 'unconfirmed';
}
const record = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.length > 0 && v.length <= max;
const cents = (v: unknown) => Number.isSafeInteger(v) && Number(v) >= 0;
export function parseIncomeEvidence(raw: string): IncomeEvidenceReview | undefined {
  try {
    const r: unknown = JSON.parse(raw);
    if (!record(r) || r.schema !== 1 || !text(r.title, 180) || !text(r.reviewedAt, 30) || !Number.isFinite(Date.parse(r.reviewedAt)) || !Array.isArray(r.cases) || !r.cases.length || r.cases.length > 500) return;
    const ids = new Set<string>();
    for (const c of r.cases) {
      if (!record(c) || !text(c.id, 80) || ids.has(c.id) || !text(c.date, 10) || !/^20\d{2}-\d{2}-\d{2}$/.test(c.date) || new Date(`${c.date}T00:00:00Z`).toISOString().slice(0, 10) !== c.date || !text(c.bank, 60) || !cents(c.amountCents) || c.amountCents === 0 || !(c.bankBaseCents === null || cents(c.bankBaseCents)) || !(c.fiscalBaseCents === null || cents(c.fiscalBaseCents)) || typeof c.identityResolved !== 'boolean' || typeof c.fnsSearchComplete !== 'boolean' || !text(c.finding, 1600) || !Array.isArray(c.internalNotes) || c.internalNotes.length > 10 || c.internalNotes.some(n => !text(n, 500)) || !Array.isArray(c.sourceDocumentIds) || !c.sourceDocumentIds.length || c.sourceDocumentIds.length > 20 || c.sourceDocumentIds.some(id => !text(id, 100) || !/^[a-zA-Z0-9_-]+$/.test(id))) return;
      ids.add(c.id);
    }
    return r as IncomeEvidenceReview;
  } catch { return; }
}
