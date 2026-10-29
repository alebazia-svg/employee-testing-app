import { createHash } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';
import path from 'node:path';
import * as XLSX from 'xlsx';
import type { FnsGaps } from './ausn-fns-gaps';

// Portal-only inspection of the archived original. No tax calculation, runner
// artifact mutation or automatic correction of FNS markup takes place here.
export type FnsBankRow = { date: string; amount: number; taxBase?: number; markup: string; row: number };
export type FnsBankReview = { documentId: string; sourceName: string; sha256: string; rows: FnsBankRow[] };
export type FnsBankCandidate = FnsBankRow & { documentId: string; sourceName: string };
const headers = ['Дата', 'Источник', 'Сумма, ₽', 'Разметка операции, ₽', 'Налоговая база'];
const money = (value: unknown) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'string' || !/^-?\d[\d\s\u00a0\u202f]*(?:[.,]\d{1,2})?$/.test(value.trim())) return undefined;
  const n = Number(value.replace(/[\s\u00a0\u202f]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
};
const day = (value: unknown) => {
  const m = /^(\d{2})\.(\d{2})\.(20\d{2})$/.exec(String(value ?? '').trim());
  if (!m) return undefined;
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  return new Date(`${iso}T00:00:00Z`).toISOString().slice(0, 10) === iso ? iso : undefined;
};
export function parseFnsBankReview(bytes: Uint8Array, source: Omit<FnsBankReview, 'rows'>): FnsBankReview | undefined {
  try {
    if (createHash('sha256').update(bytes).digest('hex') !== source.sha256) return undefined;
    const workbook = XLSX.read(bytes, { type: 'array', cellDates: false });
    const data = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[workbook.SheetNames[0]], { header: 1, raw: true, defval: '' });
    const names = data[0]?.map(String) || [];
    if (headers.some((h) => names.filter((n) => n === h).length !== 1)) return undefined;
    const rows: FnsBankRow[] = [];
    for (const [index, cells] of data.slice(1).entries()) {
      const get = (h: string) => cells[names.indexOf(h)];
      if (get('Источник') !== 'Банковская операция') continue;
      const date = day(get('Дата')), amount = money(get('Сумма, ₽'));
      if (!date || amount === undefined || amount <= 0) return undefined;
      const markup = String(get('Разметка операции, ₽')).trim();
      let taxBase = money(get('Налоговая база'));
      // A blank is normally unknown. Only explicit full non-tax markup proves
      // that this bank row contributes zero; malformed/partial markup does not.
      const nonTax = /^Неналоговая база\s*=\s*(.+)$/.exec(markup);
      if (taxBase === undefined && nonTax && money(nonTax[1]) === amount) taxBase = 0;
      rows.push({ date, amount, taxBase, markup: markup.slice(0, 240), row: index + 2 });
    }
    return { ...source, rows };
  } catch { return undefined; }
}
const cents = (n: number) => Math.round(n * 100);
// Amount/date are candidates, never an identity match. A row may belong to
// another account; duplicate candidates on either side remain unresolved.
export function attachFnsBankCandidates(gaps: FnsGaps, review: FnsBankReview): FnsGaps {
  const operations = Object.values(gaps.months).flatMap((m) => m.missingInFns);
  const possible = operations.map((op) => review.rows.filter((row) => {
    const delta = Date.parse(`${row.date}T00:00:00Z`) - Date.parse(`${op.date}T00:00:00Z`);
    return cents(row.amount) === cents(op.amount) && (delta === 0 || delta === 86_400_000);
  }));
  const useCount = new Map<number, number>();
  possible.flat().forEach((row) => useCount.set(row.row, (useCount.get(row.row) || 0) + 1));
  const candidates = new Map(operations.map((op, i) => [op, possible[i].length === 1 && useCount.get(possible[i][0].row) === 1 ? { ...possible[i][0], documentId: review.documentId, sourceName: review.sourceName } : undefined]));
  return { ...gaps, months: Object.fromEntries(Object.entries(gaps.months).map(([key, month]) => [key, { ...month, missingInFns: month.missingInFns.map((op) => ({ ...op, bankCandidate: candidates.get(op) })) }])) };
}

type ArchivedDocument = { id: string; documentType: string; status: string; originalName: string; storageKey: string; sha256: string; createdAt: Date };
export async function loadLatestFnsBankReview(documents: ArchivedDocument[], root = path.join(process.cwd(), 'uploads')): Promise<FnsBankReview | undefined> {
  // CORRECTION_EVIDENCE is an archive-only route: it never runs the shared
  // runner or changes Telegram. Its schema and checksum are still verified.
  // A failed/new pending upload must not be hidden behind an old success.
  const document = documents.filter((d) => d.documentType === 'AUSN_INCOME' || (d.documentType === 'CORRECTION_EVIDENCE' && /^Отчет по операциям .*\.xlsx$/i.test(d.originalName))).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  if (!document || !/\.xlsx$/i.test(document.storageKey)) return undefined;
  const usable = document.documentType === 'AUSN_INCOME' ? document.status === 'PROCESSED' : document.status === 'UPLOADED';
  if (!usable) return undefined;
  const file = path.resolve(root, document.storageKey);
  if (!file.startsWith(path.resolve(root) + path.sep)) return undefined;
  try {
    const stat = await lstat(file);
    if (!stat.isFile() || stat.size > 12 * 1024 * 1024) return undefined;
    return parseFnsBankReview(await readFile(file), { documentId: document.id, sourceName: document.originalName, sha256: document.sha256 });
  } catch { return undefined; }
}
