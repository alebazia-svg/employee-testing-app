import { parsePayrollAdvanceComment, matchPayrollAdvanceEmployee } from './payroll-one-c-advances';
import type { PayrollBalanceRead } from './payroll-one-c-balances';

export type PayrollCashRead = {
  dateFrom: string; dateTo: string; checkedAt: string;
  documents: { key: string; employeeRef: string; employeeName: string; documentNumber: string;
    documentDate: string; amount: number; comment: string; advancePeriod: string | null; identityConfirmed: boolean }[];
};
export function parsePayrollCashResponse(value: unknown, dateFrom: string, dateTo: string, checkedAt: string): PayrollCashRead {
  const p = value as Record<string, any>;
  if (!p || p.ok !== true || p.complete !== true || p.mode !== 'read-only' || p.write_operations !== false
    || p.contract_version !== 'payroll-cash-payments-v1' || p.organization_filter !== ''
    || p.date_from !== dateFrom || p.date_to !== dateTo || !Array.isArray(p.rows)
    || p.totals?.rows !== p.rows.length) throw new Error('PAYROLL_CASH_INCOMPLETE');
  const keys = new Set<string>(); let total = 0;
  const documents = p.rows.map((r: Record<string, any>) => {
    if (!r || typeof r.document_ref !== 'string' || !r.document_ref || !Number.isInteger(r.line_number) || r.line_number < 1
      || typeof r.document_number !== 'string' || !r.document_number) throw new Error('PAYROLL_CASH_DOCUMENT');
    const key = `${r.document_ref}:${r.line_number}`;
    if (keys.has(key)) throw new Error('PAYROLL_CASH_DUPLICATE'); keys.add(key);
    const raw = typeof r.document_date === 'string' ? r.document_date : '';
    const m = /^(\d{2})\.(\d{2})\.(\d{4})(?: |$)/.exec(raw);
    const date = m ? `${m[3]}-${m[2]}-${m[1]}` : raw.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date))
      || new Date(date).toISOString().slice(0, 10) !== date || date < dateFrom || date > dateTo) throw new Error('PAYROLL_CASH_DATE');
    if (typeof r.amount !== 'number' || !Number.isFinite(r.amount) || r.amount <= 0
      || !Number.isSafeInteger(Math.round(r.amount * 100)) || Math.abs(r.amount * 100 - Math.round(r.amount * 100)) > 0.00001) throw new Error('PAYROLL_CASH_AMOUNT');
    total += Math.round(r.amount * 100);
    if (!Number.isSafeInteger(total)) throw new Error('PAYROLL_CASH_AMOUNT');
    const comments = [r.document_comment, r.line_comment].filter((x): x is string => typeof x === 'string' && !!x.trim());
    const markers = comments.map(parsePayrollAdvanceComment).filter(Boolean);
    const ambiguous = comments.some(x => /аванс/iu.test(x) && !parsePayrollAdvanceComment(x));
    return { key, employeeRef: typeof r.employee_ref === 'string' ? r.employee_ref : '',
      employeeName: typeof r.employee_name === 'string' ? r.employee_name : '',
      identityConfirmed: r.employee_analytics_conflict === false && typeof r.employee_ref === 'string'
        && /^[a-f0-9-]{36}$/i.test(r.employee_ref) && r.employee_ref !== '00000000-0000-0000-0000-000000000000' && !!r.employee_name,
      documentNumber: r.document_number, documentDate: date, amount: Math.round(r.amount * 100) / 100,
      comment: comments.join(' · '), advancePeriod: !ambiguous && new Set(markers).size === 1 ? markers[0]! : null };
  });
  if (typeof p.totals.amount !== 'number' || !Number.isFinite(p.totals.amount)
    || Math.abs(p.totals.amount * 100 - total) > 0.00001) throw new Error('PAYROLL_CASH_TOTAL');
  return { dateFrom, dateTo, checkedAt, documents };
}

// Existing conservative payroll alias rules; ambiguous identities never become a zero balance.
export function resolvePayrollSettlementIdentity(name: string, names: string[], periodKey: string, cash: PayrollCashRead, balance: PayrollBalanceRead, ledgerEmployees: {employeeRef: string; employeeName: string}[] = []) {
  const candidates = [...cash.documents.filter(d => d.identityConfirmed), ...balance.rows, ...ledgerEmployees];
  const match = (d: {employeeName:string;employeeRef:string}) => {
    const source=d.employeeName.trim().toLocaleLowerCase('ru-RU').replace(/ё/g,'е');
    // Confirmed directory labels, not fuzzy name similarity. Ref uniqueness is checked below.
    const alias=source==='татьяна'?'Даудова Татьяна':source==='стажерзакупка'&&periodKey>='2026-10'?'Кумыков Мухаммед':null;
    if(alias&&names.includes(alias)&&!names.some(n=>n!==alias&&n.trim().toLocaleLowerCase('ru-RU').replace(/ё/g,'е')===source))return alias;
    return matchPayrollAdvanceEmployee({ ...d, key: '', documentNumber: '', documentDate: '', amount: 0, periodKey }, names);
  };
  const refs = new Set(candidates.filter(d => match(d) === name).map(d => d.employeeRef.toLowerCase()));
  if (refs.size !== 1) return null;
  const ref = [...refs][0];
  // One source identity cannot silently serve two portal employees.
  const owners = new Set(candidates.filter(d => d.employeeRef.toLowerCase() === ref).map(match).filter(Boolean));
  return owners.size === 1 && owners.has(name) ? ref : null;
}
