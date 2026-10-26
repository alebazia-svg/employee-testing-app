/** Small explicit vocabulary; no form contents, amounts, URLs or raw errors. */
export const operationActions = {
  payroll_view: 'Просмотр зарплаты', payroll_load: 'Обновление зарплаты',
  schedule_view: 'Просмотр графика', schedule_load: 'Обновление графика', schedule_save: 'Изменение графика',
  cash_send: 'Отправка инкассации',
  day_start: 'Начало рабочего дня', day_end: 'Завершение рабочего дня',
  vacation_save: 'Изменение отпуска', vacation_cancel: 'Отмена отпуска',
} as const;
export const operationStages = {
  started: 'Начал действие', completed: 'Приложение получило ответ', failed: 'Не удалось завершить действие',
  queued: 'Операция осталась на телефоне', confirmation: 'Требуется подтверждение изменения',
} as const;
export type OperationContext = {
  action: keyof typeof operationActions; stage: keyof typeof operationStages; attemptId: string;
  period?: string; ref?: string; durationMs?: number; reason?: 'network' | 'request' | 'unavailable' | 'incomplete' | 'prerequisite';
};
export function readOperationContext(value: unknown): OperationContext | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const p = value as Record<string, unknown>;
  if (!Object.keys(p).every(k => ['action','stage','attemptId','period','ref','durationMs','reason'].includes(k))) return null;
  if (typeof p.action !== 'string' || !Object.hasOwn(operationActions,p.action) || typeof p.stage !== 'string' || !Object.hasOwn(operationStages,p.stage)) return null;
  if (typeof p.attemptId !== 'string' || !/^[a-zA-Z0-9_-]{8,80}$/.test(p.attemptId)) return null;
  if (p.period !== undefined && (typeof p.period !== 'string' || !/^20\d{2}-(0[1-9]|1[0-2])(?:-(0[1-9]|[12]\d|3[01]))?$/.test(p.period))) return null;
  if (typeof p.period === 'string' && p.period.length === 10 && new Date(`${p.period}T12:00:00Z`).toISOString().slice(0,10)!==p.period) return null;
  if (p.ref !== undefined && (p.action !== 'cash_send' || typeof p.ref !== 'string' || !/^[a-zA-Z0-9_-]{8,80}$/.test(p.ref))) return null;
  if (p.durationMs !== undefined && (p.stage === 'started' || !Number.isSafeInteger(p.durationMs) || Number(p.durationMs)<0 || Number(p.durationMs)>21600000)) return null;
  if (p.reason !== undefined && (!['network','request','unavailable','incomplete','prerequisite'].includes(String(p.reason)) || !['failed','queued'].includes(p.stage))) return null;
  if (p.reason === 'prerequisite' && p.action !== 'day_end') return null;
  if (p.action.endsWith('_view') && (p.stage !== 'started' || !p.period)) return null;
  if (p.stage === 'queued' && p.action !== 'cash_send' || p.stage === 'confirmation' && p.action !== 'schedule_save') return null;
  return p as OperationContext;
}
export const operationSection = (action: OperationContext['action']) => action.startsWith('payroll') ? 'payroll' : action.startsWith('schedule') || action.startsWith('vacation') ? 'schedule' : 'day';
