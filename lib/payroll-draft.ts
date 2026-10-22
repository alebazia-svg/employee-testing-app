import type { PayrollManualInput, FixedPayrollInput, PurchasePayrollInput } from './payroll-calculation-engine';
import type { PayrollBonusDraft } from './payroll-compensation';
import { validateFinboxPeriod } from './payroll-finbox-input';

export type PayrollDraft = {
  manual: Record<string, PayrollManualInput>;
  fixed: Record<string, FixedPayrollInput>;
  purchase: PurchasePayrollInput;
  bonuses: PayrollBonusDraft[];
};
export type PayrollDraftRead = {
  periodKey: string; revision: number; savedAt: string | null;
  payload: PayrollDraft | null; locked: boolean;
};
const fail = () => { throw new Error('Проверьте введённые дни, суммы и комментарии.'); };
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail();
  return value as Record<string, unknown>;
}
function keys(row: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(row).some(key => !allowed.includes(key))) fail();
}
function text(value: unknown, max = 2000): string {
  if (typeof value !== 'string' || value.length > max || value.includes('\u0000')) return fail();
  return value;
}
function number(value: unknown, max = 10_000_000, integer = false) {
  const raw = text(value, 40);
  const clean = raw.trim().replace(',', '.');
  if (clean !== '' && (!/^\d+(?:\.\d{1,2})?$/.test(clean) || Number(clean) > max || (integer && !Number.isInteger(Number(clean))))) fail();
  return raw;
}
function dictionary<T>(value: unknown, parse: (row: Record<string, unknown>) => T): Record<string, T> {
  const source = object(value);
  if (Object.keys(source).length > 200) fail();
  return Object.fromEntries(Object.entries(source).map(([name, row]) => {
    if (!name.trim() || name.length > 200 || ['__proto__', 'constructor', 'prototype'].includes(name)) fail();
    return [name, parse(object(row))];
  }));
}
export function validatePayrollDraft(value: unknown): PayrollDraft {
  const root = object(value);
  keys(root, ['manual', 'fixed', 'purchase', 'bonuses']);
  const manual = dictionary(root.manual, row => {
    keys(row, ['workedDays', 'lateCount', 'advance', 'agentCreditCommission', 'comment', 'source']);
    if (row.source !== undefined && !['manual', 'attendance', 'schedule', 'manualCorrection'].includes(String(row.source))) fail();
    return {
      workedDays: number(row.workedDays, 31), lateCount: number(row.lateCount, 100, true),
      advance: number(row.advance), comment: text(row.comment),
      ...(row.agentCreditCommission !== undefined ? { agentCreditCommission: number(row.agentCreditCommission) } : {}),
      ...(row.source !== undefined ? { source: row.source as PayrollManualInput['source'] } : {}),
    };
  });
  const fixed = dictionary(root.fixed, row => {
    keys(row, ['bonus', 'advance', 'deduction', 'comment']);
    return { bonus: number(row.bonus), advance: number(row.advance), deduction: number(row.deduction), comment: text(row.comment) };
  });
  const purchase = object(root.purchase);
  keys(purchase, ['advance', 'deduction', 'comment']);
  if (!Array.isArray(root.bonuses) || root.bonuses.length > 200) return fail();
  const ids = new Set<string>();
  const bonuses = root.bonuses.map(value => {
    const row = object(value); keys(row, ['id', 'employeeName', 'amount', 'reason']);
    const id = text(row.id, 100);
    if (!id || ids.has(id)) fail();
    ids.add(id);
    // A draft may be incomplete while being edited; final approval validates it separately.
    return { id, employeeName: text(row.employeeName, 200), amount: number(row.amount), reason: text(row.reason) };
  });
  return { manual, fixed, purchase: { advance: number(purchase.advance), deduction: number(purchase.deduction), comment: text(purchase.comment) }, bonuses };
}
export function validatePayrollDraftWrite(value: unknown) {
  const row = object(value); keys(row, ['period', 'revision', 'requestId', 'payload']);
  const period = validateFinboxPeriod(row.period);
  if (!Number.isSafeInteger(row.revision) || Number(row.revision) < 0) fail();
  const requestId = text(row.requestId, 36);
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(requestId)) fail();
  return { period, revision: Number(row.revision), requestId, payload: validatePayrollDraft(row.payload) };
}
export function payrollDraftFingerprint(value: unknown): string {
  function canonical(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => [key, canonical(value)]));
    return value;
  }
  return JSON.stringify(canonical(value));
}

export function payrollDraftDifferences(local: PayrollDraft, saved: PayrollDraft | null) {
  const differences: Array<{ employee: string; field: string; local: string; saved: string }> = [];
  const labels: Record<string, string> = { workedDays: 'Дни', lateCount: 'Опоздания', advance: 'Аванс', agentCreditCommission: 'Финбокс', comment: 'Комментарий', source: 'Источник дней', bonus: 'Доплата', deduction: 'Удержание', amount: 'Премия', reason: 'Основание премии', employeeName: 'Получатель премии' };
  const display = (value: unknown) => value === undefined || value === '' ? 'Не указано' : String(value);
  function compare(employee: string, a: Record<string, unknown>, b: Record<string, unknown>) {
    for (const field of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (a[field] !== b[field]) differences.push({ employee, field: labels[field] ?? field, local: display(a[field]), saved: display(b[field]) });
    }
  }
  for (const group of ['manual', 'fixed'] as const) for (const name of new Set([...Object.keys(local[group]), ...Object.keys(saved?.[group] ?? {})])) {
    compare(name, { ...local[group][name] }, { ...saved?.[group][name] });
  }
  compare('Закупки', { ...local.purchase }, { ...saved?.purchase });
  for (const id of new Set([...local.bonuses.map(row => row.id), ...(saved?.bonuses ?? []).map(row => row.id)])) {
    const a = local.bonuses.find(row => row.id === id), b = saved?.bonuses.find(row => row.id === id);
    compare(a?.employeeName || b?.employeeName || 'Премия без сотрудника', { employeeName: a?.employeeName, amount: a?.amount, reason: a?.reason }, { employeeName: b?.employeeName, amount: b?.amount, reason: b?.reason });
  }
  const sources: Record<string, string> = { manual: 'Введены вручную', attendance: 'Отметки', schedule: 'График', manualCorrection: 'Ручная поправка' };
  return differences.map(row => row.field === 'Источник дней' ? { ...row, local: sources[row.local] ?? row.local, saved: sources[row.saved] ?? row.saved } : row);
}
