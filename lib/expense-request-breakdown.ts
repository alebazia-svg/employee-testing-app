/** Native 1C data only. Missing branches are not empty payment lines or receipts. */
export type ExpenseBreakdownValue = {
  type: string;
  filled: boolean;
  value: string | number | boolean | null;
  name: string;
  ref: string;
};
export type ExpenseBreakdown = {
  contract: 'expense-request-breakdown-v1';
  source: string;
  complete: boolean;
  truncated: boolean;
  columns: { name: string; label: string; types: string[] }[];
  rows: { line_number: number; fields: Record<string, ExpenseBreakdownValue> }[];
};
export type ExpenseBreakdownResult =
  | { state: 'not_provided' | 'invalid' | 'incomplete'; data: null }
  | { state: 'available'; data: ExpenseBreakdown };

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
const fieldName = /^[А-Яа-яЁёA-Za-z_][А-Яа-яЁёA-Za-z_0-9]*$/u;

export function readExpenseBreakdown(value: unknown): ExpenseBreakdownResult {
  if (value == null) return { state: 'not_provided', data: null };
  const input = object(value);
  if (!input || input.contract !== 'expense-request-breakdown-v1') return { state: 'invalid', data: null };
  if (input.complete !== true || input.truncated !== false) return { state: 'incomplete', data: null };
  if (input.source !== 'Документ.ЗаявкаНаРасходованиеДенежныхСредств.РасшифровкаПлатежа'
    || !Array.isArray(input.columns) || !input.columns.length || input.columns.length > 100
    || !Array.isArray(input.rows) || input.rows.length > 200) return { state: 'invalid', data: null };
  const columns: ExpenseBreakdown['columns'] = [];
  const names = new Set<string>();
  for (const raw of input.columns) {
    const col = object(raw);
    if (!col || typeof col.name !== 'string' || !fieldName.test(col.name) || names.has(col.name)
      || ['__proto__', 'prototype', 'constructor'].includes(col.name)
      || typeof col.label !== 'string' || !Array.isArray(col.types) || !col.types.every(t => typeof t === 'string')) return { state: 'invalid', data: null };
    names.add(col.name);
    columns.push({ name: col.name, label: col.label || col.name, types: col.types });
  }
  const rows: ExpenseBreakdown['rows'] = [];
  const numbers = new Set<number>();
  for (const raw of input.rows) {
    const row = object(raw);
    if (!row || typeof row.line_number !== 'number' || !Number.isSafeInteger(row.line_number) || row.line_number <= 0 || numbers.has(row.line_number)) return { state: 'invalid', data: null };
    numbers.add(row.line_number);
    const fields = object(row.fields);
    if (!fields || Object.keys(fields).length !== columns.length) return { state: 'invalid', data: null };
    const result: Record<string, ExpenseBreakdownValue> = {};
    for (const { name } of columns) {
      const cell = object(fields[name]);
      if (!cell || typeof cell.type !== 'string' || typeof cell.filled !== 'boolean'
        || typeof cell.name !== 'string' || typeof cell.ref !== 'string'
        || !(cell.value === null || ['string', 'number', 'boolean'].includes(typeof cell.value))
        || (typeof cell.value === 'number' && !Number.isFinite(cell.value))) return { state: 'invalid', data: null };
      result[name] = { type: cell.type, filled: cell.filled, value: cell.value as ExpenseBreakdownValue['value'], name: cell.name, ref: cell.ref };
    }
    rows.push({ line_number: row.line_number, fields: result });
  }
  return { state: 'available', data: { contract: input.contract, source: input.source, complete: true, truncated: false, columns, rows } };
}

export function expenseBreakdownDisplay(cell: ExpenseBreakdownValue): string {
  if (typeof cell.value === 'boolean') return cell.value ? 'Да' : 'Нет';
  if (typeof cell.value === 'number') return cell.value.toLocaleString('ru-RU', { maximumFractionDigits: 10 });
  if (typeof cell.value === 'string' && cell.value) return cell.value;
  return cell.name || (cell.ref ? 'Значение из 1С без наименования' : 'Не заполнено в 1С');
}

/** Attachment metadata is not a downloaded or verified receipt. */
export function expenseAttachmentEvidence(value: unknown): { state: 'not_provided' | 'incomplete' | 'available'; count: number | null } {
  if (value == null) return { state: 'not_provided', count: null };
  const input = object(value);
  if (!input || input.complete !== true || input.truncated === true || !Array.isArray(input.rows)) return { state: 'incomplete', count: null };
  if (!input.rows.every(row => object(row) && typeof row.deletion_mark === 'boolean')) return { state: 'incomplete', count: null };
  return { state: 'available', count: input.rows.filter(row => row.deletion_mark === false).length };
}
