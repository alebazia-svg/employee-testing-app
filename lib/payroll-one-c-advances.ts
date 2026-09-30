import { FILM_TRAINEE_NAME, FILM_TRAINEE_PERIOD } from './payroll-trainee';

export type PayrollAdvanceDocument = {
  key: string; employeeRef: string; employeeName: string;
  documentNumber: string; documentDate: string; amount: number; periodKey: string;
};
export type PayrollAdvanceRead = {
  version: 1; periodKey: string; dateFrom: string; dateTo: string;
  checkedAt: string; documents: PayrollAdvanceDocument[]; issues: string[];
};

const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Некорректный ответ 1С по авансам.');
  return value as Record<string, unknown>;
};
const string = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const normalize = (value: string) => value.trim().toLocaleLowerCase('ru').replaceAll('ё', 'е').replace(/\s+/g, ' ');
const cents = (value: unknown) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isSafeInteger(Math.round(value * 100))
    || Math.abs(value * 100 - Math.round(value * 100)) > 0.00001) throw new Error('Некорректная сумма расходника.');
  return Math.round(value * 100);
};

// Deliberately accept a whole marker, not a substring of "не аванс" or a
// free-form explanation. Unknown wording must never reduce an employee's pay.
export function parsePayrollAdvanceComment(value: string): string | null {
  const match = /^аванс\s+(?:за\s+)?(20\d{2})[.-](0[1-9]|1[0-2])\s*[.]?$/iu.exec(value.trim());
  if (match) return `${match[1]}-${match[2]}`;
  const monthFirst = /^аванс\s+(?:за\s+)?(0[1-9]|1[0-2])[.-](20\d{2})\s*[.]?$/iu.exec(value.trim());
  return monthFirst ? `${monthFirst[2]}-${monthFirst[1]}` : null;
}

export function parsePayrollAdvanceResponse(value: unknown, expected: {
  periodKey: string; dateFrom: string; dateTo: string; checkedAt: string;
}): PayrollAdvanceRead {
  const data = record(value);
  if (data.ok !== true || data.complete !== true || data.mode !== 'read-only' || data.write_operations !== false
    || data.contract_version !== 'payroll-cash-payments-v1' || data.date_from !== expected.dateFrom
    || data.date_to !== expected.dateTo || !Array.isArray(data.rows)) throw new Error('Полнота данных 1С по авансам не подтверждена.');
  const keys = new Set<string>();
  const documents: PayrollAdvanceDocument[] = [];
  const issues: string[] = [];
  let total = 0;
  for (const raw of data.rows) {
    const row = record(raw);
    const ref = string(row.document_ref);
    if (!ref || !Number.isInteger(row.line_number) || Number(row.line_number) < 1) throw new Error('Не определён документ выплаты.');
    const key = `${ref}:${row.line_number}`;
    if (keys.has(key)) throw new Error('В ответе 1С повторяется строка расходника.');
    keys.add(key);
    const amount = cents(row.amount);
    total += amount;
    const rawDate = string(row.document_date);
    const dm = /^(\d{2})\.(\d{2})\.(\d{4})(?: |$)/.exec(rawDate);
    const iso = dm ? `${dm[3]}-${dm[2]}-${dm[1]}` : rawDate.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || iso < expected.dateFrom || iso > expected.dateTo
      || new Date(`${iso}T12:00:00Z`).toISOString().slice(0, 10) !== iso) throw new Error('Дата расходника вне проверяемого периода.');
    const comments = [string(row.document_comment), string(row.line_comment)].filter(Boolean);
    const markers = comments.map(parsePayrollAdvanceComment).filter((p): p is string => p !== null);
    const ambiguous = comments.some((c) => /аванс/iu.test(c) && !parsePayrollAdvanceComment(c));
    const number = string(row.document_number);
    if (ambiguous || new Set(markers).size > 1) {
      issues.push(`Расходник ${number || rawDate}: уточните месяц аванса в комментарии.`);
      continue;
    }
    if (markers[0] !== expected.periodKey) continue;
    const employeeRef = string(row.employee_ref);
    const employeeName = string(row.employee_name);
    if (row.employee_analytics_conflict !== false || !employeeRef || /^0+-0+-0+-0+-0+$/.test(employeeRef)
      || !employeeName || !number || amount <= 0) {
      issues.push(`Расходник ${number || rawDate}: не подтверждены получатель или сумма аванса.`);
      continue;
    }
    documents.push({ key, employeeRef, employeeName, documentNumber: number, documentDate: rawDate, amount: amount / 100, periodKey: expected.periodKey });
  }
  if (total !== cents(record(data.totals).amount)) throw new Error('Итог расходников не совпал с суммой строк.');
  return { version: 1, ...expected, documents, issues };
}

// Names are a conservative fallback until portal employee identities contain
// 1C refs. No fuzzy spelling matching and no permanent alias for the trainee.
export function matchPayrollAdvanceEmployee(document: PayrollAdvanceDocument, names: string[]) {
  const source = normalize(document.employeeName);
  if (source === 'стажеррозница' && document.periodKey === FILM_TRAINEE_PERIOD) {
    return names.includes(FILM_TRAINEE_NAME) ? FILM_TRAINEE_NAME : null;
  }
  const candidates = names.filter((name) => {
    const target = normalize(name);
    return source === target || (target.split(' ').length >= 2 && source.startsWith(`${target} `));
  });
  return candidates.length === 1 ? candidates[0] : null;
}

export function applyPayrollOneCAdvances<T extends { manager: string; advance: number; netPay: number }>(rows: T[], read: PayrollAdvanceRead) {
  const issues = [...read.issues];
  const byEmployee = new Map<string, PayrollAdvanceDocument[]>();
  for (const document of read.documents) {
    const name = matchPayrollAdvanceEmployee(document, rows.map((row) => row.manager));
    if (!name) { issues.push(`Расходник ${document.documentNumber}: сотрудник «${document.employeeName}» не сопоставлен.`); continue; }
    byEmployee.set(name, [...(byEmployee.get(name) ?? []), document]);
  }
  const result = rows.map((row) => {
    const docs = byEmployee.get(row.manager) ?? [];
    if (!docs.length) return { ...row, advanceDocuments: docs };
    if (new Set(docs.map((d) => d.employeeRef)).size !== 1 || row.advance !== 0) {
      issues.push(`${row.manager}: проверьте аванс — есть ручная сумма или разные получатели 1С. Автоматический вычет не применён.`);
      return { ...row, advanceDocuments: docs };
    }
    const advance = docs.reduce((sum, doc) => sum + cents(doc.amount), 0) / 100;
    return { ...row, advance, netPay: Math.round((row.netPay - advance) * 100) / 100, advanceDocuments: docs };
  });
  return { rows: result, issues };
}
