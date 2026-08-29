export const WORKDAY_QR_PREFIX = 'offonika-workday-start:';
export const WORKDAY_START_INTENT_TTL_MS = 15 * 60 * 1000;

export type WorkdayQrDepartment = 'retail' | 'wholesale';

export function parseWorkdayQrDepartment(value: string): WorkdayQrDepartment | null {
  const match = value.trim().match(/^offonika-workday-start:(retail|wholesale)$/i);
  return match ? (match[1].toLowerCase() as WorkdayQrDepartment) : null;
}

export function workdayStartIntentExpiresAt(qrAcceptedAt: Date) {
  return new Date(qrAcceptedAt.getTime() + WORKDAY_START_INTENT_TTL_MS);
}
