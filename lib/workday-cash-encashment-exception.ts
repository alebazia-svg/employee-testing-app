export const cashEncashmentExceptionPrefix = 'cash_encashment_';

export const cashEncashmentExceptionReasons = {
  safe_access: 'Нет доступа к депозитному сейфу',
  handover: 'Деньги переданы ответственному сотруднику',
  other: 'Другая причина',
} as const;

export type CashEncashmentExceptionReason = keyof typeof cashEncashmentExceptionReasons;

export function isCashEncashmentException(reasonCode: string) {
  return reasonCode.startsWith(cashEncashmentExceptionPrefix);
}

export function toCashEncashmentReasonCode(reason: CashEncashmentExceptionReason) {
  return `${cashEncashmentExceptionPrefix}${reason}`;
}

export function cashEncashmentReasonLabel(reasonCode: string) {
  const key = reasonCode.slice(cashEncashmentExceptionPrefix.length) as CashEncashmentExceptionReason;
  return cashEncashmentExceptionReasons[key] ?? reasonCode;
}
