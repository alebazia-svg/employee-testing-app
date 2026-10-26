import type { CashInventoryResolution } from './cash-inventory-resolution';
import { handoverExpenseLabel, type HandoverCashExpenses } from './handover-cash-expenses';
type Check = {
  inventoryResolution?: CashInventoryResolution;
  handoverExpenses?: HandoverCashExpenses;
  status: 'matched' | 'mismatch' | 'waiting' | 'unavailable';
  actual?: number | null;
  expected?: number | null;
  difference?: number;
  manualReview?: { decision: 'confirmed_ok' | 'confirmed_issue' } | null;
  cashOperation?: { status: string };
};

export type HandoverResult = { label: string; tone: 'neutral' | 'green' | 'amber' | 'error'; difference?: number };

export function missingHandoverPhotos(value: unknown): string[] {
  const record = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
  const data = record(value), cash = record(data.personalCash), closing = record(data.storeClosing), photos = record(data.photos), terminal = record(data.terminalCheck);
  const has = (key: string) => typeof record(photos[key]).storagePath === 'string' && String(record(photos[key]).storagePath).length > 0;
  const missing: string[] = [];
  if (cash.requiresEncashment === true && typeof cash.encashmentAmount === 'number' && !has('encashmentDocument')) missing.push('Фото инкассации');
  if (closing.zReportRequired === true && !has('zReport')) missing.push('Чек закрытия');
  if (terminal.hadOperations === true && !has('terminalReceipts') && !has('personalAcquiringReceipts')) missing.push('Чеки терминала');
  return missing;
}

function manualResult(check?: Check): HandoverResult | null {
  if (check?.manualReview?.decision === 'confirmed_issue') return { label: 'Проблема подтверждена', tone: 'error' };
  if (check?.manualReview?.decision === 'confirmed_ok') return { label: 'Подтверждено вручную', tone: 'green' };
  return null;
}

export function handoverCashResult(actual: number | null, check?: Check): HandoverResult {
  const manual = manualResult(check);
  if (manual) return manual;
  if (check?.inventoryResolution) return {label:'Оформлено инвентаризацией',tone:'neutral'};
  if (check?.handoverExpenses) { const e=check.handoverExpenses; return {label:handoverExpenseLabel(e),tone:e.state==='documented'?'green':'amber',difference:e.state==='documented'?undefined:e.approvalAmount||e.payableAmount}; }
  if (actual === null || !Number.isFinite(actual)) return { label: 'Сумма не введена', tone: 'amber' };
  if (!check || check.status === 'unavailable' || check.expected == null || !Number.isFinite(check.expected)) return { label: 'Нет данных 1С', tone: 'amber' };
  if (check.status === 'waiting') return { label: 'Ожидается сверка', tone: 'amber' };
  if (check.status === 'matched') return { label: 'Совпадает', tone: 'green' };
  const difference = check.difference ?? actual - check.expected;
  return { label: difference < 0 ? 'Недостача' : difference > 0 ? 'Излишек' : 'Нужна проверка', tone: 'error', difference: difference === 0 ? undefined : Math.abs(difference) };
}

export function handoverEncashmentResult(data: Record<string, unknown>, check?: Check): HandoverResult {
  const exception = typeof data.encashmentExceptionRequestId === 'string' && data.encashmentExceptionRequestId.length > 0;
  if (exception && data.encashmentAmount == null && check?.status === 'matched' && check.manualReview?.decision !== 'confirmed_issue') return { label: 'Без инкассации · разрешено', tone: 'neutral' };
  const manual = manualResult(check);
  if (manual?.tone === 'green' && data.requiresEncashment === false) return { label: 'Не было · проверено вручную', tone: 'green' };
  if (manual) return manual;
  if (check?.cashOperation?.status === 'one_c_error') return { label: 'Ошибка проведения', tone: 'error' };
  if (check?.cashOperation?.status === 'retrying_1c') return { label: 'Повторное проведение', tone: 'amber' };
  if (check?.cashOperation?.status === 'manual_in_progress') return { label: 'Проводит администратор', tone: 'amber' };
  if (check?.status === 'mismatch') return { label: data.requiresEncashment === false ? 'Есть движение в 1С' : 'Не подтверждено в 1С', tone: 'error' };
  if (data.requiresEncashment === false) return check?.status === 'matched'
    ? { label: 'Не было', tone: 'green' }
    : { label: 'Не было · нет сверки 1С', tone: 'amber' };
  if (data.requiresEncashment !== true) return { label: 'Не указано', tone: 'amber' };
  if (data.encashmentAmount == null) return { label: 'Сумма не указана', tone: 'amber' };
  if (!check || check.status === 'unavailable') return { label: 'Нет данных 1С', tone: 'amber' };
  return check.status === 'matched' ? { label: 'Подтверждено в 1С', tone: 'green' } : { label: 'Ожидается сверка', tone: 'amber' };
}
