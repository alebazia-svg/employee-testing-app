export const lateArrivalThresholdMinutes = 6;

export const lateArrivalReasons = {
  forgot_mark: 'Забыл отметить начало',
  personal: 'Личная причина',
  connection: 'Не было интернета',
  portal: 'Портал не открывался',
  other: 'Другое',
} as const;

export const earlyFinishReasons = {
  personal: 'Личная причина',
  health: 'Самочувствие',
  other: 'Другое',
} as const;

export type WorkdayDeviationKind = 'late_arrival' | 'early_finish';

export function deviationReasonLabel(kind: WorkdayDeviationKind, reasonCode: string) {
  const reasons = kind === 'late_arrival' ? lateArrivalReasons : earlyFinishReasons;
  return reasons[reasonCode as keyof typeof reasons] ?? reasonCode;
}

export function validateDeviationReason(kind: WorkdayDeviationKind, reasonCode: unknown, comment: unknown) {
  const reasons = kind === 'late_arrival' ? lateArrivalReasons : earlyFinishReasons;
  if (typeof reasonCode !== 'string' || !Object.prototype.hasOwnProperty.call(reasons, reasonCode)) return { ok: false as const, error: 'Выберите причину.' };
  const normalizedComment = typeof comment === 'string' ? comment.trim() : '';
  if (reasonCode === 'other' && !normalizedComment) return { ok: false as const, error: 'Коротко опишите причину.' };
  return { ok: true as const, reasonCode, comment: normalizedComment };
}

export function parseClockMinutes(value: unknown) {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [hours, minutes] = value.split(':').map(Number);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function validateEarlyFinishMinutes(value: unknown, shiftStartMinutes: number | null, shiftEndMinutes: number | null) {
  const requestedEndMinutes = parseClockMinutes(value);
  if (requestedEndMinutes === null) return { ok: false as const, error: 'Укажите время завершения.' };
  if (shiftStartMinutes !== null && requestedEndMinutes <= shiftStartMinutes) return { ok: false as const, error: 'Время должно быть позже начала смены.' };
  if (shiftEndMinutes === null || requestedEndMinutes >= shiftEndMinutes) return { ok: false as const, error: 'Это время не раньше окончания смены.' };
  return { ok: true as const, requestedEndMinutes };
}
